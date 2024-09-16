import type { Hookable } from "hookable";
import type { Log } from "../utils/log.js";
import type { Hooks } from "./config.js";
import { Config } from "./config.js";

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

/**
 * User config
 */
interface UserConfig extends RecursivePartial<Config> {}

interface OverrideConfig extends RecursivePartial<Config> {}

interface Context extends Config {
  pkgUser: any;
  version: string;
  hooks: Hookable<Hooks>;
  logger: InstanceType<typeof Log>;
  templateData: TemplateData;
}

export interface TemplateData {
  [placeholder: string]: string;
  /**
   * `owner` and `repo` will be extracted from the `repository` property in `package.json`.
   *
   * Note: Please distinguish between here and ReleaseConfig.github.owner,
   * which is only used for API requests and does not override the value here.
   */
  owner: string;
  repo: string;
  version: string;
  isPreRelease: string;
  updateJson: "update-beta.json" | "update.json" | string;
  xpiName: string;
  buildTime: string;
}

export { Config, Context, Hooks, OverrideConfig, UserConfig };
