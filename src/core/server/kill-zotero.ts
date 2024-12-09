import { execSync } from "node:child_process";
import { env } from "node:process";
import { isLinux, isMacOS, isWindows } from "std-env";
import { Log } from "../../utils/log.js";
import { isRunning } from "../../utils/process.js";

export function killZotero() {
  const logger = new Log();

  function kill() {
    try {
      if (env.ZOTERO_PLUGIN_KILL_COMMAND) {
        execSync(env.ZOTERO_PLUGIN_KILL_COMMAND);
      }
      else if (isWindows) {
        execSync("taskkill /f /im zotero.exe");
      }
      else if (isMacOS) {
        execSync("kill -9 $(ps -x | grep zotero)");
      }
      else if (isLinux) {
        execSync("pkill -9 zotero");
      }
      else {
        logger.error("No commands found for this operating system.");
      }
    }
    catch {
      logger.fail("Kill Zotero failed.");
    }
  }

  if (isRunning("zotero")) {
    kill();
  }
  else {
    logger.fail("No Zotero instance is currently running.");
  }
}
