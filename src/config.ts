import type { Config, Context, Hooks, OverrideConfig, UserConfig } from "./types/index.js";
import { loadConfig as c12 } from "c12";
import { kebabCase, mapValues } from "es-toolkit";
import { readJsonSync } from "fs-extra/esm";
import { createHooks } from "hookable";
import { logger } from "./utils/log.js";
import { dateFormat, parseRepoUrl, template } from "./utils/string.js";

/**
 * Helper for user define configuration.
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
  const result = await c12<UserConfig>({
    name: "zotero-plugin",
    dotenv: true,
    packageJson: true,
    // eslint-disable-next-line ts/no-use-before-define
    defaults: getDefaultConfig(),
    overrides,
  });
  return resolveConfig(result.config as Config);
}

function resolveConfig(config: Config): Context {
  logger.setLogLevel(config.logLevel);

  // Load user's package.json
  const pkgUser = readJsonSync("package.json", {
    encoding: "utf-8",
  });
  const { name, version } = pkgUser;
  const { owner, repo } = parseRepoUrl(pkgUser.repository?.url);

  // Parsing dynamic default values
  config.name ||= name;
  config.id ||= config.name;
  config.namespace ||= config.name;
  config.xpiName ||= kebabCase(config.name);

  // Parse template strings in config
  const isPreRelease = version.includes("-");
  const templateData = {
    owner,
    repo,
    version,
    isPreRelease,
    updateJson: isPreRelease ? "update-beta.json" : "update.json",
    xpiName: config.xpiName,
    buildTime: dateFormat("YYYY-mm-dd HH:MM:SS", new Date()),
  };
  config.updateURL = template(config.updateURL, templateData);
  config.xpiDownloadLink = template(config.xpiDownloadLink, templateData);
  config.build.define = mapValues(config.build.define, v => template(v, templateData));
  config.release.github.repository = template(config.release.github.repository, templateData);
  config.release.gitee.repository = template(config.release.gitee.repository, templateData);

  const hooks = createHooks<Hooks>();
  hooks.addHooks(config.build.hooks);
  hooks.addHooks(config.server.hooks);
  hooks.addHooks(config.release.hooks);
  hooks.addHooks(config.test.hooks);

  const ctx: Context = {
    ...config,
    pkgUser,
    version,
    hooks,
    logger,
    templateData,
  };

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
    "https://github.com/{{owner}}/{{repo}}/releases/download/release/{{updateJson}}",

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
      updates: [],
      hash: true,
    },
    hooks: {},
  },
  server: {
    devtools: true,
    startArgs: [],
    asProxy: false,
    hooks: {},
  },
  addonLint: {},
  release: {
    bumpp: {
      release: "prompt",
      preid: "beta",
      confirm: true,
      execute: "",
      all: false,
      commit: "chore(publish): release v%s",
      noVerify: false,
      tag: "v%s",
    },
    changelog: "",
    github: {
      enable: "ci",
      repository: "{{owner}}/{{repo}}",
      updater: "release",
      comment: false,
      releaseNote: (ctx) => {
        return ctx.release.changelog as string;
      },
    },
    gitee: {
      enable: "false",
      repository: "{{owner}}/{{repo}}",
      updater: "release",
      comment: false,
      releaseNote: (ctx) => {
        return ctx.release.changelog as string;
      },
    },
    hooks: {},
  },
  test: {
    entries: "test",
    prefs: {},
    mocha: {
      timeout: 10000,
    },
    port: 9876,
    abortOnFail: false,
    exitOnFinish: false,
    headless: false,
    startupDelay: 1000,
    waitForPlugin: "() => true",
    hooks: {},
  },
  logLevel: "info",
} satisfies Config;

const getDefaultConfig = () => <Config>defaultConfig;
