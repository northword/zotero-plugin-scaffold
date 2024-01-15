import { exec } from "child_process";

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

export function dateFormat(fmt: string, date: Date) {
  let ret;
  const opt: { [key: string]: string } = {
    "Y+": date.getFullYear().toString(),
    "m+": (date.getMonth() + 1).toString(),
    "d+": date.getDate().toString(),
    "H+": date.getHours().toString(),
    "M+": date.getMinutes().toString(),
    "S+": date.getSeconds().toString(),
  };
  for (const k in opt) {
    ret = new RegExp("(" + k + ")").exec(fmt);
    if (ret) {
      fmt = fmt.replace(
        ret[1],
        ret[1].length == 1 ? opt[k] : opt[k].padStart(ret[1].length, "0"),
      );
    }
  }
  return fmt;
}

export function isRunning(query: string, cb: (status: boolean) => void) {
  const platform = process.platform;
  let cmd = "";
  switch (platform) {
    case "win32":
      cmd = `tasklist`;
      break;
    case "darwin":
      cmd = `ps -ax | grep ${query}`;
      break;
    case "linux":
      cmd = `ps -A`;
      break;
    default:
      break;
  }
  exec(cmd, (err, stdout, stderr) => {
    cb(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
  });
}
