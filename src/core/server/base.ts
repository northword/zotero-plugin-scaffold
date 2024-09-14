import type { Context } from "../../types/index.js";
import { existsSync } from "node:fs";
import { env, exit } from "node:process";
import { Base } from "../base.js";

export abstract class ServeBase extends Base {
  private _zoteroBinPath?: string;
  private _profilePath?: string;
  constructor(ctx: Context) {
    super(ctx);
    env.NODE_ENV ??= "development";
  }

  abstract run(): void;
  abstract start(): any;
  abstract reload(): void | Promise<void>;
  abstract exit(): void;

  get startArgs() {
    const { server } = this.ctx;

    const startArgs = [
      ...server.startArgs,
      "--purgecaches",
    ];
    if (server.devtools)
      startArgs.push("--jsdebugger");

    return startArgs;
  }

  get onZoteroExit() {
    return (_code?: number | null, _signal?: any) => {
      this.logger.info(`Zotero terminated.`);
      exit();
    };
  }

  get zoteroBinPath() {
    if (this._zoteroBinPath)
      return this._zoteroBinPath;

    this._zoteroBinPath = env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH;
    if (!this._zoteroBinPath || !existsSync(this._zoteroBinPath))
      throw new Error("The Zotero binary not found.");

    return this._zoteroBinPath;
  }

  get profilePath() {
    if (this._profilePath)
      return this._profilePath;

    this._profilePath = env.ZOTERO_PLUGIN_PROFILE_PATH;
    if (!this._profilePath || !existsSync(this._profilePath))
      throw new Error("The Zotero profile not found.");

    return this._profilePath;
  }

  get dataDir() {
    return env.ZOTERO_PLUGIN_DATA_DIR ?? "";
  }
}
