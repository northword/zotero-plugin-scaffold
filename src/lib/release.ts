// release: bump version, run build, git add, git commit, git tag, git push
import { Config } from "../types.js";
import { Logger } from "../utils/logger.js";
import Build from "./build.js";
import versionBump from "bumpp";
import _ from "lodash";
import releaseIt from "release-it";

export default class Release {
  config: Config;
  isCI: boolean;
  constructor(config: Config) {
    this.config = config;
    this.isCI = false;
  }

  /**
   * Runs release
   *
   * if is not CI，bump version, git add (package.json), git commit, git tag, git push;
   * if is CI, do not bump version, do not run git, create release (tag is `v${version}`) and upload xpi,
   *    then, create or update release (tag is "release"), update `update.json`.
   */
  async run() {
    Logger.log("");

    if (!this.isCI) {
      this.bump();
    } else {
      this.uploadXPI();
      this.createRelease();
      this.uploadAssets();
    }
  }

  bump() {
    // this.config.release.bumpp.release = (await versionBump()).newVersion;
    // new Build(this.config, "production").run();
    // versionBump(this.config.release.bumpp);
    const releaseItConfig: ReleaseItConfig = {
      "only-version": true,
    };
    releaseIt(_.defaultsDeep(releaseItConfig, this.config.release.releaseIt));
  }

  uploadXPI() {
    const releaseItConfig: ReleaseItConfig = {
      increment: false,
      git: {
        commit: false,
        tag: false,
        push: false,
      },
      github: {
        release: true,
      },
      verbose: 2,
      ci: true,
    };

    releaseIt(_.defaultsDeep(releaseItConfig, this.config.release.releaseIt));
  }
  createRelease() {
    //
  }

  uploadAssets() {
    //
  }

  uploadUpdateJSON() {
    //
  }
}
