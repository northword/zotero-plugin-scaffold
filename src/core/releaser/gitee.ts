import type { Context } from "../../types/index.js";
import { ReleaseBase } from "./base.js";

export default class Gitee extends ReleaseBase {
  client: any;
  constructor(ctx: Context) {
    super(ctx);
    this.client = this.getClient();
  }

  /**
   * Runs release
   *
   * if is not CI，bump version, git add (package.json), git commit, git tag, git push;
   * if is CI, do not bump version, do not run git, create release (tag is `v${version}`) and upload xpi,
   *    then, create or update release (tag is "release"), update `update.json`.
   */
  async run() {
    this.checkFiles();

    this.logger.info("Uploading XPI...");

    this.logger.info("Uploading update manifest...");

    return this.ctx;
  }

  async uploadXPI() {
    //
  }

  async refreshUpdateManifest() {
    //
  }

  getClient() {
    return "";
  }
}
