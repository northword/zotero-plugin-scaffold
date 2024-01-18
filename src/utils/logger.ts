export class Logger {
  static log(...args: any[]) {
    console.log(...args);
  }

  // red
  static error(...args: any[]) {
    console.error("\u001b[31m [ERROR]", ...args, "\u001b[0m");
  }

  // yellow
  static warn(...args: any[]) {
    console.warn("\u001b[33m [WARN]", ...args, "\u001b[0m");
  }

  // blue
  static debug(...args: any[]) {
    console.log("\u001b[34m [DEBUG]\u001b[0m", ...args);
  }

  // green
  static info(...args: any[]) {
    console.log("\u001b[32m [INFO]", ...args, "\u001b[0m");
  }

  // cyan
  static trace(...args: any[]) {
    console.log("\u001b[36m [TRACE]\u001b[0m", ...args);
  }
}
