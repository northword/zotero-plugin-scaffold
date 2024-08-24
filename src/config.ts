import path from "node:path";
import { loadConfig as c12 } from "c12";
import fs from "fs-extra";
import { createHooks } from "hookable";
import { kebabCase, mapValues } from "es-toolkit";
import type { Config, Context, Hooks, OverrideConfig, UserConfig } from "./types/index.js";
import { Log } from "./utils/log.js";
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
  const logger = new Log(config);

  // Load user's package.json
  const pkgUser = fs.readJsonSync(path.join("package.json"), {
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
  const templateDate = {
    owner,
    repo,
    version,
    isPreRelease,
    updateJson: isPreRelease ? "update-beta.json" : "update.json",
    xpiName: config.xpiName,
    buildTime: dateFormat("YYYY-mm-dd HH:MM:SS", new Date()),
  };
  config.updateURL = template(config.updateURL, templateDate);
  config.xpiDownloadLink = template(config.xpiDownloadLink, templateDate);
  config.build.define = mapValues(config.build.define, v => template(v, templateDate));

  const hooks = createHooks<Hooks>();
  hooks.addHooks(config.build.hooks);
  hooks.addHooks(config.server.hooks);
  hooks.addHooks(config.release.hooks);

  const ctx: Context = {
    ...config,
    pkgUser,
    version,
    hooks,
    logger,
    templateDate,
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
      enable: true,
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
      confirm: true,
      preid: "beta",
      // execute: "npm run build",
      all: false,
      commit: "chore(publish): release v%s",
      tag: "v%s",
    },
    changelog: "",
    github: {
      enable: "ci",
      updater: "release",
      comment: false,
      releaseNote(ctx) {
        return ctx.release.changelog;
      },
    },
    gitee: {
      enable: "false",
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
