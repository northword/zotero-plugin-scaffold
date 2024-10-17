import { ReleaseBase } from "./base.js";

export default class Gitee extends ReleaseBase {
  async run() {
    //
  }

  get remote() {
    const [owner, repo] = this.ctx.release.gitee.repository.split("/");
    return {
      owner,
      repo,
    };
  }
}
