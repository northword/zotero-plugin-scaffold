import path from "node:path";
import { env } from "node:process";
import chalk from "chalk";
import { build as buildAsync } from "esbuild";
import { globbySync } from "globby";
import fs from "fs-extra";
import { toMerged } from "es-toolkit";
import { replaceInFileSync } from "replace-in-file";
import webext from "web-ext";
import type { Context } from "../types/index.js";
import type { Manifest } from "../types/manifest.js";
import type { UpdateJSON } from "../types/update-json.js";
import { generateHashSync } from "../utils/crypto.js";
import { dateFormat, toArray } from "../utils/string.js";
import { patchWebExtLogger } from "../utils/log.js";
import { Base } from "./base.js";

export default class Build extends Base {
  private buildTime: string;
  private isPreRelease: boolean;
  constructor(ctx: Context) {
    super(ctx);
    env.NODE_ENV ??= "production";
    this.buildTime = "";
    this.isPreRelease = this.ctx.version.includes("-");
  }

  /**
   * Default build runner
   */
  async run() {
    const { dist, version } = this.ctx;

    const t = new Date();
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", t);
    this.logger.info(
      `Building version ${chalk.blue(version)} to ${chalk.blue(dist)} at ${chalk.blue(this.buildTime)} in ${chalk.blue(env.NODE_ENV)} mode.`,
    );
    await this.ctx.hooks.callHook("build:init", this.ctx);

    fs.emptyDirSync(dist);
    await this.ctx.hooks.callHook("build:mkdir", this.ctx);
    this.copyAssets();
    await this.ctx.hooks.callHook("build:copyAssets", this.ctx);

    this.logger.info("Preparing manifest");
    this.makeManifest();
    await this.ctx.hooks.callHook("build:makeManifest", this.ctx);

    this.logger.info("Preparing locale files");
    this.prepareLocaleFiles();
    await this.ctx.hooks.callHook("build:fluent", this.ctx);

    this.logger.info("Replacing");
    this.replaceString();
    await this.ctx.hooks.callHook("build:replace", this.ctx);

    this.logger.info("Running esbuild");
    await this.esbuild();
    await this.ctx.hooks.callHook("build:bundle", this.ctx);

    this.logger.info("Addon prepare OK.");

    /** ======== build resolved =========== */

    if (env.NODE_ENV === "production") {
      this.logger.info("Packing Addon");
      await this.pack();
      await this.ctx.hooks.callHook("build:pack", this.ctx);

      this.logger.info("Preparing update.json");
      this.makeUpdateJson();
      await this.ctx.hooks.callHook("build:makeUpdateJSON", this.ctx);
    }

    await this.ctx.hooks.callHook("build:done", this.ctx);
    this.logger.success(
      `Build finished in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
    );
  }

  /**
   * Copys files in `Config.build.assets` to `Config.dist`
   */
  copyAssets() {
    const { source, dist, build } = this.ctx;
    const { assets } = build;

    const files = globbySync(assets);
    files.forEach((file) => {
      const newPath = `${dist}/addon/${file.replace(new RegExp(toArray(source).join("|")), "")}`;
      this.logger.debug(`Copy ${file} to ${newPath}`);
      fs.copySync(file, newPath);
    });
  }

  /**
   * Override user's manifest
   *
   * Write `applications.gecko` to `manifest.json`
   *
   */
  makeManifest() {
    if (!this.ctx.build.makeManifest.enable)
      return;

    const { name, id, updateURL, dist, version } = this.ctx;

    const userData = fs.readJSONSync(
      `${dist}/addon/manifest.json`,
    ) as Manifest;
    const template: Manifest = {
      ...userData,
      ...((!userData.name && name) && { name }),
      ...(version && { version }),
      manifest_version: 2,
      applications: {
        // @ts-expect-error 此处不包含版本限制
        zotero: {
          id,
          update_url: updateURL,
        },
        gecko: {
          id,
          update_url: updateURL,
          strict_min_version: "102",
        },
      },
    };

    const data: Manifest = toMerged(userData, template);
    this.logger.debug("manifest: ", JSON.stringify(data, null, 2));

    fs.outputJSONSync(`${dist}/addon/manifest.json`, data, { spaces: 2 });
  }

  /**
   * Replace all `placeholder.key` to `placeholder.value` for all files in `dist`
   */
  replaceString() {
    const { dist, build } = this.ctx;
    const { assets, define } = build;

    const replaceMap = new Map(
      Object.keys(define).map(key => [
        new RegExp(`__${key}__`, "g"),
        define[key],
      ]),
    );
    this.logger.debug("replace map: ", replaceMap);

    const replaceResult = replaceInFileSync({
      files: toArray(assets).map(
        asset => `${dist}/addon/${asset.split("/").slice(1).join("/")}`,
      ),
      from: Array.from(replaceMap.keys()),
      to: Array.from(replaceMap.values()),
      countMatches: true,
    });

    this.logger.debug(
      "Run replace in ",
      replaceResult
        .filter(f => f.hasChanged)
        .map(f => `${f.file} : ${f.numReplacements} / ${f.numMatches}`),
    );
  }

  prepareLocaleFiles() {
    const { dist, namespace, build } = this.ctx;

    // Walk the sub folders of `build/addon/locale`
    const localeNames = globbySync(`${dist}/addon/locale/**`, { onlyDirectories: true })
      .map(locale => path.basename(locale));
    this.logger.debug("locale names: ", localeNames);

    for (const localeName of localeNames) {
      // rename *.ftl to addonRef-*.ftl
      if (build.fluent.prefixLocaleFiles === true) {
        globbySync(`${dist}/addon/locale/${localeName}/**/*.ftl`, {})
          .forEach((f) => {
            fs.moveSync(
              f,
              `${path.dirname(f)}/${namespace}-${path.basename(f)}`,
            );
            this.logger.debug(`Prefix filename: ${f}`);
          });
      }

      // Prefix Fluent messages in each ftl
      const MessageInThisLang = new Set();
      replaceInFileSync({
        files: [`${dist}/addon/locale/${localeName}/**/*.ftl`],
        processor: (fltContent) => {
          const lines = fltContent.split("\n");
          const prefixedLines = lines.map((line: string) => {
            // https://regex101.com/r/lQ9x5p/1
            const match = line.match(
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              /^(?<message>[a-z]\S*)( *= *)(?<pattern>.*)$/im,
            );
            if (match && match.groups) {
              MessageInThisLang.add(match.groups.message);
              return build.fluent.prefixFluentMessages
                ? `${namespace}-${line}`
                : line;
            }
            else {
              return line;
            }
          });
          return prefixedLines.join("\n");
        },
      });

      // Prefix Fluent messages in xhtml
      const MessagesInHTML = new Set();
      replaceInFileSync({
        files: [
          `${dist}/addon/**/*.xhtml`,
          `${dist}/addon/**/*.html`,
        ],
        processor: (input) => {
          const matches = [
            ...input.matchAll(
              new RegExp(`(data-l10n-id)="((?!${namespace})\\S*)"`, "g"),
            ),
          ];
          matches.forEach((match) => {
            const [matched, attrKey, attrVal] = match;
            if (!MessageInThisLang.has(attrVal)) {
              this.logger.warn(`${attrVal} don't exist in ${localeName}`);
              return;
            }
            if (!this.ctx.build.fluent.prefixFluentMessages) {
              return;
            }
            input = input.replace(
              matched,
              `${attrKey}="${namespace}-${attrVal}"`,
            );
            MessagesInHTML.add(attrVal);
          });
          return input;
        },
      });
    }
  }

  esbuild() {
    const { build: { esbuildOptions } } = this.ctx;

    if (esbuildOptions.length === 0)
      return;

    return Promise.all(
      esbuildOptions.map(esbuildOption =>
        buildAsync(esbuildOption),
      ),
    );
  }

  makeUpdateJson() {
    const { dist, xpiName, id, version, xpiDownloadLink, build } = this.ctx;

    const manifest = fs.readJSONSync(
      `${dist}/addon/manifest.json`,
    ) as Manifest;
    const min = manifest.applications?.zotero?.strict_min_version;
    const max = manifest.applications?.zotero?.strict_max_version;

    const updateHash = generateHashSync(
      path.join(dist, `${xpiName}.xpi`),
      "sha512",
    );

    const data: UpdateJSON = {
      addons: {
        [id]: {
          updates: [
            ...build.makeUpdateJson.updates,
            {
              version,
              update_link: xpiDownloadLink,
              ...(build.makeUpdateJson.hash && {
                update_hash: updateHash,
              }),
              applications: {
                zotero: {
                  strict_min_version: min,
                  ...(max && { strict_max_version: max }),
                },
              },
            },
          ],
        },
      },
    };

    fs.writeJsonSync(`${dist}/update-beta.json`, data, { spaces: 2 });
    if (!this.isPreRelease)
      fs.writeJsonSync(`${dist}/update.json`, data, { spaces: 2 });

    this.logger.tip(
      `Prepare Update.json for ${
        this.isPreRelease
          ? "\u001B[31m Prerelease \u001B[0m"
          : "\u001B[32m Release \u001B[0m"
      }`,
    );
  }

  async pack() {
    await patchWebExtLogger(this.ctx);

    const { dist, xpiName } = this.ctx;

    await webext.cmd.build({
      sourceDir: `${dist}/addon`,
      artifactsDir: dist,
      filename: `${xpiName}.xpi`,
      overwriteDest: true,
    });
  }
}
