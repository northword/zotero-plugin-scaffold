#!/usr/bin/env node

import { env, exit } from "node:process";
import { Command } from "@commander-js/extra-typings";
import updateNotifier from "update-notifier";
import { name, version } from "../package.json";
import { Log } from "./utils/log.js";
import { Build, Config, Release, Serve } from "./index.js";

const logger = new Log();
// let globalOpts: {
//   configCwd?: string;
// } = {
//   configCwd: cwd(),
// };

export default async function main() {
  updateNotifier({ pkg: { name, version } }).notify();

  // Env variables are initialized to dev, but can be overridden by each command
  // For example, "zotero-plugin build" overrides them to "production"
  env.NODE_ENV ??= "development";

  const cli = new Command();

  cli
    .version(version)
    .usage("<command> [options]");
  // .option("--config-cwd <config>", "The cwd for search configuration file");

  cli
    .command("build")
    .description("Build the plugin")
    .option("--dev", "Builds the plugin in dev mode")
    .option("--dist <dir>", "The relative path for the new output directory (default: build)")
    .action((options) => {
      env.NODE_ENV = options.dev ? "development" : "production";
      Config.loadConfig({
        dist: options.dist,
      }).then(ctx => new Build(ctx).run());
    });

  cli
    .command("serve")
    .alias("dev")
    .description("Start development server")
    // .option(
    //   "--skip-build",
    //   "skip building website before deploy it (default: false)",
    // )
    // .option(
    //   "--only-start",
    //   "skip building website before deploy it (default: false)",
    // )
    .action((_options) => {
      Config.loadConfig({}).then(ctx => new Serve(ctx).run());
    });

  cli
    .command("create")
    .description("Create the plugin template")
    .action((_options: any) => {
      logger.error("The create not yet implemented");
      // new Create().run();
    });

  cli
    .command("release")
    .description("Release the plugin")
    .argument("[version]", "Target version: major, minor, patch, pre*, or specify version")
    .option("--preid <preid>", "ID for prerelease")
    .option("-y, --yes", "Skip confirmation")
    .action(async (version, options) => {
      env.NODE_ENV = "production";
      Config.loadConfig({
        release: {
          bumpp: {
            release: version,
            preid: options.preid,
            confirm: !options.yes,
          },
        },
      }).then(ctx => new Release(ctx).run());
    });

  cli.arguments("<command>").action((cmd) => {
    cli.outputHelp();
    logger.error(`Unknown command name "${cmd}".`);
  });

  cli.parse();
  // globalOpts = cli.optsWithGlobals();
}

main().catch((err) => {
  logger.error(err);
  exit(1);
});
