import { isRunning } from "./process.js";
import { execSync } from "child_process";
import consola from "consola";
import { isLinux, isMacOS, isWindows } from "std-env";

export function killZotero() {
  function kill() {
    try {
      if (process.env.ZOTERO_PLUGIN_KILL_COMMAND) {
        execSync(process.env.ZOTERO_PLUGIN_KILL_COMMAND);
      } else if (isWindows) {
        execSync("taskkill /f /im zotero.exe");
      } else if (isMacOS) {
        execSync("kill -9 $(ps -x | grep zotero)");
      } else if (isLinux) {
        execSync("kill -9 $(ps -x | grep zotero)");
      } else {
        consola.error("No commands found for this operating system.");
      }
    } catch (e) {
      consola.fail("Kill Zotero failed.");
    }
  }

  if (isRunning("zotero")) {
    kill();
  } else {
    consola.fail("No Zotero instance is currently running.");
  }
}
