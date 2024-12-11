import type { ChildProcess } from "node:child_process";
import type { Context } from "../types/index.js";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import { basename, join, resolve } from "node:path";
import process, { cwd, env } from "node:process";
import { build } from "esbuild";
import fsExtra from "fs-extra/esm";
import { globbySync } from "globby";
import { isCI, isLinux } from "std-env";
import { Xvfb } from "xvfb-ts";
import { saveResource } from "../utils/file.js";
import { toArray } from "../utils/string.js";
import { Base } from "./base.js";
import Build from "./builder.js";

export default class Test extends Base {
  private builder: Build;
  private _profileDir?: string;
  private _dataDir?: string;
  private _testPluginDir?: string;
  private _testPluginRef: string;
  private _testPluginID: string;
  private _testBuildDir?: string;
  private _server?: http.Server;
  private _process?: ChildProcess;

  get startArgs() {
    const args = [
      "--purgecaches",
      "--jsdebugger",
      "--no-remote",
    ];
    if (this._dataDir)
      args.push("--dataDir", this._dataDir);
    if (this._profileDir)
      args.push("--profile", this._profileDir);
    return args;
  }

  constructor(ctx: Context) {
    super(ctx);
    this.builder = new Build(ctx);
    this._testPluginRef = `${ctx.namespace}-test`;
    this._testPluginID = `${this._testPluginRef}@only-for-testing.com`;
    env.NODE_ENV ??= "test";

    if (isCI) {
      this.ctx.test.abortOnFail = true;
      this.ctx.test.exitOnFinish = true;
      this.ctx.test.headless = true;
    }
  }

  async run() {
    // Handle interrupt signal (Ctrl+C) to gracefully terminate Zotero process
    // Must be placed at the top to prioritize registration of events to prevent web-ext interference
    process.on("SIGINT", this.exit);

    await this.ctx.hooks.callHook("test:init", this.ctx);

    // prebuild
    await this.builder.run();
    await this.ctx.hooks.callHook("test:prebuild", this.ctx);

    await this.startTestServer();
    await this.ctx.hooks.callHook("test:listen", this.ctx);

    await this.prepareDir();

    await this.ctx.hooks.callHook("test:mkdir", this.ctx);

    await this.createManifest();

    await this.createBootstrap();

    await this.createTestResources();

    await this.ctx.hooks.callHook("test:copyAssets", this.ctx);

    await this.bundleTests();

    await this.ctx.hooks.callHook("test:bundleTests", this.ctx);

    if ((isCI || this.ctx.test.headless)) {
      await this.prepareHeadless();
      await this.startZoteroHeadless();
    }
    else {
      await this.startZotero();
    }

    await this.ctx.hooks.callHook("test:run", this.ctx);
  }

