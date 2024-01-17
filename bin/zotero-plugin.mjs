#!/usr/bin/env node
import cli from "../dist/cli.js";

cli();

process.on("unhandledRejection", (err) => {
  console.log("");
  console.error(err);
  console.log("");

  process.exit(1);
});
