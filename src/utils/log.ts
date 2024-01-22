import { Config } from "../types";
import chalk from "chalk";
import { isCI } from "ci-info";
import _ from "lodash";

enum LOG_LEVEL {
  "trace", // 0
  "debug", // 1
  "info", // 2
  "warn", //3
  "error", //4
}

export default class Log {
  private logLevel: number;
  constructor(config?: Config) {
    if (config) {
      this.logLevel = isCI ? 0 : LOG_LEVEL[config.logLevel];
    } else {
      this.logLevel = 0;
    }
  }

  // shouldLog(isExternal?: boolean) {
  //   return this.verbosityLevel === 2 || (this.isVerbose && isExternal);
  // }

  log(...args: any[]) {
    args = args.map((arg) => {
      if (typeof arg == "object") return JSON.stringify(arg, null, 2);
      return arg;
    });
    console.log(...args);
  }

  error(...args: any[]) {
    if (this.logLevel <= 4) console.log(chalk.red("ERROR"), ...args);
  }

  warn(...args: any[]) {
    if (this.logLevel <= 3) this.log(chalk.yellow("WARNING"), ...args);
  }

  info(...args: any[]) {
    if (this.logLevel <= 2) this.log(chalk.green("INFO"), ...args);
  }

  debug(...args: any[]) {
    if (this.logLevel <= 1) this.log(chalk.grey("DEBUG"), ...args);
  }

  trace(...args: any[]) {
    if (this.logLevel <= 0) this.log(chalk.grey(...args));
  }
}
