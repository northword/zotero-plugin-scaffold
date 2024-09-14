import type { WebExtRunInstance } from "web-ext";
import type { Context } from "../../types/index.js";
import { resolve } from "node:path";
import { env } from "node:process";
import webext from "web-ext";
import { patchWebExtLogger } from "../../utils/log.js";
import { ServeBase } from "./base.js";

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
    await patchWebExtLogger(this.ctx);

    const { dist } = this.ctx;
    const runner = await webext.cmd.run(
      {
        firefox: this.zoteroBinPath,
        firefoxProfile: this.profilePath,
        sourceDir: resolve(`${dist}/addon`),
        keepProfileChanges: true,
        args: this.startArgs,
        pref: { "extensions.experiments.enabled": true },
        // Use Zotero's devtools instead
        browserConsole: false,
        devtools: false,
        noInput: true,
        // Scaffold handles reloads, so disable auto-reload behaviors in web-ext
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

  async reload() {
    await this._runner?.reloadAllExtensions();
    // "Last extension reload: ..." log doesn't print a newline, so we need to add one.
    this.logger.newLine();
  }

  exit() {
    this._runner?.exit();
  }
}
