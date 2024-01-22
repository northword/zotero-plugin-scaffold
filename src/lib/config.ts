import { Config, ConfigBase } from "../types";
import { cosmiconfig } from "cosmiconfig";
import * as dotenv from "dotenv";
import { default as fs } from "fs-extra";
import _ from "lodash";
import path from "path";

/**
 * Define the configuration.
 *
 * Defines the configuration in the parameters of this function to provide type checking for user configurations.
 * @param [userConfig]
 * @returns Config with userDefined.
 */
export const defineConfig = (userConfig: ConfigBase): ConfigBase => {
  return userConfig;
};

/**
 * Loads config
 * @param [file="zotero-plugin.config.{ts,js,mjs,cjs}"] The path of config file.
 * @returns Config with userDefined and defaultConfig merged.
 */
export async function loadConfig(file?: string): Promise<Config> {
  // load user defined config file
  // Do not use the sync method, as the sync method only supports compiling configuration files into cjs modules.
  const explorer = cosmiconfig("zotero-plugin"),
    result = await explorer.search(file);
  const userConfig: ConfigBase = result?.config ?? {};

  // load `.env` file.
  const dotenvResult = dotenv.config({
    path: path.resolve(process.cwd(), userConfig.dotEnvPath ?? ".env"),
  }).parsed;
  if (!dotenvResult) throw new Error(".env file not found");

  // Load user's package.json
  const pkg = fs.readJsonSync(path.join("package.json"), {
    encoding: "utf-8",
  });

  // Check package.json
  if (
    !(pkg.name || userConfig.placeholders.name) ||
    !(pkg.description || userConfig.placeholders.description) ||
    !(pkg.author || userConfig.placeholders.author) ||
    !(pkg.homepage || userConfig.placeholders.homepage) ||
    !(pkg.repository?.url || userConfig.placeholders.releasePage)
  )
    throw new Error(
      "Some build-in placeholders invalid. May be caused by incomplete package.json property.",
    );

  const [, owner, repo] = (pkg.repository?.url ?? "").match(
    /:\/\/github.com\/([^/]+)\/([^.]+)\.git$/,
  );

  // define default config.
  const defaultConfig = {
    source: ["src"],
    dist: "build",
    assets: ["src/**/*.*", "!src/**/*.ts"],
    placeholders: {
      name: pkg.name,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      author: pkg.author,
      addonName: "Example Plugin for Zotero",
      addonID: "examplePluginID@northword.cn",
      addonRef: "exampleplugin",
      addonInstence: "ExamplePlugin",
      prefsPrefix: "extensions.exampleplugin.",
      releasePage: `https://github.com/${owner}/${repo}/release`,
    },
    fluent: {
      prefixFluentMessages: true,
      prefixLocaleFiles: true,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox102",
        outfile: path.join(
          process.cwd(),
          userConfig.dist ?? "build",
          `addon/${userConfig.placeholders.addonRef ?? "index"}.js`,
        ),
        minify: process.env.NODE_ENV === "production",
      },
    ],
    makeBootstrap: true,
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
      tagName: "release",
      template: {
        addons: {
          __addonID__: {
            updates: [
              {
                version: "__version__",
                update_link: "__updateLink__",
                update_hash: "__updateHash__",
                applications: {
                  zotero: {
                    strict_min_version: "6.999",
                  },
                },
              },
            ],
          },
        },
      },
    },
    extraServer: () => {},
    extraBuilder: () => {},
    addonLint: {},
    dotEnvPath: ".env",
    cmd: {
      zoteroBinPath: dotenvResult["zoteroBinPath"],
      profilePath: dotenvResult["profilePath"],
      dataDir: dotenvResult["dataDir"],
    },
    pkg: pkg,
    release: {
      releaseIt: {
        preReleaseId: "beta",
        git: {
          tagName: "v${version}",
          requireCleanWorkingDir: false,
        },
        npm: {
          publish: false,
        },
        github: {
          assets: [`${userConfig.dist}/*.xpi`],
        },
      },
      bumpp: {
        release: "prompt",
        preid: "beta",
        // execute: "npm run build",
        all: true,
        commit: "Release v%s",
        tag: "v%s",
        push: true,
      },
    },
    logLevel: "info",
  } satisfies Config;

  // merge config
  const config = _.defaultsDeep(userConfig, defaultConfig);
  return config;
}
