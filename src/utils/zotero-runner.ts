import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { env } from "node:process";
import { outputFileSync, outputJSONSync, readJSONSync, removeSync } from "fs-extra/esm";
import { isLinux, isMacOS, isWindows } from "std-env";
import { Log } from "./log.js";
import { isRunning } from "./process.js";
import { findFreeTcpPort, RemoteFirefox } from "./zotero/remote-zotero.js";

const logger = new Log();

export interface ZoteroRunnerOptions {
  binaryPath: string;
  profilePath: string;
  dataDir: string;
  customPrefs?: { [key: string]: string | number | boolean };

  plugins: PluginInfo[];
  asProxy?: boolean;

  devtools?: boolean;
  binaryArgs?: string[];
}

interface PluginInfo {
  id: string;
  sourceDir: string;
}

export class ZoteroRunner {
  private options: ZoteroRunnerOptions;
  private remoteFirefox: RemoteFirefox;
  public zotero?: ChildProcessWithoutNullStreams;

  constructor(options: ZoteroRunnerOptions) {
    this.options = options;
    this.remoteFirefox = new RemoteFirefox();
  }

  async run() {
    // Get a Zotero profile with the custom Prefs set (a new or a cloned one)
    // Pre-install extensions as proxy if needed (and disable auto-reload if you do)
    await this.setupProfileDir();

    // Start Zotero process and connect to the Zotero instance on RDP
    await this.startZoteroInstance();

    // Install any extension if not in proxy mode
    if (!this.options.asProxy)
      await this.installTemporaryPlugins();
  }

  /**
   * Preparing the development environment
   *
   * When asProxy=true, generate a proxy file and replace prefs.
   *
   * @see https://www.zotero.org/support/dev/client_coding/plugin_development#setting_up_a_plugin_development_environment
   */
  private async setupProfileDir() {
    if (!this.options.profilePath) {
      // Create profile
    }

    // Setup prefs.js
    const customPrefs = Object.entries(this.options.customPrefs || []).map(([key, value]) => {
      return `user_pref("${key}", ${JSON.stringify(value)});`;
    });

    let exsitedPrefs: string[] = [];
    const prefsPath = join(this.options.profilePath, "prefs.js");
    if (existsSync(prefsPath)) {
      const PrefsLines = readFileSync(prefsPath, "utf-8").split("\n");
      exsitedPrefs = PrefsLines.map((line: string) => {
        if (
          line.includes("extensions.lastAppBuildId")
          || line.includes("extensions.lastAppVersion")
        ) {
          return "";
        }
        if (line.includes("extensions.zotero.dataDir") && this.options.dataDir !== "") {
          return `user_pref("extensions.zotero.dataDir", "${this.options.dataDir}");`;
        }
        return line;
      });
    }
    const updatedPrefs = [...exsitedPrefs, ...customPrefs].join("\n");
    outputFileSync(prefsPath, updatedPrefs, "utf-8");
    logger.debug("The <profile>/prefs.js has been modified.");

    // Install plugins in proxy file mode
    if (this.options.asProxy) {
      await this.installPluginsByProxyMode();
    }
  }

  private async startZoteroInstance() {
    // Build args
    let args: string[] = ["--purgecaches"];
    if (this.options.profilePath) {
      args.push("-profile", this.options.profilePath);
    }
    if (this.options.devtools) {
      args.push("--jsdebugger");
    }

    // support for starting the remote debugger server
    const remotePort = await findFreeTcpPort();
    args.push("-start-debugger-server", String(remotePort));

    if (this.options.binaryArgs) {
      args = [...args, ...this.options.binaryArgs];
    }

    // Using `spawn` so we can stream logging as they come in, rather than
    // buffer them up until the end, which can easily hit the max buffer size.
    this.zotero = spawn(this.options.binaryPath, args);

    // Handle Zotero log, necessary on macOS
    this.zotero.stdout?.on("data", (_data) => {});

    await this.remoteFirefox.connect(remotePort);
    logger.debug(`Connected to the remote Firefox debugger on port: ${remotePort}`);
  }

