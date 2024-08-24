import { execSync } from "node:child_process";
import { isCI } from "std-env";
// @ts-expect-error no types
import conventionalChangelog from "conventional-changelog";
import type { Context } from "../../types/index.js";
import { Base } from "../base.js";
import { escapeRegExp } from "../../utils/string.js";
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

    // Releaser ready
    await this.ctx.hooks.callHook("release:init", this.ctx);

    // Bump version, Git
    await new Bump(this.ctx).run();
    await this.ctx.hooks.callHook("release:push", this.ctx);

    // Get changelog
    this.ctx.release.changelog = this.getChangelog();

    // Publish to GitHub, Gitee
    if (isGitHubEnabled)
      await new GitHub(this.ctx).run();

    if (isGiteeEnabled)
      await new Gitee(this.ctx).run();

    // TODO: Publish to Zotero's official market

    await this.ctx.hooks.callHook("release:done", this.ctx);
    this.logger.success(
      `Done in ${(new Date().getTime() - t.getTime()) / 1000} s.`,
    );
  }

  getConventionalChangelog(): Promise<string> {
    const { version } = this.ctx;

    return new Promise((resolve, reject) => {
      let changelog = "";
      conventionalChangelog({ releaseCount: 2 }, { version })
        .on("data", (chunk: any) => {
          changelog += chunk.toString();
        })
        .on("end", () => {
          this.logger.debug("changelog:", changelog.trim());
          resolve(changelog.trim());
        })
        .on("error", (err: any) => {
          reject(err);
        });
    });
  }

  getGitLog(currentTag: string) {
    const tags = execSync("git tag -l --sort=v:refname").toString().trim().split("\n");

    const currentTagIndex = tags.indexOf(currentTag);
    if (currentTagIndex === -1)
      throw new Error(`Tag "${currentTag}" not found.`);

    if (currentTagIndex === 0) {
      // If the current tag is the first tag, get all logs before this one
      return execSync(`git log ${currentTag} --pretty=format:"* %s (%h)"`).toString().trim();
    }
    else {
      // Otherwise, get log between this tag and previous one
      const previousTag = tags[currentTagIndex - 1];
      return execSync(`git log ${previousTag}..${currentTag} --pretty=format:"* %s (%h)"`).toString().trim();
    }
  }

  getFilteredChangelog(rawLog: string, commitMessage: string) {
    const filterRegex = new RegExp(escapeRegExp(commitMessage));

    const filteredLog = rawLog
      .split("\n")
      .filter(line => !filterRegex.test(line))
      .join("\n");

    if (filteredLog.replaceAll(" ", "") === "")
      return "_No significant changes._";

    return filteredLog;
  }

  getChangelog() {
    let changelog: string;
    const changelogConfig = this.ctx.release.changelog;
    if (typeof changelogConfig == "function") {
      changelog = changelogConfig(this.ctx);
    }
    else if (!!changelogConfig && typeof changelogConfig == "string") {
      changelog = execSync(changelogConfig).toString().trim();
    }
    else {
      const resolvedCurrentTag = this.ctx.release.bumpp.tag;
      const rawLog = this.getGitLog(resolvedCurrentTag);

      const resolvedCommitMessage = this.ctx.release.bumpp.commit;
      changelog = this.getFilteredChangelog(rawLog, resolvedCommitMessage);
    }
    this.logger.debug(`Got changelog:\n`, changelog, "\n");
    return changelog;
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

  get resolvedCommitMessage() {
    return this.ctx.release.bumpp.commit.replace("%s", this.ctx.version);
  }
}