  async prepareDir() {
    const { dist } = this.ctx;

    this._profileDir = resolve(`${dist}/testTmp/profile`);
    this._dataDir = resolve(`${dist}/testTmp/data`);
    this._testBuildDir = `${dist}/testTmp/build`;
    // TODO: when scaffold init is implemented, can use it to create the tester plugin
    this._testPluginDir = resolve(`${dist}/testTmp/resource`);

    await fsExtra.emptyDir(this._profileDir);
    await fsExtra.emptyDir(this._dataDir);
    await fsExtra.emptyDir(this._testBuildDir);
    await fsExtra.emptyDir(this._testPluginDir);
    await fsExtra.emptyDir(join(this._testPluginDir, "content"));
    await fsExtra.emptyDir(join(this._profileDir, "extensions"));

    const addonProxyFilePath = join(this._profileDir, `extensions/${this.ctx.id}`);
    await fs.writeFile(addonProxyFilePath, resolve(`${dist}/addon`));

    const testerProxyFilePath = join(this._profileDir, `extensions/${this._testPluginID}`);
    await fs.writeFile(testerProxyFilePath, this._testPluginDir);
    this.logger.debug(
      [
        `Addon proxy file has been updated.`,
        `  File path: ${testerProxyFilePath}`,
        `  Addon path: ${this._testPluginDir}`,
      ].join("\n"),
    );

    const prefs = Object.assign({ "extensions.experiments.enabled": true, "extensions.autoDisableScopes": 0,
      // Enable remote-debugging
      "devtools.debugger.remote-enabled": true, "devtools.debugger.remote-websocket": true, "devtools.debugger.prompt-connection": false,
      // Inherit the default test settings from Zotero
      "app.update.enabled": false, "extensions.zotero.sync.server.compressData": false, "extensions.zotero.automaticScraperUpdates": false, "extensions.zotero.debug.log": 5, "extensions.zotero.debug.level": 5, "extensions.zotero.debug.time": 5, "extensions.zotero.firstRun.skipFirefoxProfileAccessCheck": true, "extensions.zotero.firstRunGuidance": false, "extensions.zotero.firstRun2": false, "extensions.zotero.reportTranslationFailure": false, "extensions.zotero.httpServer.enabled": true, "extensions.zotero.httpServer.port": 23124, "extensions.zotero.httpServer.localAPI.enabled": true, "extensions.zotero.backup.numBackups": 0, "extensions.zotero.sync.autoSync": false, "extensions.zoteroMacWordIntegration.installed": true, "extensions.zoteroMacWordIntegration.skipInstallation": true, "extensions.zoteroWinWordIntegration.skipInstallation": true, "extensions.zoteroOpenOfficeIntegration.skipInstallation": true }, this.ctx.test.prefs || {});

    // Write to prefs.js
    const prefsCode = Object.entries(prefs).map(([key, value]) => {
      return `user_pref("${key}", ${JSON.stringify(value)});`;
    }).join("\n");
    await fs.writeFile(join(this._profileDir, "prefs.js"), prefsCode);
    this.logger.debug("The <profile>/prefs.js has been modified");

    this.logger.success(`Prepared test directories: profile=${this._profileDir}, data=${this._dataDir}, resource=${this._testPluginDir}`);
  }

  async createManifest() {
    const manifest = {
      manifest_version: 2,
      name: this._testPluginRef,
      version: "0.0.1",
      description: "Test suite for the Zotero plugin. This is a runtime-generated plugin only for testing purposes.",
      applications: {
        zotero: {
          id: `${this._testPluginRef}@only-for-testing.com`,
          update_url: "https://invalid.com",
          // strict_min_version: "*.*.*",
          strict_max_version: "999.*.*",
        },
      },
    };
    await fs.writeFile(resolve(`${this._testPluginDir}/manifest.json`), JSON.stringify(manifest, null, 2));
    this.logger.success("Saved manifest.json for test");
  }

  async createBootstrap() {
    const code = `
/**
 * Code generated by the zotero-plugin-scaffold tester
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await Zotero.initializationPromise;
  const aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "${this._testPluginRef}", rootURI + "content/"],
  ]);

  launchTests().catch((error) => {
    Zotero.debug(error);
    Zotero.HTTP.request(
      "POST",
      "http://localhost:${this.ctx.test.port || 9876}/update",
      {
        body: JSON.stringify({
          type: "fail",
          data: {
            title: "Internal: Plugin awaiting timeout",
            stack: "",
            str: "Plugin awaiting timeout",
          },
        }),
      }
    );
  });
}

function onMainWindowLoad({ window: win }) {}

function onMainWindowUnload({ window: win }) {}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}

async function launchTests() {
  // Delay to allow plugin to fully load before opening the test page
  await Zotero.Promise.delay(${this.ctx.test.startupDelay || 1000});

  const waitForPlugin = "${this.ctx.test.waitForPlugin}";

  if (waitForPlugin) {
    // Wait for a plugin to be installed
    await waitUtilAsync(() => {
      try {
        return !!eval(waitForPlugin)();
      } catch (error) {
        return false;
      }
    }).catch(() => {
      throw new Error("Plugin awaiting timeout");
    });
  }

  Services.ww.openWindow(
    null,
    "chrome://${this._testPluginRef}/content/index.xhtml",
    "${this.ctx.namespace}-test",
    "chrome,centerscreen,resizable=yes",
    {}
  );
}

function waitUtilAsync(condition, interval = 100, timeout = 1e4) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const intervalId = setInterval(() => {
      if (condition()) {
        clearInterval(intervalId);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(intervalId);
        reject();
      }
    }, interval);
  });
}

/*
 * End of code added by the zotero-plugin-scaffold test runner
 */
`;

    await fs.writeFile(resolve(`${this._testPluginDir}/bootstrap.js`), code);
    this.logger.success("Saved bootstrap.js for test");
  }

