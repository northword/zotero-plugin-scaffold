import { execSync } from "node:child_process";
import { env } from "node:process";
import consola from "consola";
import { isLinux, isMacOS, isWindows } from "std-env";
import { isRunning } from "./process.js";

export function killZotero() {
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
        execSync("kill -9 $(ps -x | grep zotero)");
      }
      else {
        consola.error("No commands found for this operating system.");
      }
    }
    catch {
      consola.fail("Kill Zotero failed.");
    }
  }

  if (isRunning("zotero")) {
    kill();
  }
  else {
    consola.fail("No Zotero instance is currently running.");
  }
}
