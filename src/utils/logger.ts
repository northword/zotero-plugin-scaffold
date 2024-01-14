export class Logger {
  static log(...args) {
    console.log(...args);
  }

  // red
  static error(...args) {
    console.error("\u001b[31m [ERROR]", ...args, "\u001b[0m");
  }

  // yellow
  static warn(...args) {
    console.warn("\u001b[33m [WARN]", ...args, "\u001b[0m");
  }

  // blue
  static debug(...args) {
    console.log("\u001b[34m [DEBUG]\u001b[0m", ...args);
  }

  // green
  static info(...args) {
    console.log("\u001b[32m [INFO]", ...args, "\u001b[0m");
  }

  // cyan
  static trace(...args) {
    console.log("\u001b[36m [TRACE]\u001b[0m", ...args);
  }
}
