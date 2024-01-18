import { Config } from "../types.js";
import { Logger } from "../utils/logger.js";
import Build from "./build.js";
import chokidar from "chokidar";
import _ from "lodash";
import path from "path";
import webext from "web-ext";

export default class Server {
  private config: Config;
  private builder: Build;
  constructor(config: Config) {
    this.config = config;
    this.builder = new Build(config, "development");
  }

  async run() {
    // build
    this.builder.run();

    // start Zotero
    // this.startZotero();
    // this.startZoteroWebExt();

    // watch
    await this.watch();
  }

  /**
   * watch source dir and build when file changed
   */
  async watch() {
    const watcher = chokidar.watch(this.config.source, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
    });

    const onChange = _.debounce(
      (path: string) => {
        try {
          if (path.endsWith(".ts")) {
            this.builder.esbuild();
          } else {
            this.builder.run();
          }
        } catch (err) {
          // Do not abort the watcher when errors occur
          // in builds triggered by the watcher.
          Logger.error(err);
        }
      },
      5000,
      // { maxWait: 1000 },
    );

    watcher
      .on("ready", () => {
        Logger.info("Server Ready! \n");
      })
      .on("change", async (path) => {
        Logger.info(`${path} changed at ${new Date().toLocaleTimeString()}`);

        onChange.cancel();
        onChange(path);

        this.reload();
      })
      .on("error", (err) => {
        Logger.error("Server start failed!", err);
      });
  }

  startZotero() {
    //
  }

  /**
   * start zotero with plugin installed and reload when dist changed
   */
  async startZoteroWebExt() {
    await webext.cmd.run(
      {
        firefox: this.config.cmd.zoteroBinPath,
        firefoxProfile: this.config.cmd.profilePath,
        sourceDir: path.resolve(`${this.config.dist}/addon`),
        keepProfileChanges: true,
        args: ["--debugger", "--purgecaches"],
        // browserConsole: true,
        // openDevTool: true,  // need Zotero upgrade to firefox 115
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
    Logger.debug("Reloading...");
    // const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(
    //   reloadScript,
    // )}`;
    // const command = `${startZoteroCmd} -url "${url}"`;
    // execSync(command);
  }

  openDevTool() {
    // Logger.debug("Open dev tools...");
    // const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(
    //   openDevToolScript,
    // )}`;
    // const command = `${startZoteroCmd} -url "${url}"`;
    // execSync(command);
  }
}
