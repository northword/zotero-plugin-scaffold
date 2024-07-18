import { execSync } from "node:child_process";
import { platform } from "node:process";

export function isRunning(query: string) {
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

  try {
    const stdout = execSync(cmd, { encoding: "utf8" });
    return stdout.toLowerCase().includes(query.toLowerCase());
  }
  catch {
    return false;
  }
}
