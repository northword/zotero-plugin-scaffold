import { BuildOptions } from "esbuild";

export interface ConfigBase {
  /**
   * The source code directories.
   *
   * Can be multiple directories, and changes to these directories will be watched when `server` is running.
   *
   * 源码目录。
   *
   * 可以是多个目录，将在 `server` 运行时监听这些目录的变更。
   *
   * @default ["src"]
   */
  source?: string[];
  /**
   * The build directories.
   *
   * Scaffold will store the code before packaging after the build at `${dist}/addon`.
   * Store the packaging results at `${dist}/${package_json.name}.xpi`.
   *
   * 构建目录。
   *
   * 脚手架将在 `${dist}/addon` 存放构建后打包前的代码。
   * 在 `${dist}/${package_json.name}.xpi` 存放打包结果。
   *
   * @default "build"
   */
  dist?: string;
  /**
   * glob list of static assets
   *
   * 静态资源文件。
   *
   * - 通常包括图标、ftl 文件、第三方 JavaScript 文件、CSS 文件、XHTML 文件等。
   * - 是一个 `glob` 列表，在 `assetsIgnore` 中定义此列表的排除项。
   * - 除非一个目录没有需要排除的文件，否则不要添加整个目录。
   *
   * @default * `["src/**\/*.*"]`
   */
  assets?: string[];
  /**
   * glob list of static assets
   *
   * 静态资源排除目录。
   *
   * 通常是需要经过其他构建或打包的源文件。
   *
   * @default * `["src/**\/*.ts"]`
   */
  assetsIgnore?: string[];
  /**
   * placeholders to replace in static assets
   *
   * 静态资源文本占位符。
   *
   * - 在构建时，脚手架使用占位符的 key 建立正则模式 `/__${key}__/g`，并将匹配到的内容替换为 `value`。
   *   - `package.json` 中定义的 `name`, `description`, `version`, `homepage` 将始终作为占位符。
   *   - `package.json` 中 `config` 属性的所有属性也将作为占位符。
   *   - 内置 `__buildTime__` 占位符，值为 `build.run` 调用时间。
   *   - 以上占位符可在此处重新定义以覆盖。
   * - 替换发生在 `dist/addon` 下的所有文件。
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
   * The config of esbuild
   *
   * esbuild 配置
   *
   * 注意：
   * - 默认配置中 `source` 和 `dist` 会跟随用户配置.
   * - 此项配置会覆盖默认配置而不是在默认配置列表上新增.
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
   *   outfile: `build/addon/${config.addonRef}.js`,
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
  /**
   * The function called when build-in build resolved.
   *
   * Usually some extra build process.
   * All configurations will be parameterized to this function.
   *
   * 在默认构建步骤执行结束后执行的函数.
   *
   * 通常是一些额外的构建流程.
   * 所有的配置将作为参数传入此函数.
   */
  onBuildResolved?: (options: Config) => any;
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
