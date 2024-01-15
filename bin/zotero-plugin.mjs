#!/usr/bin/env node
import cli from "../dist/cli.js";

cli();

process.on("unhandledRejection", (err) => {
  console.log("");
  // Do not use logger.error here: it does not print error causes
  console.error(err);
  console.log("");

  //     logger.info`Docusaurus version: number=${DOCUSAURUS_VERSION}
  // Node version: number=${process.version}`;
  process.exit(1);
});
