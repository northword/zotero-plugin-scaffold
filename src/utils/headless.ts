import { execSync } from "node:child_process";
import { exit } from "node:process";
import { isLinux } from "std-env";
import { logger } from "./log.js";

export async function installXvfb() {
  logger.debug("Installing xvfb...");
  if (!isLinux) {
    logger.error("Unsupported platform. Please install Xvfb manually.");
    exit(1);
  }
  try {
    execSync("which xvfb", { stdio: "ignore" });
  }
  catch {
    try {
      const osId = execSync("cat /etc/os-release | grep '^ID='").toString();
      if (osId.includes("ubuntu") || osId.includes("debian")) {
        logger.debug("Detected Ubuntu/Debian. Installing Xvfb...");
        execSync("sudo apt-get update && sudo apt-get install -y xvfb", { stdio: "pipe" });
      }
      else if (osId.includes("centos") || osId.includes("rhel")) {
        logger.debug("Detected CentOS/RHEL. Installing Xvfb...");
        execSync("sudo yum install -y xorg-x11-server-Xvfb", { stdio: "pipe" });
      }
      else {
        throw new Error("Unsupported Linux distribution.");
      }
      logger.debug("Xvfb installation completed.");
    }
    catch (error) {
      logger.error("Failed to install Xvfb:", error);
      exit(1);
    }
  }
}

export async function installZoteroLinux() {
  logger.debug("Installing Zotero...");
  try {
    execSync("wget -O zotero.tar.bz2 'https://www.zotero.org/download/client/dl?platform=linux-x86_64&channel=beta'", { stdio: "pipe" });
    execSync("tar -xvf zotero.tar.bz2", { stdio: "pipe" });
  }
  catch (e) {
    logger.error(e);
    throw new Error("Zotero extracted failed");
  }
}
