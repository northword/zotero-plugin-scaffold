import { cosmiconfig, cosmiconfigSync } from "cosmiconfig";
import { BuildOptions } from "esbuild";
import path from "path";

export interface Config {
  addon: {
    addonName: string;
    addonDescription: string;
    addonID: string;
    addonRef: string;
    addonInstance: string;
    prefsPrefix: string;
  };
  /**
   * source code dir
   *
   * 源码目录
   *
   * @default "src"
   */
  source?: string;
  /**
   * build dir
   *
   * 构建目录
   *
   * @default "build"
   */
  dist?: string;
  /**
   * glob list of static assets
   *
   * 静态资源目录，包括图标、ftl 文件、第三方 js 文件、css、xhtml 等
   *
   * @default *`["addon/**\/*"]`
   */
  assets?: string[];

  stringsToReplace?: {
    [key: string]: any;
  };
  fluent?: {
    prefixLocaleFiles?: boolean;
    prefixFluentMessages?: boolean;
  };
  /**
   * esbuild config
   *
   * esbuild 配置
   *
   * @default
   *
   * ```js
   * {
   *   entryPoints: ["src/index.ts"],
   *   define: {
   *     __env__: `"${env.NODE_ENV}"`,
   *   },
   *   bundle: true,
   *   target: "firefox102",
   *   outfile: path.join(
   *     buildDir,
   *     `addon/${config.addonRef}.js`,
   *   ),
   *   minify: env.NODE_ENV === "production",
   * };
   * ```
   */
  esbuild?: BuildOptions[];
  makeManifest?: { enable?: boolean; templatePath?: string };
  makeBootstrap?: boolean;
  makeUpdateJson?: {
    enable?: boolean | "only-production";
    templatePath?: string;
    distPath?: string;
  };
  addonLint?: {
    //
  };
}

export const ZoteroPluginDev = (options: Config): Config => {
  const cwd = process.cwd();

  return {
    addon: options.addon,
    source: path.join(process.cwd(), options.source ?? "src"),
    dist: path.join(process.cwd(), options.dist ?? "build"),
    assets: options.assets ?? ["addon/**/*"],
    stringsToReplace: options.stringsToReplace ?? {},
  };
};

function getConfig() {
  const explorer = cosmiconfig("zotero-plugin");

  // Search for a configuration by walking up directories.
  // See documentation for search, below.
  explorer
    .search()
    .then((result) => {
      // result.config is the parsed configuration object.
      // result.filepath is the path to the config file that was found.
      // result.isEmpty is true if there was nothing to parse in the config file.
    })
    .catch((error) => {
      // Do something constructive.
    });

  // // Load a configuration directly when you know where it should be.
  // // The result object is the same as for search.
  // // See documentation for load, below.
  // explorer.load(pathToConfig).then(/* ... */);

  // // You can also search and load synchronously.
  // const explorerSync = cosmiconfigSync(moduleName);

  // // const searchedFor = explorerSync.search();
  // // const loaded = explorerSync.load(pathToConfig);
}
