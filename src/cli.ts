import { Build, Config, Create, Release, Serve } from "./index.js";
import { ConfigOptional } from "./types.js";
import { Logger } from "./utils/logger.js";
import { Command } from "commander";
import { default as fs } from "fs-extra";
import _ from "lodash";
import path from "path";
import updateNotifier from "update-notifier";
import { fileURLToPath } from "url";

export default async function main() {
  // Use readFileSync instead of import json to avoid loging warning
  const pkg = fs.readJsonSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../package.json"),
    {
      encoding: "utf-8",
    },
  );
  updateNotifier({ pkg: pkg }).notify();

  // Env variables are initialized to dev, but can be overridden by each command
  // For example, "zotero-plugin build" overrides them to "production"
  process.env.NODE_ENV ??= "development";

  const cli = new Command();
  cli.version(pkg.version).usage("<command> [options]");

  cli
    .command("build")
    .description("Build the plugin.")
    .option("--dev", "Builds the plugin in dev mode.")
    .option(
      "--dist <dir>",
      "the full path for the new output directory, relative to the current workspace (default: build)",
    )
    .option(
      "--config <config>",
      "path to zotero-plugin config file (default: `zotero-plugin.config.ts`)",
    )
    .action(async (options: any) => {
      const configFile = await Config.loadConfig(options.config);
      const configCli: ConfigOptional = {
        dist: options.dist,
      };
      const configMerged = _.merge(configFile, configCli);
      new Build(configMerged, options.dev ? "development" : "production").run();
    });

  cli
    .command("serve")
    .description("Start development server.")
    // .option(
    //   "--skip-build",
    //   "skip building website before deploy it (default: false)",
    // )
    // .option(
    //   "--only-start",
    //   "skip building website before deploy it (default: false)",
    // )
    .action(async (options: any) => {
      const configFile = await Config.loadConfig(options.config);
      const configCli: ConfigOptional = {
        //
      };
      const configMerged = _.merge(configFile, configCli);
      new Serve(configMerged).run();
    });

  cli
    .command("create")
    .description("Create the plugin template.")
    .action((options: any) => {
      console.log("The rreate not yet implemented");
      new Create().run();
    });

  cli
    .command("release")
    .description("Release.")
    .action(async (options: any) => {
      const configFile = await Config.loadConfig(options.config);
      const configCli: ConfigOptional = {
        //
      };
      const configMerged = _.merge(configFile, configCli);
      new Release(configMerged).run();
    });

  cli.arguments("<command>").action((cmd) => {
    cli.outputHelp();
    Logger.error(`Unknown command name=${cmd}.`);
  });

  cli.parse(process.argv);
}
