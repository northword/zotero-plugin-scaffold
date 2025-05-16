import type { Context } from "../types/index.js";
import type { Manifest } from "../types/manifest.js";
import type { UpdateJSON } from "../types/update-json.js";
import { resolve } from "node:path";
import process from "node:process";
import AdmZip from "adm-zip";
import { toMerged } from "es-toolkit";
import { build as buildAsync } from "esbuild";
import { copy, emptyDir, outputJSON, readJSON, writeJson } from "fs-extra/esm";
import styleText from "node-style-text";
import { glob } from "tinyglobby";
import { generateHash } from "../utils/crypto.js";
import { dateFormat, replaceInFile, toArray } from "../utils/string.js";
import { Base } from "./base.js";
import buildLocale from "./builder/fluent.js";
import buildPrefs from "./builder/prefs.js";

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
    const { dist } = this.ctx;
    await buildPrefs(dist, this.ctx.build.prefs);
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

  exit() {}
}
