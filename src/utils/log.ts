import { Config } from "../types/index.js";
import { ProgressEvent, VersionBumpProgress } from "bumpp";
import chalk from "chalk";
import consola from "consola";
import { isCI } from "std-env";

/**
 * Log level
 *
 * @deprecated
 */
enum LOG_LEVEL {
  "trace", // 0
  "debug", // 1
  "info", // 2
  "warn", //3
  "error", //4
}

type LogType =
  | "trace"
  | "debug" // 1
  | "info" // 2
  | "warn" //3
  | "error"; //4

export const LogLevels: Record<LogType, number> = {
  trace: 5,
  debug: 4,
  info: 3,
  warn: 1,
  error: 0,
};

/**
 * Log
 *
 * @deprecated
 */
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
    // if (this.logLevel <= 1) this.log(chalk.grey("DEBUG"), ...args);
    if (this.logLevel <= 1) this.log(...args);
  }

  trace(...args: any[]) {
    if (this.logLevel <= 0) this.log(chalk.grey(...args));
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
  switch (event) {
    case ProgressEvent.FileUpdated:
      consola.success(`Updated ${updatedFiles.pop()} to ${newVersion}`);
      break;

    case ProgressEvent.FileSkipped:
      consola.info(`${skippedFiles.pop()} did not need to be updated`);
      break;

    case ProgressEvent.GitCommit:
      consola.success("Git commit");
      break;

    case ProgressEvent.GitTag:
      consola.success("Git tag");
      break;

    case ProgressEvent.GitPush:
      consola.success("Git push");
      break;

    case ProgressEvent.NpmScript:
      consola.success(`Npm run ${script}`);
      break;
  }
}
