import { isCI } from "std-env";
import type { Context } from "../../types/index.js";
import { Base } from "../base.js";
import Bump from "./bump.js";
import GitHub from "./github.js";
import Gitee from "./gitee.js";

export default class Release extends Base {
  constructor(ctx: Context) {
    super(ctx);
  }

  /**
   * Runs release
   *
   * if is not CI，bump version, git add (package.json), git commit, git tag, git push;
   * if is CI, do not bump version, do not run git, create release (tag is `v${version}`) and upload xpi,
   *    then, create or update release (tag is "release"), update `update.json`.
   */
  async run() {
    const { release } = this.ctx;
    const t = new Date();

    await this.ctx.hooks.callHook("release:init", this.ctx);

    this.ctx = await new Bump(this.ctx).run();
    await this.ctx.hooks.callHook("release:push", this.ctx);

    if (this.isEnabled(release.github.enable))
      await new GitHub(this.ctx).run();

    if (this.isEnabled(release.gitee.enable))
      await new Gitee(this.ctx).run();

    await this.ctx.hooks.callHook("release:done", this.ctx);
    this.logger.success(
      `Done in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
    );
  }

  private isEnabled(enable: string) {
    if (enable === "always")
      return true;
    if (enable === "ci" && isCI)
      return true;
    if (enable === "local" && !isCI)
      return true;
    return false;
  }
}
