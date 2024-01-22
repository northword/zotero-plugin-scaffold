import { Config } from "../types.js";
import { LibBase } from "../utils/libBase.js";
import versionBump from "bumpp";
import ci from "ci-info";
import { default as glob } from "fast-glob";
import _ from "lodash";
import releaseIt from "release-it";

export default class Release extends LibBase {
  isCI: boolean;
  constructor(config: Config) {
    super(config);
    this.isCI = ci.isCI;
  }

  /**
   * Runs release
   *
   * if is not CI，bump version, git add (package.json), git commit, git tag, git push;
   * if is CI, do not bump version, do not run git, create release (tag is `v${version}`) and upload xpi,
   *    then, create or update release (tag is "release"), update `update.json`.
   */
  async run() {
    if (!this.isCI) {
      this.bump();
    } else {
      if (glob.globSync(`${this.config.dist}/*.xpi`).length == 0) {
        this.logger.error(
          "No xpi file found, are you sure you have run the build?",
        );
      }
      this.uploadXPI();
      this.createRelease();
      this.uploadAssets();
    }
  }

  /**
   * Bumps release
   *
   * release: bump version, run build, git add, git commit, git tag, git push
   */
  bump() {
    // versionBump(this.config.release.bumpp);
    const releaseItConfig: ReleaseItConfig = {
      "only-version": true,
    };
    releaseIt(_.defaultsDeep(releaseItConfig, this.config.release.releaseIt));
  }

  /**
   * Create new release and upload XPI to asset
   */
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
