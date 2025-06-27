import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: "node16",
  rollup: {
    inlineDependencies: ["node-style-text", "changelogen"],
  },
  failOnWarn: false,
});
