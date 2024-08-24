import type { Context } from "../../types/index.js";
import { ReleaseBase } from "./base.js";

export default class Gitee extends ReleaseBase {
  client: any;
  constructor(ctx: Context) {
    super(ctx);
    this.client = this.getClient();
  }

  async run() {
    this.checkFiles();

    this.logger.error("Release to Gitee has not yet been implemented.");
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
