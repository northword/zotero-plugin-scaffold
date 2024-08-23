import chalk from "chalk";
import { isCI, isDebug } from "std-env";
import { isPlainObject } from "es-toolkit";
import type { Config } from "../types/index.js";

/**
 * Log level
 */
enum LOG_LEVEL {
  all = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
}

/**
 * Logger
 */
export class Log {
  private logLevel: number;
  constructor(config?: Config) {
    if (!config || isCI || isDebug) {
      this.logLevel = LOG_LEVEL.all;
    }
    else {
      this.logLevel = LOG_LEVEL[config.logLevel];
    }
  }

  private formatArgs(arg: any): string {
    if (typeof arg === "string")
      return arg;

    if (arg instanceof Error) {
      return `${chalk.red(arg.name)}: ${chalk.red(arg.message)}\n${arg.stack}`;
    }

    if (typeof arg === "object" && arg !== null && isPlainObject(arg)) {
      return JSON.stringify(arg, null, 2);
    }

    return arg;
  }

  private logArgs(level: LOG_LEVEL, ...args: any[]) {
    if (this.logLevel > level)
      return;

    args = args.map(arg => this.formatArgs(arg));
    // eslint-disable-next-line no-console
    console.log(...args);
  }

  error(...args: any[]) {
    this.logArgs(LOG_LEVEL.error, chalk.red("ERROR"), ...args);
  }

  warn(...args: any[]) {
    this.logArgs(LOG_LEVEL.warn, chalk.yellow("WARNING"), ...args);
  }

  tip(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.blue("TIP"), ...args);
  }

  info(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.green("INFO"), ...args);
  }

  debug(...args: any[]) {
    this.logArgs(LOG_LEVEL.debug, chalk.grey("DEBUG"), ...args);
  }

  ready(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.green("√", ...args));
  }

  success(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.green("√"), ...args);
  }

  fail(...args: any[]) {
    this.logArgs(LOG_LEVEL.error, chalk.red("×"), ...args);
  }

  clear() {
    // eslint-disable-next-line no-console
    console.clear();
  }

  newLine() {
    // eslint-disable-next-line no-console
    console.log("");
  }
}
