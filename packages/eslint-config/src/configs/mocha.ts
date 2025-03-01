import type { Linter } from "eslint";
import mochaPlugin from "eslint-plugin-mocha";
import { GLOB_TEST } from "../globs.js";

export const mocha: Linter.Config[] = [
  // @ts-expect-error seems a bug to @types/eslint@9.6.0
  {
    files: [GLOB_TEST],
    ...mochaPlugin.configs.flat.recommended,
  },
];
