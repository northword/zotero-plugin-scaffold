import type { WebExtRunInstance } from "web-ext";
import type { Context } from "../types/index.js";
import fs from "node:fs/promises";
import http from "node:http";
import { resolve } from "node:path";
import process, { env } from "node:process";
import generate from "@babel/generator";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import fsExtra from "fs-extra/esm";
import webext from "web-ext";
import { saveResource } from "../utils/file.js";
import { patchWebExtLogger } from "../utils/log.js";
import { getValidatedManifest } from "../utils/manifest.js";
import { Base } from "./base.js";
import Build from "./builder.js";

export default class Test extends Base {
  private builder: Build;
  private _runner?: WebExtRunInstance;
  private _profileDir?: string;
  private _dataDir?: string;
  private _resourceDir?: string;
  private _server?: http.Server;

  get startArgs() {
    const args = [
      "--purgecaches",
      "--jsdebugger",
      "--no-remote",
    ];
    if (!this._dataDir) {
      return args;
    }
    args.push("--dataDir", this._dataDir);
    return args;
  }

  constructor(ctx: Context) {
    super(ctx);
    this.builder = new Build(ctx);
    env.NODE_ENV ??= "test";
  }

  async run() {
    // Handle interrupt signal (Ctrl+C) to gracefully terminate Zotero process
    // Must be placed at the top to prioritize registration of events to prevent web-ext interference
    process.on("SIGINT", this.exit);

    await this.ctx.hooks.callHook("test:init", this.ctx);

    // prebuild
    await this.builder.run();
    await this.ctx.hooks.callHook("test:prebuild", this.ctx);

    await patchWebExtLogger(this.ctx);

    await this.startTestServer();
    await this.ctx.hooks.callHook("test:listen", this.ctx);

    await this.prepareDir();

    await this.ctx.hooks.callHook("test:mkdir", this.ctx);

    await this.modifyBootstrap();

    await this.injectTestResources();

    await this.ctx.hooks.callHook("test:copyAssets", this.ctx);

    await this.injectTests();

    await this.ctx.hooks.callHook("test:bundleTests", this.ctx);

    await this.start();

    await this.ctx.hooks.callHook("test:run", this.ctx);
  }

  async prepareDir() {
    const { dist } = this.ctx;

    this._profileDir = resolve(`${dist}/testTmp/profile`);
    this._dataDir = resolve(`${dist}/testTmp/data`);
    this._resourceDir = resolve(`${this.ctx.dist}/addon/${this.ctx.test.resourceDir}`);

    await fsExtra.emptyDir(this._profileDir);
    await fsExtra.emptyDir(this._dataDir);
    await fs.mkdir(this._resourceDir, { recursive: true });

    this.logger.success(`Prepared test directories: profile=${this._profileDir}, data=${this._dataDir}, resource=${this._resourceDir}`);
  }

  async modifyBootstrap() {
    const filePath = resolve(`${
      this.ctx.dist
    }/addon/bootstrap.js`);
    const resourceRef = `${this.ctx.namespace}-test`;
    const newCode = `
/**
 * Code added by the zotero-plugin-scaffold test runner
 * This code will be executed when the plugin is loaded in test mode
 */

(() => {
  const aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  let chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "${resourceRef}", rootURI + "${this.ctx.test.resourceDir}"],
  ]);
  Zotero.Plugins.addObserver({
    shutdown: ({ id }) => {
      if (id === "${this.ctx.id}") {
        if (chromeHandle) {
          chromeHandle.destruct();
          chromeHandle = null;
        }
      }
    },
  });
  Services.ww.openWindow(
    null,
    "chrome://${resourceRef}/content/index.xhtml",
    "${this.ctx.namespace}-test",
    "chrome,centerscreen,resizable=yes",
    {}
  );
})();

/*
 * End of code added by the zotero-plugin-scaffold test runner
 */
`;

    try {
    // Read the JavaScript file
      const code = await fs.readFile(filePath, "utf8");

      // Parse the code into an AST
      const ast = parse(code, {
        sourceType: "module",
      });

      // Traverse the AST to find the `startup` function
      traverse.default(ast, {
        FunctionDeclaration(path) {
          if (path?.node?.id?.name === "startup") {
          // Convert new lines to AST nodes
            const newLine = t.expressionStatement(t.identifier(newCode));

            // Add new lines at the end of the `startup` function
            path.node.body.body.push(newLine);
          }
        },
      });

      // Generate modified code from the AST
      const modifiedCode = generate.default(ast).code;

      // Save the modified code back to the original file
      await fs.writeFile(filePath, modifiedCode);
      this.logger.success("Modified bootstrap.js for test mode");
    }
    catch (error: any) {
      this.logger.error(`Error modifying bootstrap.js: ${error.message}`);
    }
  }

