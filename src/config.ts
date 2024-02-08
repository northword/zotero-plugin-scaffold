import { Config, UserConfig } from "./types";
import { cosmiconfig } from "cosmiconfig";
import * as dotenv from "dotenv";
import { default as fs } from "fs-extra";
import _ from "lodash";
import path from "path";
import { fileURLToPath } from "url";

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
 * @param [file="zotero-plugin.config.{ts,js,mjs,cjs}"] The path of config file.
 * @returns Config with userDefined and defaultConfig merged.
 */
export async function loadConfig(file?: string): Promise<Config> {
  // load user defined config file
  // Do not use the sync method, as the sync method only supports compiling configuration files into cjs modules.
  const explorer = cosmiconfig("zotero-plugin"),
    result = await explorer.search(file);
  const userConfig: UserConfig = result?.config ?? {};

  // load `.env` file.
  const dotenvResult = dotenv.config({
    path: path.resolve(process.cwd(), userConfig.dotEnvPath ?? ".env"),
  }).parsed;
  // if (!dotenvResult) throw new Error(".env file not found");

  // Load user's package.json
  const pkg = fs.readJsonSync(path.join("package.json"), {
    encoding: "utf-8",
  });

  // define addon config 防呆
  const addonName =
      userConfig.define?.addonName ||
      pkg.config?.addonName ||
      _.startCase(pkg.name) ||
      "",
    addonRef =
      userConfig.define?.addonRef ||
      pkg.config?.addonRef ||
      _.kebabCase(addonName),
    xpiName = userConfig.define?.xpiName || pkg.name || _.kebabCase(addonName),
    [, owner, repo] = (pkg.repository?.url ?? "").match(
      /:\/\/github.com\/([^/]+)\/([^.]+)\.git$/,
    ),
    releasePage =
      userConfig.define?.releasePage ||
      (owner && repo ? `https://github.com/${owner}/${repo}/release` : ""),
    isPreRelease = pkg.version.includes("-");

  // define default config.
  const defaultConfig = {
    source: ["src"],
    dist: "build",
    assets: ["src/**/*.*", "!src/**/*.ts"],
    define: {
      addonName: addonName,
      addonID: pkg.config?.addonID || "",
      description: pkg.description || "",
      homepage: pkg.homepage,
      author: pkg.author,
      ghOwner: owner,
      ghRepo: repo,
      addonRef: pkg.config?.addonRef || _.kebabCase(addonName),
      addonInstance: pkg.config?.addonInstance || _.camelCase(addonName),
      prefsPrefix: `extensions.zotero.${addonRef}`,
      xpiName: xpiName,
      releasePage: releasePage,
      updateURL: `${releasePage}/download/${userConfig.makeUpdateJson?.tagName || "release"}/${isPreRelease ? "update-beta" : "update"}.json`,
      updateLink: `${releasePage}/download/v${pkg.version}/${xpiName}.xpi`,
      buildVersion: pkg.version,
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
          userConfig.dist || "build",
          `addon/${addonRef || "index"}.js`,
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
    release: {
      // releaseIt: {
      //   preReleaseId: "beta",
      //   git: {
      //     tagName: "v${version}",
      //     requireCleanWorkingDir: false,
      //   },
      //   npm: {
      //     publish: false,
      //   },
      //   github: {
      //     assets: [`${userConfig.dist}/*.xpi`],
      //   },
      // },
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
    dotEnvPath: ".env",
    pkgUser: pkg,
    pkgAbsolute: path.join(path.dirname(fileURLToPath(import.meta.url)), "../"),
  } satisfies Config;

  // merge config
  const config = _.defaultsDeep(userConfig, defaultConfig);
  return config;
}
