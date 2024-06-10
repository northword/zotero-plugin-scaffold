import { Config, Context, OverrideConfig, UserConfig } from "./types/index.js";
import { bumppProgress } from "./utils/log.js";
import { dateFormat } from "./utils/string.js";
import { loadConfig as c12 } from "c12";
import fs from "fs-extra";
import { createHooks } from "hookable";
import path from "path";
import { dash, template } from "radash";

/**
 * Define the configuration.
 *
 * Defines the configuration in the parameters of this function to provide type checking for user configurations.
 * @param [userConfig]
 * @returns Config with userDefined.
 */
export const defineConfig = (userConfig: UserConfig): UserConfig => {
  return userConfig;
};

/**
 * Loads config
 * @param [override={}] Highest Priority Configuration.
 * @returns Config with userDefined and defaultConfig merged.
 */
export async function loadConfig(overrides?: OverrideConfig): Promise<Context> {
  const result = await c12<Config>({
    name: "zotero-plugin",
    dotenv: true,
    packageJson: true,
    defaults: getDefaultConfig(),
    overrides: overrides as Config,
  });
  return resolveConfig(result.config as Config);
}

function resolveConfig(config: Config): Context {
  // Load user's package.json
  const pkg = fs.readJsonSync(path.join("package.json"), {
      encoding: "utf-8",
    }),
    [, owner, repo] = (pkg.repository?.url ?? "").match(
      /:\/\/.*.com\/([^/]+)\/([^.]+)\.git$/,
    ),
    data = {
      owner: owner,
      repo: repo,
      version: pkg.version,
      isPreRelease: pkg.version.includes("-"),
      xpiName: dash(config.name),
      buildTime: dateFormat("YYYY-mm-dd HH:MM:SS", new Date()),
    };

  config.updateURL = template(config.updateURL, data);
  config.xpiDownloadLink = template(config.xpiDownloadLink, data);

  const ctx: Context = {
    ...config,
    pkgUser: pkg,
    xpiName: dash(config.name),
    version: pkg.version,
    hooks: createHooks(),
    templateDate: data,
  };

  if (config.build.hooks) {
    ctx.hooks.addHooks(config.build.hooks);
  }
  if (config.server.hooks) {
    ctx.hooks.addHooks(config.server.hooks);
  }

  return ctx;
}

const getDefaultConfig = () => <Config>defaultConfig;

const defaultConfig = {
  source: "src",
  dist: "build",

  name: "",
  id: "",
  namespace: "",
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
          "48": "content/icons/favicon@0.5x.png",
          "96": "content/icons/favicon.png",
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
  },
  logLevel: "info",
} satisfies Config;
