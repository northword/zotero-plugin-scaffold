// eslint.config.mjs
import antfu from "@antfu/eslint-config";

export default antfu({
  javascript: true,
  typescript: true,
  stylistic: {
    semi: true,
    quotes: "double",
  },
  formatters: true,
  ignores: ["packages/eslint-config/src/typegen.ts"],
});
