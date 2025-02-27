import type { Linter } from "eslint";
import type { Config } from "../types.js";
import tseslint from "typescript-eslint";
import { GLOB_DTS, GLOB_TS, GLOB_TSX } from "../globs.js";

export const typescriptCore = tseslint.config({
  extends: [...tseslint.configs.recommended],
  files: [GLOB_TS, GLOB_TSX],
  name: "zotero-plugin/typescript",
  rules: {
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unsafe-function-type": "off",
    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    }],
  },
}) as Config[];

export const typescript: Linter.Config[] = [
  ...typescriptCore,
  {
    files: [GLOB_DTS],
    name: "zotero-plugin/typescript/dts-rules",
    rules: {
      "eslint-comments/no-unlimited-disable": "off",
      "import/no-duplicates": "off",
      "no-restricted-syntax": "off",
      "unused-imports/no-unused-vars": "off",
    },
  },
];
