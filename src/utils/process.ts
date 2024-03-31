import { execSync } from "child_process";

export function isRunning(query: string) {
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

  try {
    const stdout = execSync(cmd, { encoding: "utf8" });
    return stdout.toLowerCase().indexOf(query.toLowerCase()) > -1;
  } catch (error) {
    return false;
  }
}
