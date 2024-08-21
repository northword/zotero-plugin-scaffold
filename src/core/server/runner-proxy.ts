import type { ChildProcess } from "node:child_process";
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";
import type { Context } from "../../types/index.js";
import { ServeBase } from "./base.js";

export default class RunnerProxy extends ServeBase {
  private _process?: ChildProcess;
  constructor(ctx: Context) {
    super(ctx);
  }

  async run() {
    // start Zotero
    this.prepareDevEnv();

    this.start();
  }

  /**
   * Starts zotero with plugins pre-installed as proxy file
   */
  start() {
    const zoteroProcess = spawn(this.zoteroBinPath, [
      // Do not disable remote, or the debug bridge command will not run.
      // "--no-remote",
      "--jsdebugger",
      //   "--start-debugger-server",
      //   "--debugger",
      "--purgecaches",
      "-profile",
      this.profilePath,
    ]);

    // Necessary on macOS
    zoteroProcess.stdout?.on("data", (_data) => {});

    zoteroProcess.on("close", (code) => {
      this.logger.info(`Zotero terminated with code ${code}.`);
    });

    this._process = zoteroProcess;
    return zoteroProcess;
  }

  /**
   * Preparing the development environment
   *
   * When asProxy=true, generate a proxy file and replace prefs.
   *
   * @see https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment
   */
  prepareDevEnv() {
    const { id } = this.ctx;
    // Create a proxy file
    const addonProxyFilePath = path.join(this.profilePath, `extensions/${id}`);
    const buildPath = path.resolve("build/addon");
    if (
      !fs.existsSync(addonProxyFilePath)
      || fs.readFileSync(addonProxyFilePath, "utf-8") !== buildPath
    ) {
      fs.outputFileSync(addonProxyFilePath, buildPath);
      this.logger.debug(
        `Addon proxy file has been updated. 
          File path: ${addonProxyFilePath} 
          Addon path: ${buildPath} `,
      );
    }

    // Delete XPI file
    const addonXpiFilePath = path.join(this.profilePath, `extensions/${id}.xpi`);
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
          line.includes("extensions.lastAppBuildId")
          || line.includes("extensions.lastAppVersion")
        ) {
          return "";
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
        if (addon.id === id && addon.active === false) {
          addon.active = true;
          addon.userDisabled = false;
          this.logger.debug(`Active plugin ${id} in extensions.json.`);
        }
        return addon;
      });
      fs.outputJSONSync(addonInfoFilePath, content);
    }
  }

  reload() {
    this.logger.debug("Reloading...");

    const { id, name, version } = this.ctx;

    const reloadScript = `
    (async () => {
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);
    const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
    const addon = await AddonManager.getAddonByID("${id}");
    await addon.reload();
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline("${name} Hot Reload");
    progressWindow.progress = new progressWindow.ItemProgress(
        "chrome://zotero/skin/tick.png",
        "VERSION=${version}, BUILD=${new Date().toLocaleString()}. By zotero-plugin-toolkit"
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
    this.logger.info("Server shutdown by user request.");
    this._process?.kill();
  }
}
