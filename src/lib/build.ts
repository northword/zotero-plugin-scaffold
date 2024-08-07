import path from "node:path";
import { env } from "node:process";
import chalk from "chalk";
import { build as buildAsync } from "esbuild";
import glob from "fast-glob";
import fs from "fs-extra";
import { assign, template } from "radash";
import { replaceInFileSync } from "replace-in-file";
import webext from "web-ext";
import type { Context } from "../types/index.js";
import type { Manifest } from "../types/manifest.js";
import type { UpdateJSON } from "../types/update-json.js";
import { generateHashSync } from "../utils/crypto.js";
import { dateFormat, toArray } from "../utils/string.js";
import { Base } from "./base.js";

export default class Build extends Base {
  private buildTime: string;
  private isPreRelease: boolean;
  constructor(ctx: Context) {
    super(ctx);
    env.NODE_ENV ??= "production";
    this.buildTime = "";
    this.isPreRelease = this.version.includes("-");
  }

  /**
   * Default build runner
   */
  async run() {
    const t = new Date();
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", t);
    this.logger.start(
      `Building version ${chalk.blue(this.version)} to ${chalk.blue(this.dist)} at ${chalk.blue(this.buildTime)} in ${chalk.blue(env.NODE_ENV)} mode.`,
    );
    await this.ctx.hooks.callHook("build:init", this.ctx);

    fs.emptyDirSync(this.dist);
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
    const files = glob.sync(this.ctx.build.assets);
    files.forEach((file) => {
      const newPath = `${this.dist}/addon/${file.replace(new RegExp(toArray(this.src).join("|")), "")}`;
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
    const userData = fs.readJSONSync(
      `${this.dist}/addon/manifest.json`,
    ) as Manifest;
    const template: Manifest = {
      ...userData,
      ...(this.name && { name: this.name }),
      ...(this.version && { version: this.version }),
      manifest_version: 2,
      applications: {
        // @ts-expect-error 此处不包含版本限制
        zotero: {
          id: this.id,
          update_url: this.updateURL,
        },
        gecko: {
          id: this.id,
          update_url: this.updateURL,
          strict_min_version: "102",
        },
      },
    };

    const data: Manifest = assign(userData, template);
    this.logger.debug("manifest: ", JSON.stringify(data, null, 2));

    fs.outputJSONSync(`${this.dist}/addon/manifest.json`, data, { spaces: 2 });
  }

  /**
   * Replace all `placeholder.key` to `placeholder.value` for all files in `dist`
   */
  replaceString() {
    const replaceMap = new Map(
      Object.keys(this.ctx.build.define).map(key => [
        new RegExp(`__${key}__`, "g"),
        template(this.ctx.build.define[key] as string, this.ctx.templateDate),
      ]),
    );
    this.logger.debug("replace map: ", replaceMap);

    const replaceResult = replaceInFileSync({
      files: toArray(this.ctx.build.assets).map(
        asset => `${this.dist}/addon/${asset.split("/").slice(1).join("/")}`,
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
    // Walk the sub folders of `build/addon/locale`
    const localeNames = glob
      .sync(`${this.dist}/addon/locale/**`, { onlyDirectories: true })
      .map(locale => path.basename(locale));
    this.logger.debug("locale names: ", localeNames);

    for (const localeName of localeNames) {
      // rename *.ftl to addonRef-*.ftl
      if (this.ctx.build.fluent.prefixLocaleFiles === true) {
        glob
          .sync(`${this.dist}/addon/locale/${localeName}/**/*.ftl`, {})
          .forEach((f) => {
            fs.moveSync(
              f,
              `${path.dirname(f)}/${this.namespace}-${path.basename(f)}`,
            );
            this.logger.debug(`Prefix filename: ${f}`);
          });
      }

      // Prefix Fluent messages in each ftl
      const MessageInThisLang = new Set();
      replaceInFileSync({
        files: [`${this.dist}/addon/locale/${localeName}/**/*.ftl`],
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
              return this.ctx.build.fluent.prefixFluentMessages
                ? `${this.namespace}-${line}`
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
          `${this.dist}/addon/**/*.xhtml`,
          `${this.dist}/addon/**/*.html`,
        ],
        processor: (input) => {
          const matches = [
            ...input.matchAll(
              new RegExp(`(data-l10n-id)="((?!${this.namespace})\\S*)"`, "g"),
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
              `${attrKey}="${this.namespace}-${attrVal}"`,
            );
            MessagesInHTML.add(attrVal);
          });
          return input;
        },
      });
    }
  }

  esbuild() {
    if (this.ctx.build.esbuildOptions.length === 0)
      return;
    return Promise.all(
      this.ctx.build.esbuildOptions.map(esbuildOption =>
        buildAsync(esbuildOption),
      ),
    );
  }

  makeUpdateJson() {
    const manifest = fs.readJSONSync(
      `${this.dist}/addon/manifest.json`,
    ) as Manifest;
    const min = manifest.applications?.zotero?.strict_min_version;
    const max = manifest.applications?.zotero?.strict_max_version;

    const updateHash = generateHashSync(
      path.join(this.dist, `${this.xpiName}.xpi`),
      "sha512",
    );

    const data: UpdateJSON = {
      addons: {
        [this.id]: {
          updates: [
            ...this.ctx.build.makeUpdateJson.updates,
            {
              version: this.version,
              update_link: this.updateLink,
              ...(this.ctx.build.makeUpdateJson.hash && {
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

    fs.writeJsonSync(`${this.dist}/update-beta.json`, data, { spaces: 2 });
    if (!this.isPreRelease)
      fs.writeJsonSync(`${this.dist}/update.json`, data, { spaces: 2 });

    this.logger.log(
      `Prepare Update.json for ${
        this.isPreRelease
          ? "\u001B[31m Prerelease \u001B[0m"
          : "\u001B[32m Release \u001B[0m"
      }`,
    );
  }

  async pack() {
    await webext.cmd.build({
      sourceDir: `${this.dist}/addon`,
      artifactsDir: this.dist,
      filename: `${this.xpiName}.xpi`,
      overwriteDest: true,
    });
  }
}
