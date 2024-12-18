import process from "node:process";
import readline from "node:readline";
import chalk from "chalk";
import { isPlainObject } from "es-toolkit";
import { isDebug } from "std-env";

/**
 * Log level
 */
export enum LOG_LEVEL {
  trace = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
}

export type LogLevelType = keyof typeof LOG_LEVEL;

/**
 * Logger
 */
export class Log {
  private static instance: Log;
  private logLevel: number;
  constructor(level?: LOG_LEVEL) {
    if (isDebug)
      this.logLevel = LOG_LEVEL.trace;
    else if (process.env.ZOTERO_PLUGIN_LOG_LEVEL)
      this.logLevel = LOG_LEVEL[process.env.ZOTERO_PLUGIN_LOG_LEVEL as LogLevelType];
    else if (level)
      this.logLevel = level;
    else
      this.logLevel = LOG_LEVEL.info;
  }

  static getInstance(): Log {
    if (!Log.instance) {
      Log.instance = new Log();
    }
    return Log.instance;
  }

  setLogLevel(level: LogLevelType) {
    this.logLevel = LOG_LEVEL[level];
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

  log(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }

  error(...args: any[]) {
    this.newLine();
    this.logArgs(LOG_LEVEL.error, chalk.bgRed(" ERROR "), ...args);
    this.newLine();
  }

  warn(...args: any[]) {
    this.newLine();
    this.logArgs(LOG_LEVEL.warn, chalk.bgYellow(" WARN "), ...args);
    this.newLine();
  }

  tip(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.blue("→"), ...args);
  }

  info(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.blue("ℹ"), ...args);
  }

  debug(...args: any[]) {
    this.logArgs(LOG_LEVEL.debug, chalk.grey("⚙"), ...args);
  }

  ready(...args: any[]) {
    this.newLine();
    this.logArgs(LOG_LEVEL.info, chalk.green("✔", ...args));
    this.newLine();
  }

  success(...args: any[]) {
    this.logArgs(LOG_LEVEL.info, chalk.green("✔"), ...args);
  }

  fail(...args: any[]) {
    this.logArgs(LOG_LEVEL.error, chalk.red("✖"), ...args);
  }

  clear() {
    // // eslint-disable-next-line no-console
    // console.clear();

    // Modified from https://github.com/vitejs/vite/blob/561b940f6f963fbb78058a6e23b4adad53a2edb9/packages/vite/src/node/logger.ts#L40-L46
    const repeatCount = process.stdout.rows - 2;
    const blank = repeatCount > 0 ? "\n".repeat(repeatCount) : "";
    // eslint-disable-next-line no-console
    console.log(blank);
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
  }

  newLine() {
    // eslint-disable-next-line no-console
    console.log("");
  }
}

export const logger = Log.getInstance();
