import { Context } from "./index.js";
import { Manifest } from "./manifest.js";
import { UpdateJSON } from "./update-json.js";
import { type VersionBumpOptions } from "bumpp";
import { BuildOptions } from "esbuild";

export interface Config {
  /**
   * The source code directories.
   *
   * Can be multiple directories, and changes to these directories will be watched when `server` is running.
   *
   * 源码目录。
   *
   * 可以是多个目录，将在 `server` 运行时监听这些目录的变更。
   *
   * @default "src"
   */
  source: string | string[];
  /**
   * The build directories.
   *
   * Scaffold will store the code before packaging after the build at `${dist}/addon`.
   * Store the packaging results at `${dist}/${package_json.name}.xpi`.
   *
   * 构建目录。
   *
   * 脚手架将在 `${dist}/addon` 存放构建后打包前的代码。
   * 在 `${dist}/${xpiName}.xpi` 存放打包结果。
   *
   * @default "build"
   */
  dist: string;

  /**
   * The name of plugin
   *
   * 插件名
   *
   */
  name: string;
  /**
   * The ID of plugin
   *
   * 插件 ID
   */
  id: string;
  /**
   * namespace of plugin
   *
   * 插件命名空间
   *
   * @default _.dash(name)
   */
  namespace: string;

  /**
   * XPI 文件的地址
   *
   * @default `https://github.com/{{owner}}/{{repo}}/release/download/v{{version}}/{{xpiName}}.xpi`
   */
  xpiDownloadLink: string;
  /**
   * update.json 文件的地址
   *
   * @default `https://github.com/{{owner}}/{{repo}}/release/download/release/update.json`
   */
  updateURL: string;

  /**
   * 构建所需的配置
   */
  build: BuildConfig;

  /**
   * serve 所需的配置
   */
  server: ServerConfig;

  /**
   * TODO: 使用 addonLint 检查 XPI
   */
  addonLint: object;

  /**
   * 发布相关配置
   *
   */
  release: {
    /**
     * bumpp 配置
     */
    bumpp: VersionBumpOptions;
  };
  /**
   * 日志级别
   *
   * @default "info"
   */
  logLevel: "trace" | "debug" | "info" | "warn" | "error";
}

export interface BuildConfig {
  /**
   * glob list of static assets
   *
   * 静态资源文件。
   *
   * - 通常包括图标、ftl 文件、第三方 JavaScript 文件、CSS 文件、XHTML 文件等。
   * - 是一个 `glob` 模式数组，支持否定模式。
   * - 除非一个目录没有需要排除的文件，否则不要添加整个目录。
   *
   * @see {@link https://github.com/mrmlnc/fast-glob?tab=readme-ov-file#pattern-syntax | Pattern syntax | 语法说明 }
   *
   * @example `["src/**\/*.*", "!src/**\/*.ts"]` (no `\`)
   * 
   * @default "addon/**\/*.*" (no `\`)
   */
  assets: string | string[];
  /**
   * placeholders to replace in static assets
   *
   * 静态资源文本占位符。
   *
   * - 在构建时，脚手架使用占位符的 key 建立正则模式 `/__${key}__/g`，并将匹配到的内容替换为 `value`。
   * - 替换发生在 `assets` 下的所有文件。
   */
  define: {
    [key: string]: string | unknown;
  };

  fluent: {
    /**
     * 为所有 FTL 文件添加插件前缀以避免冲突
     *
     * 默认前缀为 `${namespace}-`
     *
     * @default true
     */
    prefixLocaleFiles: boolean;
    /**
     * 为所有 FTL message 添加插件前缀以避免冲突
     *
     * 默认前缀为 `${namespace}-`
     *
     * @default true
     */
    prefixFluentMessages: boolean;
  };
  /**
   * The config of esbuild
   *
   * esbuild 配置
   *
   * @default []
   *
   */
  esbuildOptions: BuildOptions[];
  /**
   * Make manifest.json
   *
   */
  makeManifest: {
    /**
     * 是否自动管理 manifest.json。
     * 如果此项为 false，则开发者应自行准备 manifest.json
     *
     * @default true
     */
    enable: boolean;
    /**
     * template of manifest
     *
     * @default
     *
     * ```json
     * {
     *   manifest_version: 2,
     *   name: "${name}",
     *   version: "${version}",
     *   applications: {
     *     zotero: {
     *       id: "${id}",
     *       update_url: "${updateURL}",
     *       strict_min_version: "6.999",
     *       strict_max_version: "7.0.*",
     *     },
     *     gecko: {
     *       id: "${id}",
     *       update_url: "${updateURL}",
     *       strict_min_version: "102",
     *     };
     *   };
     * };
     * ```
     */
    template: Manifest;
  };
  /**
   * Make update manifest
   *
   * 生成 `update.json`
   *
   */
  makeUpdateJson: {
    /**
     * 是否启用
     *
     * @default true
     */
    enable: boolean | "only-production";
    /**
     * 已有的更新数据
     *
     * @default []
     */
    updates: UpdateJSON["addons"][string]["updates"];
    /**
     * 是否向 update.json 中写入 xpi 文件的 hash
     *
     * @default true
     */
    hash: boolean;
    // tagName: "release" | "updater" | string;
  };
  /**
   * The lifecycle hooks.
   */
  hooks: Partial<BuildHooks>;
}

interface BuildHooks {
  "build:init": (ctx: Context) => void | Promise<void>;
  "build:mkdir": (ctx: Context) => void | Promise<void>;
  "build:copyAssets": (ctx: Context) => void | Promise<void>;
  "build:makeManifest": (ctx: Context) => void | Promise<void>;
  "build:fluent": (ctx: Context) => void | Promise<void>;
  "build:replace": (ctx: Context) => void | Promise<void>;
  "build:bundle": (ctx: Context) => void | Promise<void>;
  "build:pack": (ctx: Context) => void | Promise<void>;
  "build:makeUpdateJSON": (ctx: Context) => void | Promise<void>;
  "build:done": (ctx: Context) => void | Promise<void>;
}

interface ServeHooks {
  "serve:init": (ctx: Context) => void | Promise<void>;
  "serve:prebuild": (ctx: Context) => void | Promise<void>;
  "serve:ready": (ctx: Context) => void | Promise<void>;
  "serve:onChanged": (ctx: Context, path: string) => void | Promise<void>;
  /**
   * asProxy=true 时无效
   */
  "serve:onReloaded": (ctx: Context) => void | Promise<void>;
  "serve:exit": (ctx: Context) => void;
}

export interface Hooks extends BuildHooks, ServeHooks {}

export interface ServerConfig {
  /**
   * 启动 Zotero 时附加的命令行参数
   *
   * @default ["--debugger", "--purgecaches"]
   */
  startArgs: string[];
  /**
   * 以 Proxy File 方式载入插件
   *
   * @default false
   */
  asProxy: boolean;
  /**
   * The lifecycle hook.
   */
  hooks: Partial<ServeHooks>;
}