  private async installTemporaryPlugins() {
    // Install all the temporary addons.
    for (const plugin of this.options.plugins) {
      const addonId = await this.remoteFirefox
        .installTemporaryAddon(resolve(plugin.sourceDir))
        .then((installResult) => {
          return installResult.addon.id;
        });

      if (!addonId) {
        throw new Error("Unexpected missing addonId in the installAsTemporaryAddon result");
      }
    }
  }

  private async installPluginByProxyMode(id: string, sourceDir: string) {
    // Create a proxy file
    const addonProxyFilePath = join(this.options.profilePath, `extensions/${id}`);
    const buildPath = resolve(sourceDir);
    if (
      !existsSync(addonProxyFilePath)
      || readFileSync(addonProxyFilePath, "utf-8") !== buildPath
    ) {
      outputFileSync(addonProxyFilePath, buildPath);
      logger.debug(
        [
          `Addon proxy file has been updated.`,
          `  File path: ${addonProxyFilePath}`,
          `  Addon path: ${buildPath}`,
        ].join("\n"),
      );
    }

    // Delete XPI file
    const addonXpiFilePath = join(this.options.profilePath, `extensions/${id}.xpi`);
    if (existsSync(addonXpiFilePath)) {
      removeSync(addonXpiFilePath);
      logger.debug(`XPI file found, removed.`);
    }

    // Force enable plugin in extensions.json
    const addonInfoFilePath = join(this.options.profilePath, "extensions.json");
    if (existsSync(addonInfoFilePath)) {
      const content = readJSONSync(addonInfoFilePath);
      content.addons = content.addons.map((addon: any) => {
        if (addon.id === id && addon.active === false) {
          addon.active = true;
          addon.userDisabled = false;
          logger.debug(`Active plugin ${id} in extensions.json.`);
        }
        return addon;
      });
      outputJSONSync(addonInfoFilePath, content);
    }

    //
  }

  private async installPluginsByProxyMode() {
    for (const { id, sourceDir } of this.options.plugins) {
      await this.installPluginByProxyMode(id, sourceDir);
    }
  }

  public async reloadPluginById(id: string) {
    await this.remoteFirefox.reloadAddon(id);
  }

  public async reloadPluginBySourceDir(sourceDir: string) {
    const addonId = this.options.plugins.find(p => p.sourceDir === sourceDir)?.id;

    if (!addonId) {
      return {
        sourceDir,
        reloadError: new Error(
          "Extension not reloadable: "
          + `no addonId has been mapped to "${sourceDir}"`,
        ),
      };
    }

    try {
      await this.remoteFirefox.reloadAddon(addonId);
    }
    catch (error) {
      return {
        sourceDir,
        reloadError: error,
      };
    }

    return { sourceDir, reloadError: undefined };
  }

  public async reloadPluginByZToolkit(id: string, name: string, version: string) {
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
    const startZoteroCmd = `"${this.options.binaryPath}" --purgecaches -profile "${this.options.profilePath}"`;
    const command = `${startZoteroCmd} -url "${url}"`;
    execSync(command);
  }

  public async reloadAllPlugins() {
    for (const { sourceDir } of this.options.plugins) {
      const res = await this.reloadPluginBySourceDir(sourceDir);
      if (res.reloadError instanceof Error) {
        logger.error(res.reloadError);
      }
    }
  }

  public exit() {
    this.zotero?.kill();
    // Sometimes `runner.exit()` cannot kill the Zotero,
    // so we force kill it.
    killZotero();
  }
}

export function killZotero() {
  const logger = new Log();

  function kill() {
    try {
      if (env.ZOTERO_PLUGIN_KILL_COMMAND) {
        execSync(env.ZOTERO_PLUGIN_KILL_COMMAND);
      }
      else if (isWindows) {
        execSync("taskkill /f /im zotero.exe");
      }
      else if (isMacOS) {
        execSync("kill -9 $(ps -x | grep zotero)");
      }
      else if (isLinux) {
        execSync("pkill -9 zotero");
      }
      else {
        logger.error("No commands found for this operating system.");
      }
    }
    catch {
      logger.fail("Kill Zotero failed.");
    }
  }

  if (isRunning("zotero")) {
    kill();
  }
  else {
    logger.fail("No Zotero instance is currently running.");
  }
}
