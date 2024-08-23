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
    const t = new Date();

    const { release, version } = this.ctx;

    // Parse release config
    if (release.bumpp.release === "prompt" && isCI) {
      this.logger.warn("Config `release.bumpp.release == 'prompt'` will do nothing because in CI enviroment.");
      this.ctx.release.bumpp.release = version;
    }

    if (release.bumpp.confirm && isCI) {
      this.logger.warn("Config `release.bumpp.confirm` will do nothing because in CI enviroment.");
      this.ctx.release.bumpp.confirm = false;
    }

    const isBumpNeeded = this.ctx.release.bumpp.release !== version;
    const isGitHubEnabled = this.isEnabled(release.github.enable);
    const isGiteeEnabled = this.isEnabled(release.gitee.enable);
    const isPublishNeeded = isGitHubEnabled || isGiteeEnabled;

    if (isBumpNeeded && isPublishNeeded && !!release.bumpp.execute) {
      this.logger.warn("The current release needs to run the build after bumping the version number, please configure the build script in config.release.bumpp.execute.");
      this.ctx.release.bumpp.execute ||= "npm run build";
    }

    this.logger.debug("Release config: ", this.ctx.release);

    await this.ctx.hooks.callHook("release:init", this.ctx);

    // Bump version and Git
    if (isBumpNeeded) {
      this.ctx = await new Bump(this.ctx).run();
      await this.ctx.hooks.callHook("release:push", this.ctx);
    }

    // Publish to GitHub, Gitee
    if (isGitHubEnabled)
      await new GitHub(this.ctx).run();

    if (isGiteeEnabled)
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