  async injectTestResources() {
    const MOCHA_JS_URL = "https://cdn.jsdelivr.net/npm/mocha/mocha.js";
    // const MOCHA_CSS_URL = "https://cdn.jsdelivr.net/npm/mocha/mocha.css";
    const CHAI_JS_URL = "https://www.chaijs.com/chai.js";
    saveResource(MOCHA_JS_URL, resolve(`${this._resourceDir}/mocha.js`));
    // saveResource(MOCHA_CSS_URL, resolve(`${resourceDir}/mocha.css`));
    saveResource(CHAI_JS_URL, resolve(`${this._resourceDir}/chai.js`));
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
    await fs.writeFile(resolve(`${this._resourceDir}/index.xhtml`), html);

    this.logger.success("Injected test resources");
  }

  async injectTests() {
    // TODO: support TS tests
    const testDirs = typeof this.ctx.test.entries === "string" ? [this.ctx.test.entries] : this.ctx.test.entries;
    const testFiles: string[] = [];
    for (const testDir of testDirs) {
      for await (const file of fs.glob(resolve(`${testDir}/**/*.spec.js`))) {
        testFiles.push(file);
      }
    }
    // Sort the test files to ensure consistent test order
    testFiles.sort();

    // Concatenate all test files into a single file
    let testCode = `
mocha.setup({ ui: "bdd", reporter: Reporter });

window.expect = chai.expect;
window.assert = chai.assert;

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
    await fs.writeFile(resolve(`${this._resourceDir}/index.spec.js`), testCode);

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
              console.error("Error parsing JSON:", error);
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
    type: "start" | "suite" | "suite end" | "pending" | "pass" | "fail" | "end";
    data?: { title: string; str: string; duration?: number; stack?: string };
  }) {
    if (body.type === "pass") {
      this.logger.success(body.data?.str);
    }
    else if (body.type === "fail") {
      this.logger.error(body.data?.str);
      if (this.ctx.test.abortOnFail) {
        this.logger.error("Aborting test run due to failure");
        if (this.ctx.test.exitOnFinish)
          this.exit(1);
      }
    }
    else if (body.data?.str) {
      this.logger.info(body.data.str);
    }

    if (body.type === "end") {
      this.logger.info("Test run completed");
      this._server?.close();
      if (this.ctx.test.exitOnFinish)
        this.exit();
    }
  }

  async start() {
    const { dist } = this.ctx;
    const runner = await webext.cmd.run(
      {
        firefox: env.ZOTERO_PLUGIN_ZOTERO_BIN_PATH,
        firefoxProfile: this._profileDir,
        profileCreateIfMissing: true,
        sourceDir: resolve(`${dist}/addon`),
        keepProfileChanges: false,
        args: this.startArgs,
        pref: Object.assign({ "extensions.experiments.enabled": true,
          // Enable remote-debugging
          "devtools.debugger.remote-enabled": true, "devtools.debugger.remote-websocket": true, "devtools.debugger.prompt-connection": false,
          // Inherit the default test settings from Zotero
          "app.update.enabled": false, "extensions.zotero.sync.server.compressData": false, "extensions.zotero.automaticScraperUpdates": false, "extensions.zotero.debug.log": 5, "extensions.zotero.debug.level": 5, "extensions.zotero.debug.time": 5, "extensions.zotero.firstRun.skipFirefoxProfileAccessCheck": true, "extensions.zotero.firstRunGuidance": false, "extensions.zotero.firstRun2": false, "extensions.zotero.reportTranslationFailure": false, "extensions.zotero.httpServer.enabled": true, "extensions.zotero.httpServer.port": 23124, "extensions.zotero.httpServer.localAPI.enabled": true, "extensions.zotero.backup.numBackups": 0, "extensions.zotero.sync.autoSync": false, "extensions.zoteroMacWordIntegration.installed": true, "extensions.zoteroMacWordIntegration.skipInstallation": true, "extensions.zoteroWinWordIntegration.skipInstallation": true, "extensions.zoteroOpenOfficeIntegration.skipInstallation": true }, this.ctx.test.prefs || {}),
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
        getValidatedManifest,
      },
    );
    this._runner = runner;
    this._runner.registerCleanup(() => this.exit());
  }

  async exit(status = 0) {
    this._server?.close();
    await this._runner?.exit();

    await this.ctx.hooks.callHook("test:done", this.ctx);

    if (status === 0) {
      this.logger.success("Test run completed successfully");
      process.exit(0);
    }
    else {
      this.logger.error("Test run failed");
      process.exit(status);
    }
  }
}
