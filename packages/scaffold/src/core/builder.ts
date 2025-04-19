import type { Context } from "../types/index.js";
import type { Manifest } from "../types/manifest.js";
import type { UpdateJSON } from "../types/update-json.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import AdmZip from "adm-zip";
import { toMerged } from "es-toolkit";
import { build as buildAsync } from "esbuild";
import { copy, emptyDir, outputFile, outputJSON, readJSON, writeJson } from "fs-extra/esm";
import styleText from "node-style-text";
import { glob } from "tinyglobby";
import { generateHash } from "../utils/crypto.js";
import { is32BitNumber } from "../utils/number.js";
import { PrefsManager, renderPluginPrefsDts } from "../utils/prefs-manager.js";
import { dateFormat, replaceInFile, toArray } from "../utils/string.js";
import { Base } from "./base.js";
import buildLocale from "./builder/fluent.js";

export default class Build extends Base {
  private buildTime: string;
  private isPreRelease: boolean;
  constructor(ctx: Context) {
    super(ctx);
    process.env.NODE_ENV ??= "production";
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
      `Building version ${styleText.blue(version)} to ${styleText.blue(dist)} at ${styleText.blue(this.buildTime)} in ${styleText.blue(process.env.NODE_ENV)} mode.`,
    );
    await this.ctx.hooks.callHook("build:init", this.ctx);

    await emptyDir(dist);
    await this.ctx.hooks.callHook("build:mkdir", this.ctx);

    this.logger.tip("Preparing static assets", { space: 1 });
    await this.makeAssets();
    await this.ctx.hooks.callHook("build:copyAssets", this.ctx);

    this.logger.debug("Preparing manifest", { space: 2 });
    await this.makeManifest();
    await this.ctx.hooks.callHook("build:makeManifest", this.ctx);

    this.logger.debug("Preparing locale files", { space: 2 });
    await this.prepareLocaleFiles();
    await this.ctx.hooks.callHook("build:fluent", this.ctx);

    await this.preparePrefs();

    this.logger.tip("Bundling scripts", { space: 1 });
    await this.esbuild();
    await this.ctx.hooks.callHook("build:bundle", this.ctx);

    /** ======== build resolved =========== */

    if (process.env.NODE_ENV === "production") {
      this.logger.tip("Packing plugin", { space: 1 });
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
    const paths = await glob(assets, { ignore: ["node_modules", ".git", dist] });
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
    this.logger.debug(`replace map: ${replaceMap}`);
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
        zotero: {
          id,
          update_url: updateURL,
        },
      },
    };

    const data: Manifest = toMerged(userData, template);
    this.logger.debug(`manifest: ${JSON.stringify(data, null, 2)}`);

    outputJSON(`${dist}/addon/manifest.json`, data, { spaces: 2 });
  }

  async prepareLocaleFiles() {
    const { dist, namespace, build } = this.ctx;
    await buildLocale(dist, namespace, build.fluent);
  }

  async preparePrefs() {
    const { dts, prefixPrefKeys, prefix } = this.ctx.build.prefs;
    const { dist } = this.ctx;

    // Skip if not enable this builder
    if (!prefixPrefKeys && !dts)
      return;

    // Skip if no prefs.js
    const prefsFilePath = join(dist, "addon", "prefs.js");
    if (!existsSync(prefsFilePath))
      return;

    // Parse prefs.js
    const prefsManager = new PrefsManager("pref");
    await prefsManager.read(prefsFilePath);
    const prefsWithPrefix = prefsManager.getPrefsWithPrefix(prefix);
    const prefsWithoutPrefix = prefsManager.getPrefsWithoutPrefix(prefix);

    // Checks if the preference value for the number type is less than 32 bits.
    // Since the underlying Preference is implemented in C++,
    // although firefox specifies the preference value for the number type as long int,
    // the length of long int is different on each operating system.
    // e.g. on Windows x64:
    // Zotero Prefs.set("extensions.test.number" 22222222222222222)
    // zotero.Prefs.get("extensions.test.number") // return 1383176888 but expected 22222222222222222
    const prefs = prefsManager.getPrefs();
    Object.entries(prefs).forEach(([key, value]) => {
      if (typeof value === "number") {
        if (!is32BitNumber(value)) {
          this.logger.warn(`Pref key '${styleText.blue(key)}' is a number, but is more than 4 bytes, which can be problematic on some OS.`);
        }
      }
    });

    // Generate prefs.d.ts
    if (dts) {
      const dtsContent = renderPluginPrefsDts(prefsWithoutPrefix);
      await outputFile(dts, dtsContent, "utf-8");
    }

    // Generate prefixed prefs.js
    if (prefixPrefKeys) {
      prefsManager.clearPrefs();
      prefsManager.setPrefs(prefsWithPrefix);
      await prefsManager.write(prefsFilePath);
    }

    // Prefix pref keys in xhtml
    if (prefixPrefKeys) {
      const HTML_PREFERENCE_PATTERN = /preference="(\S*)"/g;
      const xhtmlPaths = await glob(`${dist}/addon/**/*.xhtml`);
      await Promise.all(xhtmlPaths.map(async (path) => {
        let content = await readFile(path, "utf-8");
        const matchs = [...content.matchAll(HTML_PREFERENCE_PATTERN)];
        for (const match of matchs) {
          const [matched, key] = match;
          if (key.startsWith(prefix)) {
            this.logger.debug(`Pref key '${styleText.blue(key)}' is already starts with '${prefix}', skip prefixing it.`);
            continue;
          }
          else if (key.startsWith("extensions.")) {
            this.logger.warn(`Pref key '${styleText.blue(key)}' in ${styleText.gray(path)} starts with 'extensions.' but not '${styleText.blue(prefix)}', skip prefixing it.`);
            continue;
          }
          else if (!(key in prefsWithPrefix) && !(key in prefsWithoutPrefix)) {
            this.logger.warn(`Pref key '${styleText.blue(key)}' in ${styleText.gray(path)} is not found in prefs.js, skip prefixing it.`);
            continue;
          }
          else {
            const prefixed = `${prefix}.${key}`;
            this.logger.debug(`Pref key '${styleText.blue(key)}' in ${styleText.gray(path)} is prefixed to ${styleText.blue(prefixed)}.`);
            content = content.replace(matched, `preference="${prefixed}"`);
          }
        }
        await outputFile(path, content, "utf-8");
      }));
    }
  }

  esbuild() {
    const { dist, build: { esbuildOptions } } = this.ctx;
    const distAbsolute = resolve(dist);

    if (esbuildOptions.length === 0)
      return;

    // ensure outfile and outdir are in dist folder
    esbuildOptions.map((option, i) => {
      if (option.outfile && !resolve(option.outfile).startsWith(distAbsolute)) {
        this.logger.debug(`'outfile' of esbuildOptions[${i}] is not in dist folder, it will be overwritten.`);
        option.outfile = `${dist}/${option.outfile}`;
      }
      if (option.outdir && !resolve(option.outdir).startsWith(distAbsolute)) {
        this.logger.debug(`'outdir' of esbuildOptions[${i}] is not in dist folder, it will be overwritten.`);
        option.outdir = `${dist}/${option.outdir}`;
      }
      return option;
    });

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
                  ...(min && { strict_min_version: min }),
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
    zip.addLocalFolder(`${dist}/addon`);
    zip.writeZip(`${dist}/${xpiName}.xpi`);
  }
}
