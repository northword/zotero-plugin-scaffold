import { Config, ConfigBase } from "../types";
import { cosmiconfig } from "cosmiconfig";
import * as dotenv from "dotenv";
import _ from "lodash";
import path from "path";

export const defineConfig = (userConfig: ConfigBase): ConfigBase => {
  return userConfig;
};

export async function loadConfig(file?: string): Promise<Config> {
  // load user defined config file
  // Do not use the sync method, as the sync method only supports compiling configuration files into cjs modules
  const explorer = cosmiconfig("zotero-plugin");
  const result = await explorer.search(file);
  const userConfig: ConfigBase = result?.config ?? {};

  // load .env file
  const dotenvResult = dotenv.config({
    path: path.resolve(process.cwd(), userConfig.cmdPath ?? ".env"),
  }).parsed;
  if (!dotenvResult) throw new Error(".env file not found");

  // define default config
  const defaultConfig: Config = {
    source: ["src"],
    dist: "build",
    assets: ["src/**/*.*"],
    assetsIgnore: ["src/**/*.ts"],
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
          `addon/${userConfig.placeholders?.addonRef ?? "index"}.js`,
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
    addonLint: {},
    cmdPath: "",
    cmd: {
      zoteroBinPath: dotenvResult["zoteroBinPath"],
      profilePath: dotenvResult["profilePath"],
      dataDir: dotenvResult["dataDir"],
    },
  };

  // merge config
  const config = _.defaultsDeep(userConfig, defaultConfig);
  return config;
}
