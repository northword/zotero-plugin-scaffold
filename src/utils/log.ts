import type { VersionBumpProgress } from "bumpp";
import { ProgressEvent } from "bumpp";
import chalk from "chalk";
import { isCI } from "std-env";
import type { Config } from "../types/index.js";

/**
 * Log level
 *
 */
enum LOG_LEVEL {
  trace, // 0
  debug, // 1
  info, // 2
  warn, // 3
  error, // 4
}

/**
 * Logger
 *
 */
export class Log {
  private logLevel: number;
  constructor(config?: Config) {
    if (!config || isCI) {
      this.logLevel = 0;
    }
    else {
      this.logLevel = LOG_LEVEL[config.logLevel];
    }
  }

  // shouldLog(isExternal?: boolean) {
  //   return this.verbosityLevel === 2 || (this.isVerbose && isExternal);
  // }

  log(...args: any[]) {
    args = args.map((arg) => {
      if (typeof arg == "object")
        return JSON.stringify(arg, null, 2);
      return arg;
    });
    // eslint-disable-next-line no-console
    console.log(...args);
  }

  error(...args: any[]) {
    if (this.logLevel <= 4)
      this.log(chalk.red("ERROR"), ...args);
  }

  warn(...args: any[]) {
    if (this.logLevel <= 3)
      this.log(chalk.yellow("WARNING"), ...args);
  }

  info(...args: any[]) {
    if (this.logLevel <= 2)
      this.log(chalk.green("INFO"), ...args);
  }

  debug(...args: any[]) {
    // if (this.logLevel <= 1) this.log(chalk.grey("DEBUG"), ...args);
    if (this.logLevel <= 1)
      this.log(...args);
  }

  trace(...args: any[]) {
    if (this.logLevel <= 0)
      this.log(chalk.grey(...args));
  }

  ready(...args: any[]) {
    this.log(chalk.green("√", ...args));
  }

  success(...args: any[]) {
    this.log(chalk.green("√"), ...args);
  }

  fail(...args: any[]) {
    this.log(chalk.red("×"), ...args);
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

/**
 * bumpp 显示进度的回调
 *
 * @see https://github.com/antfu/bumpp/blob/main/src/cli/index.ts
 */
export function bumppProgress({
  event,
  script,
  updatedFiles,
  skippedFiles,
  newVersion,
}: VersionBumpProgress): void {
  const logger = new Log();

  switch (event) {
    case ProgressEvent.FileUpdated:
      logger.success(`Updated ${updatedFiles.pop()} to ${newVersion}`);
      break;

    case ProgressEvent.FileSkipped:
      logger.info(`${skippedFiles.pop()} did not need to be updated`);
      break;

    case ProgressEvent.GitCommit:
      logger.success("Git commit");
      break;

    case ProgressEvent.GitTag:
      logger.success("Git tag");
      break;

    case ProgressEvent.GitPush:
      logger.success("Git push");
      break;

    case ProgressEvent.NpmScript:
      logger.success(`Npm run ${script}`);
      break;
  }
}
