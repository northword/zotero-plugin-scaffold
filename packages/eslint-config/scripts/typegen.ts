import { writeFile } from "node:fs/promises";
import { flatConfigsToRulesDTS } from "eslint-typegen/core";
import { builtinRules } from "eslint/use-at-your-own-risk";
import zotero from "../src";

const dts = await flatConfigsToRulesDTS(
  await zotero(
    {
      overrides: {
        plugins: {
          "": {
            rules: Object.fromEntries(builtinRules),
          },
        },
      },
    },
  ),
  { includeAugmentation: false, exportTypeName: "Rules" },
);

await writeFile("src/typegen.ts", dts);

console.log("Type definitions generated!");
