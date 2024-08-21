import process from "node:process";
import chokidar from "chokidar";
import { debounce } from "radash";
import type { Context } from "../../types/index.js";
import { Base } from "../base.js";
import Build from "../builder.js";
import { killZotero } from "./kill-zotero.js";
import type { ServeBase } from "./base.js";
import RunnerProxy from "./runner-proxy.js";
import RunnerWebExt from "./runner-web-ext.js";

export default class Serve extends Base {
  private builder: Build;
  private runner?: ServeBase;
  constructor(ctx: Context) {
    super(ctx);
    process.env.NODE_ENV ??= "development";
    this.builder = new Build(ctx);
  }

  async run() {
    // Handle interrupt signal (Ctrl+C) to gracefully terminate Zotero process
    // Must be placed at the top to prioritize registration of events to prevent web-ext interference
    process.on("SIGINT", () => {
      this.exit();
    });

    await this.ctx.hooks.callHook("serve:init", this.ctx);

    // prebuild
    await this.builder.run();
    await this.ctx.hooks.callHook("serve:prebuild", this.ctx);

    // start Zotero
    if (this.ctx.server.asProxy) {
      this.runner = new RunnerProxy(this.ctx);
    }
    else {
      this.runner = new RunnerWebExt(this.ctx);
    }
    await this.runner.run();

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

    const onChange = debounce({ delay: 500 }, async (path: string) => {
      try {
        await this.ctx.hooks.callHook("serve:onChanged", this.ctx, path);

        if (path.endsWith(".ts") || path.endsWith(".tsx")) {
          await this.builder.esbuild();
        }
        else {
          await this.builder.run();
        }

        if (this.ctx.server.asProxy) {
          this.runner?.reload();
          this.logger.info("Reloaded done.");
          await this.ctx.hooks.callHook("serve:onReloaded", this.ctx);
        }
      }
      catch (err) {
        // Do not abort the watcher when errors occur
        // in builds triggered by the watcher.
        this.logger.error(err);
      }
    });

    watcher
      .on("ready", async () => {
        await this.ctx.hooks.callHook("serve:ready", this.ctx);
        this.logger.newLine();
        this.logger.ready("Server Ready! \n");
      })
      .on("change", async (path) => {
        if (this.ctx.server.asProxy) {
          this.logger.clear();
          this.logger.log(`${path} changed`);
        }
        else {
          // 从 web-ext 的 reload 日志上换行
          this.logger.newLine();
        }

        onChange(path);
      })
      .on("error", (err) => {
        this.logger.error("Server start failed!", err);
      });
  }

  exit() {
    this.logger.info("Server shutdown by user request.");
    this.runner?.exit();
    killZotero();
    this.ctx.hooks.callHook("serve:exit", this.ctx);
    process.exit();
  }
}
