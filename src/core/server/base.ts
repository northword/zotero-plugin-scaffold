import { env } from "node:process";
import type { ChildProcess, ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import type { Context } from "../../types/index.js";
import { Base } from "../base.js";

export abstract class ServeBase extends Base {
  private _zoteroBinPath?: string;
  private _profilePath?: string;
  constructor(ctx: Context) {
    super(ctx);
    env.NODE_ENV ??= "development";
  }

  abstract run(): void;
  abstract start(): ChildProcess | Promise<ChildProcessWithoutNullStreams>;
  abstract reload(): void;
  abstract exit(): void;

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
