import { Context } from "../types/index.js";
import { killZotero } from "../utils/kill-zotero.js";
import { Base } from "./base.js";
import Build from "./build.js";
import { execSync, spawn } from "child_process";
import chokidar from "chokidar";
import fs from "fs-extra";
import path from "path";
import { exit } from "process";
import { debounce } from "radash";
import webext from "web-ext";

export default class Serve extends Base {
  private builder: Build;
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

    if (!fs.existsSync(this.zoteroBinPath))
      throw new Error("The Zotero binary not found.");

    if (!fs.existsSync(this.profilePath))
      throw new Error("The Zotero profile not found.");

    await this.ctx.hooks.callHook("serve:init", this.ctx);

    // prebuild
    await this.builder.run();
    await this.ctx.hooks.callHook("serve:prebuild", this.ctx);

    // start Zotero
    if (this.ctx.server.asProxy) {
      this.startZoteroByProxyFile();
    } else {
      console.log("");
      await this.startZoteroByWebExt();
    }

    // watch
    await this.watch();
  }

  /**
   * watch source dir and build when file changed
   */
  async watch() {
    const watcher = chokidar.watch(this.src, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
    });

    const onChange = debounce({ delay: 500 }, async (path: string) => {
      try {
        await this.ctx.hooks.callHook("serve:onChanged", this.ctx, path);

        if (path.endsWith(".ts") || path.endsWith(".tsx")) {
          await this.builder.esbuild();
        } else {
          await this.builder.run();
        }

        if (this.ctx.server.asProxy) {
          this.reload();
          this.logger.info("Reloaded done.");
          await this.ctx.hooks.callHook("serve:onReloaded", this.ctx);
        }
      } catch (err) {
        // Do not abort the watcher when errors occur
        // in builds triggered by the watcher.
        this.logger.error(err);
      }
    });

    watcher
      .on("ready", async () => {
        await this.ctx.hooks.callHook("serve:ready", this.ctx);
        console.log("");
        this.logger.ready("Server Ready! \n");
      })
      .on("change", async (path) => {
        if (this.ctx.server.asProxy) {
          console.clear();
          this.logger.log(`${path} changed`);
        } else {
          // 从 web-ext 的 reload 日志上换行
          console.log("");
        }

        onChange(path);
      })
      .on("error", (err) => {
        this.logger.error("Server start failed!", err);
      });
  }

  /**
   * Starts zotero with plugins pre-installed as proxy file
   */
  async startZoteroByProxyFile() {
    this.prepareDevEnv();

    const zoteroProcess = spawn(this.zoteroBinPath, [
      // Do not disable remote, or the debug bridge command will not run.
      // "--no-remote",
      "--start-debugger-server",
      "--jsdebugger",
      "--debugger",
      "--purgecaches",
      "-profile",
      this.profilePath,
    ]);

    // Necessary on MacOS
    zoteroProcess.stdout?.on("data", (data) => {});

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
  async startZoteroByWebExt() {
    return await webext.cmd.run(
      {
        firefox: this.zoteroBinPath,
        firefoxProfile: this.profilePath,
        sourceDir: path.resolve(`${this.dist}/addon`),
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

  /**
   * Preparing the development environment
   *
   * When asProxy=true, generate a proxy file and replace prefs.
   *
   * @see https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment
   */
  prepareDevEnv() {
    // Create a proxy file
    const addonProxyFilePath = path.join(
      this.profilePath,
      `extensions/${this.id}`,
    );
    const buildPath = path.resolve("build/addon");
    if (
      !fs.existsSync(addonProxyFilePath) ||
      fs.readFileSync(addonProxyFilePath, "utf-8") !== buildPath
    ) {
      fs.outputFileSync(addonProxyFilePath, buildPath);
      this.logger.debug(
        `Addon proxy file has been updated. 
          File path: ${addonProxyFilePath} 
          Addon path: ${buildPath} `,
      );
    }

    // Delete XPI file
    const addonXpiFilePath = path.join(
      this.profilePath,
      `extensions/${this.id}.xpi`,
    );
    if (fs.existsSync(addonXpiFilePath)) {
      fs.removeSync(addonXpiFilePath);
      this.logger.debug(`XPI file found, removed.`);
    }

    // Force Zotero to load the plugin from the proxy file
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

    // Force enable plugin in extensions.json
    const addonInfoFilePath = path.join(this.profilePath, "extensions.json");
    if (fs.existsSync(addonInfoFilePath)) {
      const content = fs.readJSONSync(addonInfoFilePath);
      content.addons = content.addons.map((addon: any) => {
        if (addon.id === this.id && addon.active === false) {
          addon.active = true;
          addon.userDisabled = false;
          this.logger.debug(`Active plugin ${this.id} in extensions.json.`);
        }
        return addon;
      });
      fs.outputJSONSync(addonInfoFilePath, content);
    }
  }

  reload() {
    this.logger.debug("Reloading...");
    const reloadScript = `
    (async () => {
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);
    const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
    const addon = await AddonManager.getAddonByID("${this.id}");
    await addon.reload();
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline("${this.name} Hot Reload");
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

  exit() {
    console.log("");
    this.logger.info("Server shutdown by user request.");
    killZotero();
    this.ctx.hooks.callHook("serve:exit", this.ctx);
    process.exit();
  }

  private get zoteroBinPath() {
    return process.env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH ?? "";
  }
  private get profilePath() {
    return process.env.ZOTERO_PLUGIN_PROFILE_PATH ?? "";
  }
  private get dataDir() {
    return process.env.ZOTERO_PLUGIN_DATA_DIR ?? "";
  }
}
