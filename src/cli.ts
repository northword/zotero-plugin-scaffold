#!/usr/bin/env node

import { env, exit } from "node:process";
import { Command } from "commander";
import updateNotifier from "update-notifier";
import { name, version } from "../package.json";
import { Log } from "./utils/log.js";
import { Build, Config, Release, Serve } from "./index.js";

const logger = new Log();

export default async function main() {
  updateNotifier({ pkg: { name, version } }).notify();

  // Env variables are initialized to dev, but can be overridden by each command
  // For example, "zotero-plugin build" overrides them to "production"
  env.NODE_ENV ??= "development";

  const cli = new Command();
  cli.version(version).usage("<command> [options]");

  cli
    .command("build")
    .description("Build the plugin")
    .option("--dev", "Builds the plugin in dev mode")
    .option("--dist <dir>", "The relative path for the new output directory (default: build)")
    .action(async (options: any) => {
      env.NODE_ENV = options.dev ? "development" : "production";
      const config = await Config.loadConfig({
        dist: options.dist,
      });
      new Build(config).run();
    });

  cli
    .command("serve")
    .description("Start development server")
    // .option(
    //   "--skip-build",
    //   "skip building website before deploy it (default: false)",
    // )
    // .option(
    //   "--only-start",
    //   "skip building website before deploy it (default: false)",
    // )
    .action(async (_options: any) => {
      const config = await Config.loadConfig({});
      new Serve(config).run();
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
    .option("-v, --version <version>", "Target version: major, minor, patch, prerelease, or specify version")
    .option("--preid <preid>", "ID for prerelease")
    .option("-y, --yes", "Skip confirmation")
    .action(async (options) => {
      env.NODE_ENV = "production";
      const config = await Config.loadConfig({
        release: {
          bumpp: {
            release: options.version,
            preid: options.preid,
            confirm: !options.yes,
          },
        },
      });
      new Release(config).run();
    });

  cli.arguments("<command>").action((cmd) => {
    cli.outputHelp();
    logger.error(`Unknown command name "${cmd}".`);
  });

  cli.parse();
}

main().catch((err) => {
  logger.error(err);
  exit(1);
});
