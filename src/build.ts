import { Config } from "./config";
import {
  clearFolder,
  copyFileSync,
  copyFolderRecursiveSync,
  dateFormat,
} from "./utils/io";
import { Logger } from "./utils/logger";
import { zip } from "compressing";
import { build } from "esbuild";
import { existsSync, readFileSync, readdirSync, renameSync } from "fs";
import path from "path";
import replaceInFile from "replace-in-file";

const { replaceInFileSync } = replaceInFile;

export class Build {
  private config: Config;
  private buildTime: string;
  private mode: "production" | "development";
  private pkg: any;
  private isPreRelease: boolean;
  constructor(config: Config, mode: "production" | "development") {
    this.config = config;
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", new Date());
    this.mode = mode;
    this.pkg = this.getPkg();
    this.isPreRelease = this.version.includes("-");
  }

  async build() {
    const t = new Date();
    this.buildTime = dateFormat("YYYY-mm-dd HH:MM:SS", t);

    Logger.info(
      `[Build] BUILD_DIR=${this.config.dist}, VERSION=${this.pkg.version}, BUILD_TIME=${this.buildTime}, MODE=${this.mode}`,
    );

    clearFolder(this.config.dist);
    copyFolderRecursiveSync("addon", this.config.dist);

    Logger.debug("[Build] Replacing");
    this.replaceString();

    Logger.debug("[Build] Preparing locale files");
    this.prepareLocaleFiles();

    Logger.debug("[Build] Running esbuild");
    await this.esbuild();

    Logger.debug("[Build] Addon prepare OK");

    if (process.env.NODE_ENV === "production") {
      Logger.debug("[Build] Packing Addon");
      await zip.compressDir(
        path.join(this.config.dist, "addon"),
        path.join(this.config.dist, `${name}.xpi`),
        {
          ignoreBase: true,
        },
      );

      //   prepareUpdateJson();

      Logger.debug(
        `[Build] Finished in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
      );
    }
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

    this.config.addon.updateJSON = this.isPreRelease
      ? this.config.addon.updateJSON.replace("update.json", "update-beta.json")
      : this.config.addon.updateJSON;

    replaceFrom.push(
      ...Object.keys(this.config.addon).map((k) => new RegExp(`__${k}__`, "g")),
    );
    replaceTo.push(...Object.values(this.config.addon));

    replaceFrom.push(
      ...Object.keys(this.config.stringsToReplace).map(
        (k) => new RegExp(`__${k}__`, "g"),
      ),
    );
    replaceTo.push(...Object.values(this.config.stringsToReplace));

    const replaceResult = replaceInFileSync({
      files: [
        `${this.config.dist}/addon/**/*.xhtml`,
        `${this.config.dist}/addon/**/*.html`,
        `${this.config.dist}/addon/**/*.css`,
        `${this.config.dist}/addon/**/*.json`,
        `${this.config.dist}/addon/prefs.js`,
        `${this.config.dist}/addon/manifest.json`,
        `${this.config.dist}/addon/bootstrap.js`,
      ],
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
            `${match[1]}="${this.config.addon.addonRef}-${match[2]}"`,
          );
          MessagesInHTML.add(match[2]);
        });
        return input;
      },
    });

    // Walk the sub folders of `build/addon/locale`
    const localesPath = path.join(this.config.dist, "addon/locale"),
      localeNames = readdirSync(localesPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

    for (const localeName of localeNames) {
      const localePath = path.join(localesPath, localeName);
      const ftlFiles = readdirSync(localePath, {
        withFileTypes: true,
      })
        .filter((dirent) => dirent.isFile())
        .map((dirent) => dirent.name);

      // rename *.ftl to addonRef-*.ftl
      for (const ftlFile of ftlFiles) {
        if (ftlFile.endsWith(".ftl")) {
          renameSync(
            path.join(localePath, ftlFile),
            path.join(localePath, `${this.config.addon.addonRef}-${ftlFile}`),
          );
        }
      }

      // Prefix Fluent messages in each ftl
      const MessageInThisLang = new Set();
      replaceInFileSync({
        files: [`${this.config.dist}/addon/locale/${localeName}/*.ftl`],
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
              return `${this.config.addon.addonRef}-${line}`;
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

  async esbuild() {
    this.config.esbuildOptions.forEach(async (esbuildOption) => {
      await build(esbuildOption);
    });
  }

  prepareUpdateJson() {
    // If it is a pre-release, use update-beta.json
    if (!this.isPreRelease) {
      copyFileSync("scripts/update-template.json", "update.json");
    }
    if (existsSync("update-beta.json") || this.isPreRelease) {
      copyFileSync("scripts/update-template.json", "update-beta.json");
    }

    const updateLink = `https://github.com/${this.repo}/release/download/v${this.version}/${name}.xpi`;

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
        this.config.addon.addonID,
        this.version,
        updateLink,
        this.config.addon.updateJSON,
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

  private getPkg() {
    const pkg = readFileSync(path.join(process.cwd(), "package.json"), {
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
