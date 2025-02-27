import { ignores } from "./configs/ignores.js";
import { javascript } from "./configs/javascript.js";
import { mocha } from "./configs/mocha.js";
import { specialCases } from "./configs/specialCases.js";
import { typescript } from "./configs/typescript.js";

export { ignores, javascript, mocha, specialCases, typescript };

export default function zotero() {
  return [
    ...ignores,
    ...javascript,
    ...typescript,
    ...specialCases,
    ...mocha,
  ];
}
