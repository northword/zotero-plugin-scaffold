import type { Context } from "../types/index.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import chokidar from "chokidar";
import { debounce } from "es-toolkit";
import { ZoteroRunner } from "../utils/zotero-runner.js";
import { Base } from "./base.js";
import Build from "./builder.js";

export default class Serve extends Base {
  private builder: Build;
  private runner?: ZoteroRunner;

  private _zoteroBinPath?: string;
  private _profilePath?: string;

  constructor(ctx: Context) {
    super(ctx);
    process.env.NODE_ENV ??= "development";
    this.builder = new Build(ctx);
  }

  async run() {
    // Handle interrupt signal (Ctrl+C) to gracefully terminate Zotero process
    // Must be placed at the top to prioritize registration of events to prevent web-ext interference
    process.on("SIGINT", this.exit);

    this.runner = new ZoteroRunner({
      binaryPath: this.zoteroBinPath,
      profilePath: this.profilePath,
      dataDir: this.dataDir,
      plugins: [{
        id: this.ctx.id,
        sourceDir: join(this.ctx.dist, "addon"),
      }],
      asProxy: this.ctx.server.asProxy,
      devtools: this.ctx.server.devtools,
      binaryArgs: this.ctx.server.startArgs,
    });

    await this.ctx.hooks.callHook("serve:init", this.ctx);

    // prebuild
    await this.builder.run();
    await this.ctx.hooks.callHook("serve:prebuild", this.ctx);

    // start Zotero
    await this.runner.run();
    this.runner.zotero?.on("exit", this.onZoteroExit);
    this.runner.zotero?.on("close", this.onZoteroExit);

    // watch
    await this.watch();
  }

  /**
   * watch source dir and build when file changed
   */
  async watch() {
    const { source } = this.ctx;

    const watcher = chokidar.watch(source, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
    });

    const onChangeDebounced = debounce(async (path: string) => {
      await this.onChange(path).catch((err) => {
        // Do not abort the watcher when errors occur
        // in builds triggered by the watcher.
        this.logger.error(err);
      });
    }, 500);

    watcher
      .on("ready", async () => {
        await this.ctx.hooks.callHook("serve:ready", this.ctx);
        this.logger.clear();
        this.logger.ready("Server Ready!");
      })
      .on("change", async (path) => {
        this.logger.clear();
        this.logger.info(`${path} changed`);
        await onChangeDebounced(path);
      })
      .on("error", (err) => {
        this.logger.error("Server start failed!", err);
      });
  }

  async onChange(path: string) {
    await this.ctx.hooks.callHook("serve:onChanged", this.ctx, path);

    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      await this.builder.esbuild();
    }
    else {
      await this.builder.run();
    }

    await this.reload();
  }

  async reload() {
    this.logger.tip("Reloading...");
    await this.runner?.reloadAllPlugins();
    await this.ctx.hooks.callHook("serve:onReloaded", this.ctx);
  }

  // Use arrow functions to keep `this`
  exit = () => {
    this.logger.info("Server shutdown by user request.");
    this.runner?.exit();
    this.ctx.hooks.callHook("serve:exit", this.ctx);
    process.exit();
  };

  private onZoteroExit = (_code?: number | null, _signal?: any) => {
    this.logger.info(`Zotero terminated.`);
    process.exit();
  };

  get zoteroBinPath() {
    if (this._zoteroBinPath)
      return this._zoteroBinPath;

    this._zoteroBinPath = process.env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH;
    if (!this._zoteroBinPath || !existsSync(this._zoteroBinPath))
      throw new Error("The Zotero binary not found.");

    return this._zoteroBinPath;
  }

  get profilePath() {
    if (this._profilePath)
      return this._profilePath;

    this._profilePath = process.env.ZOTERO_PLUGIN_PROFILE_PATH;
    if (!this._profilePath || !existsSync(this._profilePath))
      throw new Error("The Zotero profile not found.");

    return this._profilePath;
  }

  get dataDir() {
    return process.env.ZOTERO_PLUGIN_DATA_DIR ?? "";
  }
}