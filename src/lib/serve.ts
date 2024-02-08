import { Config } from "../types.js";
import { Base } from "./base.js";
import Build from "./build.js";
import { execSync, spawn } from "child_process";
import chokidar from "chokidar";
import fs from "fs-extra";
import _ from "lodash";
import path from "path";
import { exit } from "process";
import webext from "web-ext";

export default class Serve extends Base {
  private builder: Build;
  constructor(config: Config) {
    super(config);
    process.env.NODE_ENV ??= "development";
    this.builder = new Build(config);
  }

  async run() {
    // build
    await this.builder.run();

    // start Zotero
    this.startZotero();
    // this.startZoteroWebExt();

    // watch
    await this.config.extraServer(this.config);
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
          this.logger.error(err);
        }
      },
      500,
      // { maxWait: 1000 },
    );

    watcher
      .on("ready", () => {
        this.logger.log("");
        this.logger.info("Server Ready! \n");
      })
      .on("change", async (path) => {
        this.logger.info(
          `${path} changed at ${new Date().toLocaleTimeString()}`,
        );

        onChange.cancel();
        onChange(path);

        this.reload();
        this.logger.info("Reloaded done.");
      })
      .on("error", (err) => {
        this.logger.error("Server start failed!", err);
      });
  }

  async startZotero() {
    let isZoteroReady = false;
    if (!fs.existsSync(this.zoteroBinPath)) {
      throw new Error("Zotero binary does not exist.");
    }

    if (!fs.existsSync(this.profilePath)) {
      throw new Error("The given Zotero profile does not exist.");
    }

    this.prepareDevEnv();

    const zoteroProcess = spawn(this.zoteroBinPath, [
      "--debugger",
      "--purgecaches",
      "-profile",
      this.profilePath,
    ]);

    zoteroProcess.stdout?.on("data", (data) => {
      if (
        !isZoteroReady &&
        data
          .toString()
          .includes(
            `Calling bootstrap method 'startup' for plugin ${this.addonID}`,
          )
      ) {
        console.log(data.toString());
        isZoteroReady = true;
        setTimeout(() => {
          this.openDevTool();
        }, 1000);
      }
    });

    zoteroProcess.on("close", (code) => {
      this.logger.info(`Zotero terminated with code ${code}.`);
      exit(0);
    });

    process.on("SIGINT", () => {
      // Handle interrupt signal (Ctrl+C) to gracefully terminate Zotero process
      zoteroProcess.kill();
      exit();
    });

    return zoteroProcess;
  }

  /**
   * start zotero with plugin installed and reload when dist changed
   */
  async startZoteroWebExt() {
    await webext.cmd.run(
      {
        firefox: this.zoteroBinPath,
        firefoxProfile: this.profilePath,
        sourceDir: path.resolve(`${this.config.dist}/addon`),
        keepProfileChanges: true,
        args: ["--debugger", "--purgecaches"],
        // browserConsole: true,
        // openDevTool: true, // need Zotero upgrade to firefox 115
      },
      {
        // These are non CLI related options for each function.
        // You need to specify this one so that your NodeJS application
        // can continue running after web-ext is finished.
        shouldExitProgram: false,
      },
    );
  }

  prepareDevEnv() {
    const addonProxyFilePath = path.join(
      this.profilePath,
      `extensions/${this.addonID}`,
    );
    const buildPath = path.resolve("build/addon");
    if (
      !fs.existsSync(addonProxyFilePath) ||
      fs.readFileSync(addonProxyFilePath, "utf-8") !== buildPath
    ) {
      fs.writeFileSync(addonProxyFilePath, buildPath);
      this.logger.debug(
        `Addon proxy file has been updated. 
          File path: ${addonProxyFilePath} 
          Addon path: ${buildPath} `,
      );
    }

    const addonXpiFilePath = path.join(
      this.profilePath,
      `extensions/${this.addonID}.xpi`,
    );
    if (fs.existsSync(addonXpiFilePath)) {
      fs.rmSync(addonXpiFilePath);
    }

    const prefsPath = path.join(this.profilePath, "prefs.js");
    if (fs.existsSync(prefsPath)) {
      const PrefsLines = fs.readFileSync(prefsPath, "utf-8").split("\n");
      const filteredLines = PrefsLines.map((line: string) => {
        if (
          line.includes("extensions.lastAppBuildId") ||
          line.includes("extensions.lastAppVersion")
        ) {
          return;
        }
        if (line.includes("extensions.zotero.dataDir") && this.dataDir !== "") {
          return `user_pref("extensions.zotero.dataDir", "${this.dataDir}");`;
        }
        return line;
      });
      const updatedPrefs = filteredLines.join("\n");
      fs.writeFileSync(prefsPath, updatedPrefs, "utf-8");
      this.logger.debug("The <profile>/prefs.js has been modified.");
    }
  }

  reload() {
    this.logger.debug("Reloading...");
    const reloadScript = `
    (async () => {
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);
    const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
    const addon = await AddonManager.getAddonByID("${this.addonID}");
    await addon.reload();
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline("${this.addonName} Hot Reload");
    progressWindow.progress = new progressWindow.ItemProgress(
        "chrome://zotero/skin/tick.png",
        "VERSION=${this.version}, BUILD=${new Date().toLocaleString()}. By zotero-plugin-toolkit"
    );
    progressWindow.progress.setProgress(100);
    progressWindow.show();
    progressWindow.startCloseTimer(5000);
    })()`;
    const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(
      reloadScript,
    )}`;
    const startZoteroCmd = `"${this.zoteroBinPath}" --debugger --purgecaches -profile "${this.profilePath}"`;
    const command = `${startZoteroCmd} -url "${url}"`;
    execSync(command);
  }

  openDevTool() {
    this.logger.debug("Open dev tools...");
    const openDevToolScript = `
    (async () => {
    
    // const { BrowserToolboxLauncher } = ChromeUtils.import(
    //   "resource://devtools/client/framework/browser-toolbox/Launcher.jsm",
    // );
    // BrowserToolboxLauncher.init();
    // TODO: Use the above code to open the devtool after https://github.com/zotero/zotero/pull/3387
    
    Zotero.Prefs.set("devtools.debugger.remote-enabled", true, true);
    Zotero.Prefs.set("devtools.debugger.remote-port", 6100, true);
    Zotero.Prefs.set("devtools.debugger.prompt-connection", false, true);
    Zotero.Prefs.set("devtools.debugger.chrome-debugging-websocket", false, true);
    
    env =
        Services.env ||
        Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    
    env.set("MOZ_BROWSER_TOOLBOX_PORT", 6100);
    Zotero.openInViewer(
        "chrome://devtools/content/framework/browser-toolbox/window.html",
        {
        onLoad: (doc) => {
            doc.querySelector("#status-message-container").style.visibility =
            "collapse";
            let toolboxBody;
            waitUntil(
            () => {
                toolboxBody = doc
                .querySelector(".devtools-toolbox-browsertoolbox-iframe")
                ?.contentDocument?.querySelector(".theme-body");
                return toolboxBody;
            },
            () => {
                toolboxBody.style = "pointer-events: all !important";
            }
            );
        },
        }
    );
    
    function waitUntil(condition, callback, interval = 100, timeout = 10000) {
        const start = Date.now();
        const intervalId = setInterval(() => {
        if (condition()) {
            clearInterval(intervalId);
            callback();
        } else if (Date.now() - start > timeout) {
            clearInterval(intervalId);
        }
        }, interval);
    }  
    })()`;
    const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(
      openDevToolScript,
    )}`;
    const startZoteroCmd = `"${this.zoteroBinPath}" --debugger --purgecaches -profile "${this.profilePath}"`;
    const command = `${startZoteroCmd} -url "${url}"`;
    execSync(command);
  }

  private get zoteroBinPath() {
    // this.logger.debug("zoteroBinPath", process.env.zoteroBinPath);
    return process.env.zoteroBinPath ?? "";
  }
  private get profilePath() {
    // this.logger.debug("profilePath", process.env.profilePath);
    return process.env.profilePath ?? "";
  }
  private get dataDir() {
    return process.env.dataDir ?? "";
  }
}
