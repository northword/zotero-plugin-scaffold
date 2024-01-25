import { Config } from "../types.js";
import { generateHashSync } from "../utils/crypto.js";
import { LibBase } from "../utils/libBase.js";
import { dateFormat } from "../utils/string.js";
import chalk from "chalk";
import { zip } from "compressing";
import { buildSync } from "esbuild";
import glob from "fast-glob";
import fs from "fs-extra";
import _ from "lodash";
import path from "path";
import replaceInFile from "replace-in-file";
import webext from "web-ext";

const { replaceInFileSync } = replaceInFile;

export default class Build extends LibBase {
  private buildTime: string;
  private isPreRelease: boolean;
  constructor(config: Config) {
    super(config);
    this.buildTime = "";
    this.isPreRelease = this.version.includes("-");
  }

  /**
   * Default build runner
   */
  async run() {
    const t = new Date();
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", t);
    this.logger.info(
      `Building version ${chalk.blue(this.version)} to ${chalk.blue(this.config.dist)} at ${chalk.blue(this.buildTime)} in ${chalk.blue(process.env.NODE_ENV)} mode.`,
    );

    fs.emptyDirSync(this.config.dist);
    this.copyAssets();

    this.logger.debug("Preparing manifest...");
    this.makeManifest();
    this.makebootstrap();

    this.logger.debug("Preparing locale files...");
    this.prepareLocaleFiles();

    this.logger.debug("Replacing...");
    this.replaceString();

    this.logger.debug("Running esbuild...");
    this.esbuild();

    this.logger.debug("Running extra builder...");
    await this.config.extraBuilder(this.config);

    this.logger.debug("Addon prepare OK.");

    /**======== build resolved ===========*/

    if (process.env.NODE_ENV === "production") {
      this.logger.debug("Packing Addon...");
      await this.pack();

      this.logger.debug("Preparing update.json...");
      this.makeUpdateJson();
    }

    this.logger.info(
      `Build finished in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
    );
  }

  /**
   * Copys files in `Config.assets` to `Config.dist`
   */
  copyAssets() {
    const files = glob.sync(this.config.assets);
    files.forEach((file) => {
      const newPath = `${this.config.dist}/addon/${file.replace(new RegExp(this.config.source.join("|")), "")}`;
      this.logger.trace(`Copy ${file} to ${newPath}`);
      fs.copySync(file, newPath);
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

  makebootstrap() {
    if (!this.config.makeBootstrap) return;
    fs.copySync(
      path.join(this.config.pkgAbsolute, "template/default/bootstrap.js"),
      `${this.config.dist}/addon/bootstrap.js`,
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
      ...Object.keys(this.config.define).map(
        (k) => new RegExp(`__${k}__`, "g"),
      ),
    );
    replaceTo.push(...Object.values(this.config.define));

    replaceFrom.push(/__buildTime__/g);
    replaceTo.push(this.buildTime);

    const replaceResult = replaceInFileSync({
      files: this.config.assets.map((asset) => `${this.config.dist}/${asset}`),
      from: replaceFrom,
      to: replaceTo,
      countMatches: true,
    });

    this.logger.debug(
      "Run replace in ",
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
              ? `${match[1]}="${this.addonRef}-${match[2]}"`
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
              `${path.dirname(f)}/${this.addonRef}-${path.basename(f)}`,
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
                ? `${this.addonRef}-${line}`
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
          this.logger.error(`${message} don't exist in ${localeName}`);
        }
      });
    }
  }

  esbuild() {
    this.config.esbuildOptions.forEach(async (esbuildOption) => {
      buildSync(esbuildOption);
    });
  }

  makeUpdateJson() {
    fs.writeJsonSync(
      `${this.config.dist}/update-beta.json`,
      this.config.makeUpdateJson.template,
      { spaces: 2 },
    );
    fs.writeJsonSync(
      `${this.config.dist}/update.json`,
      this.config.makeUpdateJson.template,
      { spaces: 2 },
    );

    const updateHash = generateHashSync(
      path.join(this.config.dist, `${this.xpiName}.xpi`),
      "sha512",
    );

    const replaceResult = replaceInFileSync({
      files: [
        `${this.config.dist}/update-beta.json`,
        `${this.config.dist}/${this.isPreRelease ? "pass" : "update.json"}`,
      ],
      from: [
        /__addonID__/g,
        /__version__/g,
        /__updateLink__/g,
        /__updateHash__/g,
      ],
      to: [this.addonID, this.version, this.updateLink, updateHash],
      countMatches: true,
    });

    this.logger.debug(
      `Prepare Update.json for ${
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
      path.join(this.config.dist, `${this.xpiName}.xpi`),
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

  // private get version() {
  //   return this.config.define.buildVersion;
  // }
  // private get addonName() {
  //   return this.config.define.addonName;
  // }
  // private get addonID() {
  //   return this.config.define.addonID;
  // }
  // private get addonRef() {
  //   return this.config.define.addonRef;
  // }
  // private get addonInstence() {
  //   return this.config.define.addonInstance;
  // }
  // private get updateLink() {
  //   return this.config.define.updateLink;
  // }
  // private get updateURL() {
  //   return this.config.define.updateURL;
  // }
  // private get xpiName() {
  //   return this.config.define.xpiName;
  // }
}
