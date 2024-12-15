import type { Context } from "../types/index.js";
import type { Manifest } from "../types/manifest.js";
import type { UpdateJSON } from "../types/update-json.js";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { env } from "node:process";
import AdmZip from "adm-zip";
import chalk from "chalk";
import { toMerged } from "es-toolkit";
import { build as buildAsync } from "esbuild";
import { copy, emptyDir, move, outputJSON, readJSON, writeJson } from "fs-extra";
import { glob } from "tinyglobby";
import { generateHash } from "../utils/crypto.js";
import { dateFormat, replaceInFile, toArray } from "../utils/string.js";
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

    await emptyDir(dist);
    await this.ctx.hooks.callHook("build:mkdir", this.ctx);

    this.logger.tip("Preparing static assets");
    await this.makeAssets();
    await this.ctx.hooks.callHook("build:copyAssets", this.ctx);

    this.logger.debug("Preparing manifest");
    await this.makeManifest();
    await this.ctx.hooks.callHook("build:makeManifest", this.ctx);

    this.logger.debug("Preparing locale files");
    await this.prepareLocaleFiles();
    await this.ctx.hooks.callHook("build:fluent", this.ctx);

    this.logger.tip("Bundling scripts");
    await this.esbuild();
    await this.ctx.hooks.callHook("build:bundle", this.ctx);

    /** ======== build resolved =========== */

    if (env.NODE_ENV === "production") {
      this.logger.tip("Packing plugin");
      await this.pack();
      await this.ctx.hooks.callHook("build:pack", this.ctx);

      await this.makeUpdateJson();
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
  async makeAssets() {
    const { source, dist, build } = this.ctx;
    const { assets, define } = build;

    // We should ignore node_modules/ by default, glob this folder will be very slow
    const paths = await glob(assets, { ignore: "node_modules" });
    const newPaths = paths.map(p => `${dist}/addon/${p.replace(new RegExp(toArray(source).join("|")), "")}`);

    // Copys files in `Config.build.assets` to `Config.dist`
    await Promise.all(paths.map(async (file, i) => {
      await copy(file, newPaths[i]);
      this.logger.debug(`Copy ${file} to ${newPaths[i]}`);
    }));

    // Replace all `placeholder.key` to `placeholder.value` for all files in `dist`
    const replaceMap = new Map(
      Object.keys(define).map(key => [
        new RegExp(`__${key}__`, "g"),
        define[key],
      ]),
    );
    this.logger.debug("replace map: ", replaceMap);
    await replaceInFile({
      files: newPaths,
      from: Array.from(replaceMap.keys()),
      to: Array.from(replaceMap.values()),
      isGlob: false,
    });
  }

  /**
   * Override user's manifest
   *
   */
  async makeManifest() {
    if (!this.ctx.build.makeManifest.enable)
      return;

    const { name, id, updateURL, dist, version } = this.ctx;

    const userData = await readJSON(
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
      },
    };

    const data: Manifest = toMerged(userData, template);
    this.logger.debug("manifest: ", JSON.stringify(data, null, 2));

    outputJSON(`${dist}/addon/manifest.json`, data, { spaces: 2 });
  }

  async prepareLocaleFiles() {
    const { dist, namespace, build } = this.ctx;

    // https://regex101.com/r/lQ9x5p/1
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const MESSAGE_REG = /^(?<message>[a-z]\S*)( *= *)(?<pattern>.*)$/gim;
    const I10NID_REG = new RegExp(`(data-l10n-id)="((?!${namespace})\\S*)"`, "g");

    // Walk the sub folders of `build/addon/locale`
    const localeNames = (await glob(`${dist}/addon/locale/*`, { onlyDirectories: true }))
      .map(locale => basename(locale));
    this.logger.debug("locale names: ", localeNames);

    const Messages = new Map<string, Set<string>>();
    for (const localeName of localeNames) {
      // Prefix Fluent messages in each ftl, add message to set.
      const MessageInThisLang = new Set<string>();
      const ftlPaths = await glob(`${dist}/addon/locale/${localeName}/**/*.ftl`);
      await Promise.all(ftlPaths.map(async (ftlPath: string) => {
        const ftlContent = await readFile(ftlPath, "utf-8");
        const matchs = [...ftlContent.matchAll(MESSAGE_REG)];
        const newFtlContent = matchs.reduce((content, match) => {
          if (!match.groups?.message)
            return content;
          MessageInThisLang.add(match.groups.message);
          return content.replace(match.groups.message, `${namespace}-${match.groups.message}`);
        }, ftlContent);

        // If prefixFluentMessages===true, we save the changed ftl file,
        // otherwise discard the changes
        if (build.fluent.prefixFluentMessages)
          await writeFile(ftlPath, newFtlContent);

        // rename *.ftl to addonRef-*.ftl
        if (build.fluent.prefixLocaleFiles === true) {
          await move(ftlPath, `${dirname(ftlPath)}/${namespace}-${basename(ftlPath)}`);
          this.logger.debug(`Prefix filename: ${ftlPath}`);
        }
      }));
      Messages.set(localeName, MessageInThisLang);
    }

    // Prefix Fluent messages in xhtml
    const MessagesInHTML = new Set<string>();
    const htmlPaths = await glob([
      `${dist}/addon/**/*.xhtml`,
      `${dist}/addon/**/*.html`,
    ]);
    await Promise.all(htmlPaths.map(async (htmlPath) => {
      const content = await readFile(htmlPath, "utf-8");
      const matches = [...content.matchAll(I10NID_REG)];
      const newHtmlContent = matches.reduce((result, match) => {
        const [matched, attrKey, attrVal] = match;
        MessagesInHTML.add(attrVal);
        return result.replace(
          matched,
          `${attrKey}="${namespace}-${attrVal}"`,
        );
      }, content);

      if (build.fluent.prefixFluentMessages)
        await writeFile(htmlPath, newHtmlContent);
    }));

    // Check miss
    MessagesInHTML.forEach((messageInHTML) => {
      // Cross check in diff locale

      // Check ids in HTML but not in ftl
      const miss = new Set();
      Messages.forEach((messagesInThisLang, lang) => {
        if (!messagesInThisLang.has(messageInHTML))
          miss.add(lang);
      });
      if (miss.size !== 0)
        this.logger.warn(`FTL message "${messageInHTML}" don't exist in "${[...miss].join(", ")}"`);
    });
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

  async makeUpdateJson() {
    const { dist, xpiName, id, version, xpiDownloadLink, build } = this.ctx;

    const manifest = await readJSON(
      `${dist}/addon/manifest.json`,
    ) as Manifest;
    const min = manifest.applications?.zotero?.strict_min_version;
    const max = manifest.applications?.zotero?.strict_max_version;

    const updateHash = await generateHash(`${dist}/${xpiName}.xpi`, "sha512");

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

    await writeJson(`${dist}/update-beta.json`, data, { spaces: 2 });
    if (!this.isPreRelease)
      await writeJson(`${dist}/update.json`, data, { spaces: 2 });

    this.logger.debug(
      `Prepare Update.json for ${
        this.isPreRelease
          ? "\u001B[31m Prerelease \u001B[0m"
          : "\u001B[32m Release \u001B[0m"
      }`,
    );
  }

  async pack() {
    const { dist, xpiName } = this.ctx;

    const zip = new AdmZip();

    // const paths = globSync("**", { cwd: `${dist}/addon`, dot: true });
    // paths.forEach((relativePath) => {
    //   const absolutePath = path.resolve(`${dist}/addon`, relativePath);
    //   zip.addLocalFile(absolutePath, path.dirname(relativePath));
    // });
    zip.addLocalFolder(`${dist}/addon`);
    zip.writeZip(`${dist}/${xpiName}.xpi`);
  }
}
