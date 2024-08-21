import path from "node:path";
import { loadConfig as c12 } from "c12";
import fs from "fs-extra";
import { createHooks } from "hookable";
import { kebabCase, mapValues } from "es-toolkit";
import type { Config, Context, OverrideConfig, UserConfig } from "./types/index.js";
import { Log, bumppProgress } from "./utils/log.js";
import { dateFormat, template } from "./utils/string.js";

/**
 * Define the configuration.
 *
 * Defines the configuration in the parameters of this function to provide type checking for user configurations.
 * @param [userConfig]
 * @returns Config with userDefined.
 */
export function defineConfig(userConfig: UserConfig): UserConfig {
  return userConfig;
}

/**
 * Loads config
 * @param [overrides] Highest Priority Configuration.
 * @returns Config with userDefined and defaultConfig merged.
 */
export async function loadConfig(overrides?: OverrideConfig): Promise<Context> {
  const result = await c12<Config>({
    name: "zotero-plugin",
    dotenv: true,
    packageJson: true,
    // eslint-disable-next-line ts/no-use-before-define
    defaults: getDefaultConfig(),
    overrides: overrides as Config,
  });
  return resolveConfig(result.config as Config);
}

function resolveConfig(config: Config): Context {
  const logger = new Log(config);

  // Load user's package.json
  const pkg = fs.readJsonSync(path.join("package.json"), {
    encoding: "utf-8",
  });
  const [, owner, repo] = (pkg.repository?.url ?? "").match(
    /:\/\/.+com\/([^/]+)\/([^.]+)\.git$/,
  );

  if (!config.xpiName)
    config.xpiName = kebabCase(config.name);

  const templateDate = {
    owner,
    repo,
    version: pkg.version,
    isPreRelease: pkg.version.includes("-"),
    xpiName: config.xpiName,
    buildTime: dateFormat("YYYY-mm-dd HH:MM:SS", new Date()),
  };
  config.updateURL = template(config.updateURL, templateDate);
  config.xpiDownloadLink = template(config.xpiDownloadLink, templateDate);
  config.build.define = mapValues(config.build.define, v => template(v, templateDate));

  const ctx: Context = {
    ...config,
    pkgUser: pkg,
    version: pkg.version,
    hooks: createHooks(),
    logger,
    templateDate,
  };

  if (config.build.hooks) {
    ctx.hooks.addHooks(config.build.hooks);
  }
  if (config.server.hooks) {
    ctx.hooks.addHooks(config.server.hooks);
  }

  return ctx;
}

const defaultConfig = {
  source: "src",
  dist: "build",

  name: "",
  id: "",
  namespace: "",
  xpiName: "",
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",
  updateURL:
    "https://github.com/{{owner}}/{{repo}}/releases/download/release/update.json",

  build: {
    assets: "addon/**/*.*",
    define: {},
    fluent: {
      prefixFluentMessages: true,
      prefixLocaleFiles: true,
    },
    esbuildOptions: [],
    makeManifest: {
      enable: true,
      template: {
        manifest_version: 2,
        name: "__addonName__",
        version: "__buildVersion__",
        description: "__description__",
        homepage_url: "__homepage__",
        author: "__author__",
        icons: {
          48: "content/icons/favicon@0.5x.png",
          96: "content/icons/favicon.png",
        },
        applications: {
          zotero: {
            id: "__addonID__",
            update_url: "__updateURL__",
            strict_min_version: "6.999",
            strict_max_version: "7.0.*",
          },
          gecko: {
            id: "__addonID__",
            update_url: "__updateURL__",
            strict_min_version: "102",
          },
        },
      },
    },
    makeUpdateJson: {
      enable: true,
      updates: [],
      hash: true,
    },
    hooks: {},
  },
  server: {
    startArgs: [
      "--start-debugger-server",
      "--jsdebugger",
      "--debugger",
      "--purgecaches",
    ],
    asProxy: false,
    hooks: {},
  },
  addonLint: {},
  release: {
    bumpp: {
      release: "prompt",
      confirm: true,
      preid: "beta",
      // execute: "npm run build",
      all: false,
      commit: "chore(publish): release v%s",
      tag: "v%s",
      push: true,
      progress: bumppProgress,
    },
    changelog: "",
    github: {
      release: true,
      updater: "release",
      comment: false,
      releaseNote(ctx) {
        return ctx.release.changelog;
      },
    },
    gitee: {
      release: false,
      updater: "release",
      comment: false,
      releaseNote(ctx) {
        return ctx.release.changelog;
      },
    },
    hooks: {},
  },
  logLevel: "info",
} satisfies Config;

const getDefaultConfig = () => <Config>defaultConfig;
