import { Config } from "../types.js";
import { Logger } from "../utils/logger.js";
import { dateFormat } from "../utils/string.js";
import { zip } from "compressing";
import { buildSync } from "esbuild";
import { default as glob } from "fast-glob";
import { default as fs } from "fs-extra";
import _ from "lodash";
import path from "path";
import replaceInFile from "replace-in-file";
import webext from "web-ext";

const { replaceInFileSync } = replaceInFile;

export default class Build {
  private config: Config;
  private buildTime: string;
  private mode: "production" | "development";
  private pkg: any;
  private isPreRelease: boolean;
  constructor(config: Config, mode: "production" | "development") {
    this.config = config;
    this.buildTime = "";
    this.mode = process.env.NODE_ENV = mode;
    this.pkg = this.getPkg();
    this.isPreRelease = this.version.includes("-");
  }

  /**
   * Default build runner
   */
  async run() {
    const t = new Date();
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", t);
    Logger.info(
      `[Build] BUILD_DIR=${this.config.dist}, VERSION=${this.pkg.version}, BUILD_TIME=${this.buildTime}, MODE=${process.env.NODE_ENV}`,
    );

    fs.emptyDirSync(this.config.dist);
    this.copyAssets();

    Logger.debug("[Build] Preparing Manifest");
    this.makeManifest();

    Logger.debug("[Build] Preparing locale files");
    this.prepareLocaleFiles();

    Logger.debug("[Build] Running esbuild");
    this.esbuild();

    Logger.debug("[Build] Replacing");
    this.replaceString();

    await this.config.extraBuilder(this.config);

    Logger.debug("[Build] Addon prepare OK");

    /**======== build resolved ===========*/

    if (this.mode === "production") {
      Logger.debug("[Build] Packing Addon");
      this.pack();
      this.markUpdateJson();
    }

    Logger.debug(
      `[Build] Finished in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
    );
  }

  /**
   * Copys files in `Config.assets` to `Config.dist`
   */
  copyAssets() {
    const files = glob.sync(this.config.assets);
    files.forEach((file) => {
      fs.copySync(
        file,
        `${this.config.dist}/addon/${file.replace(new RegExp(this.config.source.join("|")), "")}`,
      );
    });
  }

  makeManifest() {
    if (!this.config.makeManifest.enable) return;
    fs.outputJSONSync(
      `${this.config.dist}/addon/manifest.json`,
      this.config.makeManifest.template,
      { spaces: 2 },
    );
  }

  /**
   * Replace all `placeholder.key` to `placeholder.value` for all files in `dist`
   */
  replaceString() {
    const replaceFrom: Array<RegExp | string> = [],
      replaceTo: Array<string | any> = [];

    // Config.placeholders has the highest priority
    replaceFrom.push(
      ...Object.keys(this.config.placeholders).map(
        (k) => new RegExp(`__${k}__`, "g"),
      ),
    );
    replaceTo.push(...Object.values(this.config.placeholders));

    replaceFrom.push(/__buildTime__/g);
    replaceTo.push(this.buildTime);

    // // updateJSON uri
    // this.config.placeholders.updateJSON = this.isPreRelease
    //   ? this.config.placeholders.updateJSON?.replace(
    //       "update.json",
    //       "update-beta.json",
    //     )
    //   : this.config.placeholders.updateJSON;

    const replaceResult = replaceInFileSync({
      files: this.config.assets.map((asset) => `${this.config.dist}/${asset}`),
      from: _.uniq(replaceFrom),
      to: _.uniq(replaceTo),
      countMatches: true,
    });

    Logger.debug(
      "[Build] Run replace in ",
      replaceResult
        .filter((f) => f.hasChanged)
        .map((f) => `${f.file} : ${f.numReplacements} / ${f.numMatches}`),
    );
  }

  prepareLocaleFiles() {
    // Prefix Fluent messages in xhtml
    const MessagesInHTML = new Set();
    replaceInFileSync({
      files: [
        `${this.config.dist}/addon/**/*.xhtml`,
        `${this.config.dist}/addon/**/*.html`,
      ],
      // @ts-expect-error ReplaceInFileConfig has processor
      processor: (input) => {
        const matchs = [...input.matchAll(/(data-l10n-id)="(\S*)"/g)];
        matchs.map((match) => {
          input = input.replace(
            match[0],
            this.config.fluent.prefixFluentMessages == true
              ? `${match[1]}="${this.config.placeholders.addonRef}-${match[2]}"`
              : match[0],
          );
          MessagesInHTML.add(match[2]);
        });
        return input;
      },
    });

    // Walk the sub folders of `build/addon/locale`
    const localeNames = glob
      .sync(`${this.config.dist}/addon/locale/*/`, {})
      .map((locale) => path.basename(locale));

    for (const localeName of localeNames) {
      // rename *.ftl to addonRef-*.ftl
      if (this.config.fluent.prefixLocaleFiles == true) {
        glob
          .sync(`${this.config.dist}/addon/locale/${localeName}/**/*.ftl`, {})
          .forEach((f) => {
            fs.moveSync(
              f,
              `${path.dirname(f)}/${this.config.placeholders.addonRef}-${path.basename(f)}`,
            );
          });
      }

      // Prefix Fluent messages in each ftl
      const MessageInThisLang = new Set();
      replaceInFileSync({
        files: [`${this.config.dist}/addon/locale/${localeName}/**/*.ftl`],
        // @ts-expect-error ReplaceInFileConfig has processor
        processor: (fltContent) => {
          const lines = fltContent.split("\n");
          const prefixedLines = lines.map((line: string) => {
            // https://regex101.com/r/lQ9x5p/1
            const match = line.match(
              /^(?<message>[a-zA-Z]\S*)([ ]*=[ ]*)(?<pattern>.*)$/m,
            );
            if (match && match.groups) {
              MessageInThisLang.add(match.groups.message);
              return this.config.fluent.prefixFluentMessages
                ? `${this.config.placeholders.addonRef}-${line}`
                : line;
            } else {
              return line;
            }
          });
          return prefixedLines.join("\n");
        },
      });

      // If a message in xhtml but not in ftl of current language, log it
      MessagesInHTML.forEach((message) => {
        if (!MessageInThisLang.has(message)) {
          Logger.error(`[Build] ${message} don't exist in ${localeName}`);
        }
      });
    }
  }

  esbuild() {
    this.config.esbuildOptions.forEach(async (esbuildOption) => {
      buildSync(esbuildOption);
    });
  }

  markUpdateJson() {
    // If it is a pre-release, use update-beta.json
    if (this.isPreRelease || fs.existsSync("update-beta.json")) {
      // fs.copySync("scripts/update-template.json", "update-beta.json");
      fs.writeJsonSync(
        "update-beta.json",
        this.config.makeUpdateJson.template,
        { spaces: 2 },
      );
    }
    fs.writeJsonSync("update.json", this.config.makeUpdateJson.template, {
      spaces: 2,
    });

    const updateLink = `${this.config.placeholders.releasePage}/release/download/v${this.version}/${this.pkg.name}.xpi`;

    const replaceResult = replaceInFileSync({
      files: [
        "update-beta.json",
        this.isPreRelease ? "pass" : "update.json",
        `${this.config.dist}/addon/manifest.json`,
      ],
      from: [
        /__addonID__/g,
        /__buildVersion__/g,
        /__updateLink__/g,
        /__updateURL__/g,
      ],
      to: [
        this.config.placeholders.addonID,
        this.version,
        updateLink,
        this.config.placeholders.updateJSON,
      ],
      countMatches: true,
    });

    Logger.debug(
      `[Build] Prepare Update.json for ${
        this.isPreRelease
          ? "\u001b[31m Prerelease \u001b[0m"
          : "\u001b[32m Release \u001b[0m"
      }`,
      replaceResult
        .filter((f) => f.hasChanged)
        .map((f) => `${f.file} : ${f.numReplacements} / ${f.numMatches}`),
    );
  }

  async pack() {
    await zip.compressDir(
      path.join(this.config.dist, "addon"),
      path.join(this.config.dist, `${this.pkg.name}.xpi`),
      {
        ignoreBase: true,
      },
    );
    // await webext.cmd.build({
    //   sourceDir: `${this.config.dist}/addon`,
    //   artifactsDir: this.config.dist,
    //   filename: `${this.pkg.name ?? "name"}.xpi`,
    // });
  }

  /**
   * Get plugin's package.json
   * @returns object of package.json
   */
  private getPkg() {
    return fs.readJsonSync(path.join(process.cwd(), "package.json"), {
      encoding: "utf-8",
    });
  }

  /**
   * Get plugin's version defined in package.json
   * @returns plugin's current version
   */
  private get version() {
    return this.pkg.version ?? "";
  }

  private get repo() {
    const repo = this.pkg.repo ?? "";
    return repo.replace(".git", "");
  }
}
