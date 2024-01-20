// release: bump version, run build, git add, git commit, git tag, git push
import { Config } from "../types.js";
import Build from "./build.js";
import versionBump from "bumpp";

export default class Release {
  config: Config;
  constructor(config: Config) {
    this.config = config;
  }

  async run() {
    // this.config.release.bumpp.release = (await versionBump()).newVersion;
    // new Build(this.config, "production").run();
    versionBump(this.config.release.bumpp);
  }
}
