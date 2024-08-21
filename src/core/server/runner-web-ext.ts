import path from "node:path";
import process from "node:process";
import type { ChildProcess } from "node:child_process";
import webext from "web-ext";
import type { Context } from "../../types/index.js";
import { ServeBase } from "./base.js";

export default class RunnerWebExt extends ServeBase {
  private _process?: ChildProcess;
  constructor(ctx: Context) {
    super(ctx);
    process.env.NODE_ENV ??= "development";
  }

  async run() {
    await this.start();
  }

  /**
   * start zotero with plugin installed and reload when dist changed
   */
  async start() {
    const { dist } = this.ctx;
    return await webext.cmd.run(
      {
        firefox: this.zoteroBinPath,
        firefoxProfile: this.profilePath,
        sourceDir: path.resolve(`${dist}/addon`),
        keepProfileChanges: true,
        args: this.ctx.server.startArgs,
        pref: { "extensions.experiments.enabled": true },
        // Use Zotero's devtools instead
        browserConsole: false,
        devtools: false,
        noInput: true,
      },
      {
        // These are non CLI related options for each function.
        // You need to specify this one so that your NodeJS application
        // can continue running after web-ext is finished.
        shouldExitProgram: false,
      },
    );
  }

  reload() {
    this.logger.debug("Reloading...");

    //
  }

  exit() {
    this.logger.info("Server shutdown by user request.");
    this._process?.kill();
  }
}
