import { BuildOptions } from "esbuild";

export interface ConfigBase {
  /**
   * source code dir
   *
   * 源码目录
   *
   * @default ["src"]
   */
  source?: string[];
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
   * @default * `["src/** /*.*"]`
   */
  assets?: string[];
  /**
   * glob list of static assets
   *
   * 静态资源目录，包括图标、ftl 文件、第三方 js 文件、css、xhtml 等
   *
   * @default * `["src/** /*.ts"]`
   */
  assetsIgnore?: string[];
  /**
   * placeholders to replace in static assets
   *
   * 静态资源文本占位符，在构建时将 `__key__` 会被替换为 `value`
   *
   */
  placeholders?: {
    [key: string]: any;
    addonName?: string;
    addonDescription?: string;
    addonID?: string;
    addonRef?: string;
    addonInstance?: string;
    prefsPrefix?: string;
    updateJSON?: string;
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
   *     Config.dist,
   *     `addon/${config.addonRef}.js`,
   *   ),
   *   minify: env.NODE_ENV === "production",
   * };
   * ```
   */
  esbuildOptions?: BuildOptions[];
  makeManifest?: { enable?: boolean; templatePath?: string };
  makeBootstrap?: boolean;
  makeUpdateJson?: {
    enable?: boolean | "only-production";
    templatePath?: string;
    distPath?: string;
  };
  addonLint?: object;
  cmdPath?: string;
}

export interface Config extends Required<ConfigBase> {
  cmd: {
    zoteroBinPath: string;
    profilePath: string;
    dataDir: string;
  };
}
