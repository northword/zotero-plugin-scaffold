import type { Hookable } from "hookable";
import type { ConsolaInstance } from "consola";
import type { Hooks } from "./config.js";
import { Config } from "./config.js";

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

interface OverrideConfig extends RecursivePartial<Config> {}

/**
 * User config
 *
 * 用户输入的配置，总配置全可选基础上添加部分为必填
 */
interface UserConfig extends RecursivePartial<Config> {
  name: string;
  id: string;
  namespace: string;
}

interface Context extends Config {
  pkgUser: any;
  version: string;
  hooks: Hookable<Hooks>;
  // logger: InstanceType<typeof Log>;
  logger: ConsolaInstance;
  templateDate: { [placeholder: string]: string };
}

export { OverrideConfig, UserConfig, Config, Context };
