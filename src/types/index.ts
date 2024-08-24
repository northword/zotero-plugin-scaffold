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
  templateDate: { [placeholder: string]: string };
}

export { UserConfig, OverrideConfig, Config, Context, Hooks };
