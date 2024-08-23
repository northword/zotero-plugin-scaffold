import path from "node:path";
import { env } from "node:process";
import type { WebExtRunInstance } from "web-ext";
import webext from "web-ext";
import type { Context } from "../../types/index.js";
import { ServeBase } from "./base.js";

// https://github.com/mozilla/web-ext/blob/e37e60a2738478f512f1255c537133321f301771/src/util/logger.js#L12
// const DEBUG_LOG_LEVEL = 20;
const INFO_LOG_LEVEL = 30;
const WARN_LOG_LEVEL = 40;
const ERROR_LOG_LEVEL = 50;

export default class RunnerWebExt extends ServeBase {
  private _runner?: WebExtRunInstance;
  constructor(ctx: Context) {
    super(ctx);
    env.NODE_ENV ??= "development";
  }

  async run() {
    await this.start();
  }

  async start() {
    // Use the scaffold's logger instead of web-ext's built-in one.
    const webExtLogger = await import("web-ext/util/logger");
    webExtLogger.consoleStream.write = ({ level, msg, name }) => {
      if (level >= ERROR_LOG_LEVEL)
        this.logger.error(name, msg);
      if (level >= WARN_LOG_LEVEL)
        this.logger.warn(msg);
      if (level >= INFO_LOG_LEVEL)
        // Discard web-ext's debug log becaule web-ext's debug have firefox's stdout and stderr,
        // and set web-ext's info to scaffold' debug
        this.logger.debug(msg);
    };

    const { dist } = this.ctx;
    const runner = await webext.cmd.run(
      {
        firefox: this.zoteroBinPath,
        firefoxProfile: this.profilePath,
        sourceDir: path.resolve(`${dist}/addon`),
        keepProfileChanges: true,
        args: this.startArgs,
        pref: { "extensions.experiments.enabled": true },
        // Use Zotero's devtools instead
        browserConsole: false,
        devtools: false,
        noInput: true,
        noReload: true,
      },
      {
        // These are non CLI related options for each function.
        // You need to specify this one so that your NodeJS application
        // can continue running after web-ext is finished.
        shouldExitProgram: false,
      },
    );
    this._runner = runner;
    this._runner.registerCleanup(this.onZoteroExit);
  }

  reload() {
    this._runner?.reloadAllExtensions();
    // "Last extension reload: ..." log doesn't print a newline, so we need to add one.
    this.logger.newLine();
  }

  exit() {
    this._runner?.exit();
  }
}
