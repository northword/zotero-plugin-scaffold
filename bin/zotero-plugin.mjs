#!/usr/bin/env node
import cli from "../dist/cli.js";
import Log from "../dist/utils/log.js";

const Logger = new Log();

cli();

process.on("unhandledRejection", (err) => {
  Logger.log("");
  Logger.error(err);
  Logger.log("");

  process.exit(1);
});
