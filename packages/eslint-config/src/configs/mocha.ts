import type { Linter } from "eslint";
// @ts-expect-error version 11.0.0 of eslint-plugin-mocha has no types
// https://github.com/lo1tuma/eslint-plugin-mocha/issues/375
import mochaPlugin from "eslint-plugin-mocha";
import { GLOB_TEST } from "../globs.js";

export const mocha: Linter.Config[] = [
  {
    files: [GLOB_TEST],
    ...mochaPlugin.configs.recommended,
  },
];
