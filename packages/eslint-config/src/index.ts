import type { Config } from "./types";
import { ignores } from "./configs/ignores.js";
import { javascript } from "./configs/javascript.js";
import { mocha } from "./configs/mocha.js";
import { specialCases } from "./configs/specialCases.js";
import { typescript } from "./configs/typescript.js";

export { ignores, javascript, mocha, specialCases, typescript };

export default function zotero(
  options: {
    overrides?: Config | Config[];
  } = {},
): Config[] {
  const config = [
    ...ignores,
    ...javascript,
    ...typescript,
    ...specialCases,
    ...mocha,
  ];

  if (options.overrides) {
    config.push(...Array.isArray(options.overrides) ? options.overrides : [options.overrides]);
  }

  return config;
}
