import { Config, ConfigBase } from "../types";
import { cosmiconfig } from "cosmiconfig";
import * as dotenv from "dotenv";
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
    path: path.resolve(process.cwd(), userConfig.cmdPath ?? ".env"),
  }).parsed;
  if (!dotenvResult) throw new Error(".env file not found");

  // define default config.
  const defaultConfig = {
    source: ["src"],
    dist: "build",
    assets: ["src/**/*.*", "!src/**/*.ts"],
    placeholders: {},
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
          // 没想好这里怎么兼容 Zotero Plugin Template 的脚本将这里存为 addonRef.js
          // `addon/${userConfig.placeholders?.addonRef ?? "index"}.js`,
          `addon/index.js`,
        ),
        minify: process.env.NODE_ENV === "production",
      },
    ],
    makeBootstrap: true,
    makeManifest: {
      enable: true,
      // templatePath: "",
    },
    makeUpdateJson: { enable: true },
    onBuildResolved: () => {},
    addonLint: {},
    cmdPath: "",
    cmd: {
      zoteroBinPath: dotenvResult["zoteroBinPath"],
      profilePath: dotenvResult["profilePath"],
      dataDir: dotenvResult["dataDir"],
    },
  } satisfies Config;

  // merge config
  const config = _.defaultsDeep(userConfig, defaultConfig);
  return config;
}
