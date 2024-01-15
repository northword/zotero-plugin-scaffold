import pkg from "../package.json" assert { type: "json" };
// import beforeCli from "./beforeCli.mjs";
import { Build, Config } from "./index.js";
import { Logger } from "./utils.js";
import { Command } from "commander";

function cli() {
  const cli = new Command();
  cli.version(pkg.version).usage("<command> [options]");

  cli
    .command("build")
    .description("Build plugin.")
    .option(
      "--dev",
      "Builds the website in dev mode, including full React error messages.",
    )
    .option(
      "--bundle-analyzer",
      "visualize size of webpack output files with an interactive zoomable tree map (default: false)",
    )
    .option(
      "--out-dir <dir>",
      "the full path for the new output directory, relative to the current workspace (default: build)",
    )
    .option(
      "--config <config>",
      "path to docusaurus config file (default: `[siteDir]/docusaurus.config.js`)",
    )
    .option(
      "-l, --locale <locale>",
      "build the site in a specified locale. Build all known locales otherwise",
    )
    .option(
      "--no-minify",
      "build website without minimizing JS bundles (default: false)",
    )
    // @ts-expect-error: Promise<string> is not assignable to Promise<void>... but
    // good enough here.
    .action(Build);

  cli
    .command("server")
    .description("Start development server.")
    .option(
      "--skip-build",
      "skip building website before deploy it (default: false)",
    )
    .action(() => console.log("server"));

  cli.arguments("<command>").action((cmd) => {
    cli.outputHelp();
    Logger.error(`Unknown command name=${cmd}.`);
  });

  cli.parse(process.argv);
}

export default function main() {
  // Env variables are initialized to dev, but can be overridden by each command
  // For example, "zotero-plugin build" overrides them to "production"
  const config = Config.loadConfig();
  process.env.NODE_ENV ??= "development";
  // await beforeCli();
  cli();
}
