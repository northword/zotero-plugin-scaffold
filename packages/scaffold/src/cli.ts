import process from "node:process";
import { Command } from "@commander-js/extra-typings";
import pkg from "../package.json" with { type: "json" };
import { Build, Config, Release, Serve, Test } from "./index.js";
import { checkGitIgnore } from "./utils/gitignore.js";
import { logger } from "./utils/log.js";
import { updateNotifier } from "./utils/updater.js";

async function main() {
  const { name, version } = pkg;
  updateNotifier(name, version);

  // Env variables are initialized to dev, but can be overridden by each command
  // For example, "zotero-plugin build" overrides them to "production"
  process.env.NODE_ENV ??= "development";

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
      process.env.NODE_ENV = options.dev ? "development" : "production";
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

  cli.command("test")
    .description("Run tests")
    .option("--abort-on-fail", "Abort the test suite on first failure")
    .option("--exit-on-finish", "Exit the test suite after all tests have run")
    .action((options) => {
      process.env.NODE_ENV = "test";

      Config.loadConfig({}).then((ctx) => {
        if (options.abortOnFail) {
          ctx.test.abortOnFail = true;
        }
        if (options.exitOnFinish) {
          ctx.test.exitOnFinish = true;
        }
        new Test(ctx).run();
      });
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
      process.env.NODE_ENV = "production";
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

main()
  .then(() => {
    checkGitIgnore();
  })
  .catch(onError);

process.on("uncaughtException", onError);

function onError(err: Error) {
  logger.error(err);
  // For tinyexec - bumpp
  // @ts-expect-error tinyexec's NonZeroExitError has output.stderr
  if (err.output) {
    // @ts-expect-error tinyexec's NonZeroExitError has output.stderr
    logger.log(err.output?.stderr);
  }
  process.exit(1);
}
