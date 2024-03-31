import { Config, Hooks } from "./config";
import { Hookable } from "hookable";

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

type RequiredRecursively<T> = {
  [K in keyof T]-?: T[K] extends object ? RequiredRecursively<T[K]> : T[K];
};

interface OverrideConfig extends RecursivePartial<Config> {}

interface UserConfig extends RecursivePartial<Config> {
  name: string;
  id: string;
  namespace: string;
  xpiDownloadLink: string;
  updateURL: string;
}

interface Context extends Config {
  pkgUser: any;
  version: string;
  hooks: Hookable<Hooks>;
  templateDate: { [placeholder: string]: string };
}

export { OverrideConfig, UserConfig, Config, Context };
