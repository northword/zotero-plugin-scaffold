import { Config } from "./config.js";
import { Logger, dateFormat } from "./utils.js";
import { zip } from "compressing";
import { buildSync } from "esbuild";
import * as fs from "fs-extra";
import { globSync } from "glob";
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
    this.mode = mode;
    this.pkg = this.getPkg();
    this.isPreRelease = this.version.includes("-");
  }

  run() {
    const t = new Date();
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", t);
    Logger.info(
      `[Build] BUILD_DIR=${this.config.dist}, VERSION=${this.pkg.version}, BUILD_TIME=${this.buildTime}, MODE=${this.mode}`,
    );

    fs.emptyDirSync(this.config.dist);
    this.copyAssets();

    Logger.debug("[Build] Replacing");
    this.replaceString();

    Logger.debug("[Build] Preparing locale files");
    this.prepareLocaleFiles();

    Logger.debug("[Build] Running esbuild");
    this.esbuild();

    Logger.debug("[Build] Addon prepare OK");

    if (this.mode === "production") {
      Logger.debug("[Build] Packing Addon");
      this.pack();

      this.prepareUpdateJson();

      Logger.debug(
        `[Build] Finished in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
      );
    }
  }

  copyAssets() {
    const files = globSync(this.config.assets, {});
    files.forEach((file) => {
      fs.copySync(file, `${this.config.dist}/${file}`);
    });
  }

  replaceString() {
    const replaceFrom = [
      /__author__/g,
      /__description__/g,
      /__homepage__/g,
      /__buildVersion__/g,
      /__buildTime__/g,
    ];
    const replaceTo = [
      this.pkg.author,
      this.pkg.description,
      this.pkg.homepage,
      this.pkg.version,
      this.buildTime,
    ];

    this.config.placeholders.updateJSON = this.isPreRelease
      ? this.config.placeholders.updateJSON.replace(
          "update.json",
          "update-beta.json",
        )
      : this.config.placeholders.updateJSON;

    replaceFrom.push(
      ...Object.keys(this.config.placeholders).map(
        (k) => new RegExp(`__${k}__`, "g"),
      ),
    );
    replaceTo.push(...Object.values(this.config.placeholders));

    const replaceResult = replaceInFileSync({
      files: this.config.assets.map((asset) => `${this.config.dist}/${asset}`),
      from: replaceFrom,
      to: replaceTo,
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
    const localeNames = globSync(`${this.config.dist}/addon/locale/*/`, {}).map(
      (locale) => path.basename(locale),
    );

    for (const localeName of localeNames) {
      // rename *.ftl to addonRef-*.ftl
      if (this.config.fluent.prefixLocaleFiles == true) {
        globSync(
          `${this.config.dist}/addon/locale/${localeName}/**/*.ftl`,
          {},
        ).forEach((f) => {
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

  prepareUpdateJson() {
    // If it is a pre-release, use update-beta.json
    if (!this.isPreRelease) {
      fs.copySync("scripts/update-template.json", "update.json");
    }
    if (fs.existsSync("update-beta.json") || this.isPreRelease) {
      fs.copySync("scripts/update-template.json", "update-beta.json");
    }

    const updateLink = `https://github.com/${this.repo}/release/download/v${this.version}/${this.pkg.name}.xpi`;

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

  private getPkg() {
    const pkg = fs.readFileSync(path.join(process.cwd(), "package.json"), {
      encoding: "utf-8",
    });
    return JSON.parse(pkg);
  }

  private get version() {
    return this.pkg.version ?? "";
  }

  private get repo() {
    const repo = this.pkg.repo ?? "";
    return "";
  }
}
