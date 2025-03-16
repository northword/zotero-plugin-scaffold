import type { BuildContext, BuildResult } from "esbuild";
import type { Context } from "../..//types/index.js";
import { context } from "esbuild";
import { copy, outputFile, outputJSON, pathExists } from "fs-extra/esm";
import { glob } from "tinyglobby";
import { saveResource } from "../../utils/file.js";
import { logger } from "../../utils/logger.js";
import { toArray } from "../../utils/string.js";
import { CACHE_DIR, TESTER_PLUGIN_DIR } from "../constant.js";
import { generateBootstrap, generateManifest } from "./create-proxy-plugin/bootsrtap.js";
import { generateHtml, generateMochaSetup } from "./create-proxy-plugin/mocha-setup.js";

export class TestRunnerPlugin {
  private esbuildContext?: BuildContext;
  constructor(
    private ctx: Context,
    private port: number,
  ) {
    //
  }

  async generate() {
    // this.generatePluginRes
    //   bootstrape
    //   manifest
    //   copy lib
    //   bundle tests
    await this.generatePluginRes();

    // this.generateTestPage
    //   mocha setup
    //   html
    await this.generateTestPage();
  }

  async regenerate(changedFile: string) {
    // re-bundle tests
    const esbuildResult = await this.esbuildContext?.rebuild();

    // get affected tests
    const tests = this.getAffectedTests(changedFile, esbuildResult?.metafile);

    // this.generateTestPage
    //   mocha setup
    //   html
    await this.generateTestPage(tests);
  }

  private async generatePluginRes() {
    // bootstrape
    const manifest = generateManifest();
    await outputJSON(`${TESTER_PLUGIN_DIR}/manifest.json`, manifest, { spaces: 2 });

    // manifest
    const bootstrap = generateBootstrap({
      port: this.port,
      startupDelay: this.ctx.test.startupDelay,
      waitForPlugin: this.ctx.test.waitForPlugin,
    });
    await outputFile(`${TESTER_PLUGIN_DIR}/bootstrap.js`, bootstrap);

    // copy lib
    await this.copyTestLibraries();

    // bundle tests
    await this.bundleTests();
  }

  private async copyTestLibraries() {
    // Save mocha and chai packages
    const pkgs: {
      name: string;
      remote: string;
      local: string;
    }[] = [
      {
        name: "mocha.js",
        local: "node_modules/mocha/mocha.js",
        remote: "https://cdn.jsdelivr.net/npm/mocha/mocha.js",
      },
      {
        name: "chai.js",
        // local: "node_modules/chai/chai.js",
        local: "", // chai packages install from npm do not support browser
        remote: "https://www.chaijs.com/chai.js",
      },
    ];

    await Promise.all(pkgs.map(async (pkg) => {
      const targetPath = `${TESTER_PLUGIN_DIR}/content/${pkg.name}`;

      if (pkg.local && await pathExists(pkg.local)) {
        logger.debug(`Local ${pkg.name} package found`);
        await copy(pkg.local, targetPath);
        return;
      }

      const cachePath = `${CACHE_DIR}/${pkg.name}`;
      if (await pathExists(`${cachePath}`)) {
        logger.debug(`Cache ${pkg.name} package found`);
        await copy(cachePath, targetPath);
        return;
      }

      logger.info(`No local ${pkg.name} found, we recommend you install ${pkg.name} package locally.`);
      await saveResource(pkg.remote, `${CACHE_DIR}/${pkg.name}`);
      await copy(cachePath, targetPath);
    }));
  }

  private async bundleTests() {
    const testDirs = toArray(this.ctx.test.entries);
    // Because esbuild only support `*` and `**`，
    // so we need glob ourselves.
    // https://esbuild.github.io/api/#glob-style-entry-points
    const entryPoints = (await Promise.all(testDirs.map(dir => glob(`${dir}/**/*.spec.{js,ts}`))))
      .flat();

    // Bundle all test files, including both JavaScript and TypeScript
    this.esbuildContext = await context({
      entryPoints,
      outdir: `${TESTER_PLUGIN_DIR}/content/units`,
      bundle: true,
      target: "firefox115",
      metafile: true,
    });
    await this.esbuildContext.rebuild();
  }

  private async generateTestPage(tests: string[] = []) {
    // mocha setup
    const setupCode = generateMochaSetup({
      timeout: this.ctx.test.mocha.timeout,
      port: this.port,
      abortOnFail: this.ctx.test.abortOnFail,
      exitOnFinish: this.ctx.test.exitOnFinish,
    });

    // html
    let testFiles = tests;
    if (testFiles.length === 0) {
      testFiles = (await glob(`**/*.spec.js`, { cwd: `${TESTER_PLUGIN_DIR}/content` })).sort();
    }
    const html = generateHtml(setupCode, testFiles);
    await outputFile(`${TESTER_PLUGIN_DIR}/content/index.xhtml`, html);
  }

  /**
   * 给定源码路径，查找导入了该文件的所有 output file
   */
  private getAffectedTests(changedFile: string, metafile: BuildResult["metafile"]): string[] {
    if (!metafile)
      return [];

    const affectedEntries = new Set<string>();

    for (const [path, info] of Object.entries(metafile.outputs)) {
      for (const imp of info.imports) {
        if (imp.path === changedFile) {
          affectedEntries.add(path);
        }
      }
    }

    return [...affectedEntries];
  }
}
