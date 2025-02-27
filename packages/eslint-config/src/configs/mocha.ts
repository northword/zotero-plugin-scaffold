import type { Linter } from "eslint";
import mochaPlugin from "eslint-plugin-mocha";
import { GLOB_TEST } from "../globs.js";

export const mocha: Linter.Config[] = [
  {
    files: [GLOB_TEST],
    ...mochaPlugin.configs.flat.recommended,
  },
];