  async createTestResources() {
    const MOCHA_JS_URL = "https://cdn.jsdelivr.net/npm/mocha/mocha.js";
    // const MOCHA_CSS_URL = "https://cdn.jsdelivr.net/npm/mocha/mocha.css";
    const CHAI_JS_URL = "https://www.chaijs.com/chai.js";
    await saveResource(MOCHA_JS_URL, resolve(`${this._testPluginDir}/content/mocha.js`));
    // saveResource(MOCHA_CSS_URL, resolve(`${resourceDir}/content/mocha.css`));
    await saveResource(CHAI_JS_URL, resolve(`${this._testPluginDir}/content/chai.js`));
    const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8"></meta>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
    <title>Zotero Plugin Test</title>
    <style>
        html {
            min-width: 400px;
            min-height: 600px;
        }
        body {
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    <div id="mocha"></div>

    <!-- Mocha and Chai Libraries -->
    <script src="mocha.js"></script>
    <script src="chai.js"></script>
    <script src="chrome://zotero/content/include.js"></script>
    <script src="index.spec.js"></script>
</body>
</html>
`;
    await fs.writeFile(resolve(`${this._testPluginDir}/content/index.xhtml`), html);

    this.logger.success("Saved test resources");
  }

  async bundleTests() {
    const testDirs = toArray(this.ctx.test.entries);

    // Bundle all test files, including both JavaScript and TypeScript
    for (const dir of testDirs) {
      let tsconfigPath: string | undefined = resolve(`${dir}/tsconfig.json`);
      if (!await fsExtra.pathExists(tsconfigPath)) {
        tsconfigPath = undefined;
      }
      await build({
        entryPoints:
          [resolve(`${dir}/**/*.spec.js`), resolve(`${dir}/**/*.spec.ts`)],
        outdir: this._testBuildDir,
        bundle: true,
        target: "firefox115",
        tsconfig: tsconfigPath || undefined,
      });
    }

    const testFiles = globbySync(`${this._testBuildDir}/**/*.spec.js`);
    // Sort the test files to ensure consistent test order
    testFiles.sort((a, b) => {
      const aName = basename(a);
      const bName = basename(b);
      if (aName < bName)
        return -1;
      if (aName > bName)
        return 1;
      return 0;
    });

    // Concatenate all test files into a single file
    let testCode = `
mocha.setup({ ui: "bdd", reporter: Reporter, timeout: ${this.ctx.test.mocha.timeout} || 10000, });

window.expect = chai.expect;
window.assert = chai.assert;

async function send(data) {
  console.log("Sending data to server", data);
  const req = await Zotero.HTTP.request(
    "POST",
    "http://localhost:${this.ctx.test.port || 9876}/update",
    {
      body: JSON.stringify(data),
    }
  );

  if (req.status !== 200) {
    dump("Error sending data to server" + req.responseText);
    return null;
  } else {
    const result = JSON.parse(req.responseText);
    return result;
  }
}

window.debug = function (...data) {
  const str = data.join("\\n");
  Zotero.debug(str);
  send({ type: "debug", data: { str } });
};

// Inherit the default test settings from Zotero
function Reporter(runner) {
  var indents = 0,
    passed = 0,
    failed = 0,
    aborted = false;

  function indent() {
    return Array(indents).join("  ");
  }

  function dump(str) {
    console.log(str);
    document.querySelector("#mocha").innerText += str;
  }

  runner.on("start", async function () {
    await send({ type: "start" });
  });

  runner.on("suite", async function (suite) {
    ++indents;
    const str = indent() + suite.title + "\\n";
    dump(str);
    await send({ type: "suite", data: { title: suite.title, str } });
  });

  runner.on("suite end", async function (suite) {
    --indents;
    const str = indents === 1 ? "\\n" : "";
    dump(str);
    await send({ type: "suite end", data: { title: suite.title, str } });
  });

  runner.on("pending", async function (test) {
    const str = indent() + "pending  -" + test.title + "\\n";
    dump(str);
    await send({ type: "pending", data: { title: test.title, str } });
  });

  runner.on("pass", async function (test) {
    passed++;
    let str = indent() + Mocha.reporters.Base.symbols.ok + " " + test.title;
    if ("fast" != test.speed) {
      str += " (" + Math.round(test.duration) + " ms)";
    }
    str += "\\n";
    dump(str);
    await send({
      type: "pass",
      data: { title: test.title, duration: test.duration, str },
    });
  });

  runner.on("fail", async function (test, err) {
    // Make sure there's a blank line after all stack traces
    err.stack = err.stack.replace(/\\s*$/, "\\n\\n");

    failed++;
    let indentStr = indent();
    const str =
      indentStr +
      // Dark red X for errors
      "\\x1B[31;40m" +
      Mocha.reporters.Base.symbols.err +
      " [FAIL]\\x1B[0m" +
      // Trigger bell if interactive
      (Zotero.automatedTest ? "" : "\\x07") +
      " " +
      test.title +
      "\\n" +
      indentStr +
      "  " +
      err.message +
      " at\\n" +
      err.stack.replace(/^/gm, indentStr + "    ").trim() +
      "\\n\\n";
    dump(str);

    if (${this.ctx.test.abortOnFail ? "true" : "false"}) {
      aborted = true;
      runner.abort();
    }

    await send({
      type: "fail",
      data: { title: test.title, stack: err.stack, str },
    });
  });

  runner.on("end", async function () {
    const str =
      passed +
      "/" +
      (passed + failed) +
      " tests passed" +
      (aborted ? " -- aborting" : "") +
      "\\n";
    dump(str);

    await send({
      type: "end",
      data: { passed: passed, failed: failed, aborted: aborted, str },
    });

    // Must exit on Zotero side, otherwise the exit code will not be 0 and CI will fail
    if (${this.ctx.test.exitOnFinish ? "true" : "false"}) {
      Zotero.Utilities.Internal.quit(0);
    }
  });
}
`;

    for (const testFile of testFiles) {
      const code = await fs.readFile(testFile, "utf8");
      testCode += `
// Test file: ${testFile}
(function () {
${code}
})();
`;
    }

    testCode += `
mocha.run();
`;

    // Save the concatenated test code to a single file
    await fs.writeFile(resolve(`${this._testPluginDir}/content/index.spec.js`), testCode);

    this.logger.success(`Injected ${testFiles.length} test files`);
  }

  async startTestServer() {
    // Start a HTTP server to receive test results
    // This is useful for CI/CD environments
    this._server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Zotero Plugin Test Server is running");
      }
      else
        if (req.method === "POST" && req.url === "/update") {
          let body = "";

          // Collect data chunks
          req.on("data", (chunk) => {
            body += chunk;
          });

          // Parse and handle the complete data
          req.on("end", async () => {
            try {
              const jsonData = JSON.parse(body);
              await this.handleTestUpdate(jsonData);

              // Send a response to the client
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ message: "Results received successfully" }));
            }
            catch (error: any) {
              this.logger.error("Error parsing JSON:", error);
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
          });
        }
        else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not Found" }));
        }
    });

    // Start the server
    const PORT = this.ctx.test.port || 9876;
    this._server.listen(PORT, () => {
      this.logger.success(`Server is listening on http://localhost:${PORT}`);
    });
  }

  async handleTestUpdate(body: {
    type: "start" | "suite" | "suite end" | "pending" | "pass" | "fail" | "end" | "debug";
    data?: { title: string; str: string; duration?: number; stack?: string };
  }) {
    if (body.type === "debug" && body.data?.str) {
      for (const line of body.data?.str.split("\n")) {
        this.logger.log(line);
        this.logger.newLine();
      }
    }
    const str = body.data?.str.replaceAll("\n", "");
    if (body.type === "start") {
      this.logger.newLine();
    }
    else if (body.type === "suite" && !!str) {
      this.logger.tip(str);
    }
    if (body.type === "pass" && !!str) {
      this.logger.log(str);
    }
    else if (body.type === "fail") {
      this.logger.error(str);
      if (this.ctx.test.abortOnFail) {
        this.logger.error("Aborting test run due to failure");
        if (this.ctx.test.exitOnFinish)
          this.exit(1);
      }
    }
    else if (body.type === "suite end") {
      this.logger.newLine();
    }
    else if (body.type === "end") {
      this.logger.success("Test run completed");
      this._server?.close();
      if (this.ctx.test.exitOnFinish)
        this.exit();
    }
  }

  async prepareHeadless() {
    // Ensure xvfb installing
    await this.installXvfb();

    // Download and Extract Zotero Beta Linux
    await this.installZoteroLinux();

    // Set Environment Variable for Zotero Bin Path
    process.env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH = `${cwd()}/Zotero_linux-x86_64/zotero`;
  }

  async installXvfb() {
    if (!isLinux) {
      this.logger.error("Unsupported platform. Please install Xvfb manually.");
      process.exit(1);
    }
    try {
      execSync("which xvfb", { stdio: "ignore" });
    }
    catch {
      try {
        const osId = execSync("cat /etc/os-release | grep '^ID='").toString();
        if (osId.includes("ubuntu") || osId.includes("debian")) {
          this.logger.debug("Detected Ubuntu/Debian. Installing Xvfb...");
          execSync("sudo apt-get update && sudo apt-get install -y xvfb", { stdio: "pipe" });
        }
        else if (osId.includes("centos") || osId.includes("rhel")) {
          this.logger.debug("Detected CentOS/RHEL. Installing Xvfb...");
          execSync("sudo yum install -y xorg-x11-server-Xvfb", { stdio: "pipe" });
        }
        else {
          throw new Error("Unsupported Linux distribution.");
        }
        this.logger.debug("Xvfb installation completed.");
      }
      catch (error) {
        this.logger.error("Failed to install Xvfb:", error);
        process.exit(1);
      }
    }
  }

  async installZoteroLinux() {
    try {
      execSync("wget -O zotero.tar.bz2 'https://www.zotero.org/download/client/dl?platform=linux-x86_64&channel=beta'", { stdio: "pipe" });
      execSync("tar -xvf zotero.tar.bz2", { stdio: "pipe" });
    }
    catch (e) {
      this.logger.error(e);
      throw new Error("Zotero extracted failed");
    }
  }

  async startZoteroHeadless() {
    const xvfb = new Xvfb();
    await xvfb.start();
    await this.startZotero();
  }

  async startZotero() {
    const zoteroProcess = spawn(env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH!, [
      ...this.startArgs,
    ]);

    // Necessary on macOS
    zoteroProcess.stdout?.on("data", (_data) => {});

    zoteroProcess.on("close", () => this.exit());

    this._process = zoteroProcess;
    return zoteroProcess;
  }

  async exit(status = 0) {
    this._server?.close();

    await this.ctx.hooks.callHook("test:done", this.ctx);

    if (status === 0) {
      this.logger.success("Test run completed successfully");
      process.exit(0);
    }
    else {
      this.logger.error("Test run failed");
      this._process?.kill();
      process.exit(status);
    }
  }
}
