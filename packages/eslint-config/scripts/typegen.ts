import { writeFile } from "node:fs/promises";
import { flatConfigsToRulesDTS } from "eslint-typegen/core";
import zotero from "../src";

const dts = await flatConfigsToRulesDTS(
  zotero(),
  { includeAugmentation: false, exportTypeName: "Rules" },
);

await writeFile("src/typegen.ts", dts);

console.log("Type definitions generated!");
