import { Config, Hooks } from "./config.js";
import { Hookable } from "hookable";

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

type RequiredRecursively<T> = {
  [K in keyof T]-?: T[K] extends object ? RequiredRecursively<T[K]> : T[K];
};

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
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
  xpiName: string;
  version: string;
  hooks: Hookable<Hooks>;
  templateDate: { [placeholder: string]: string };
}

export { OverrideConfig, UserConfig, Config, Context };
