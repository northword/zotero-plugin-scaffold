import type { VersionBumpProgress } from "bumpp";
import { ProgressEvent, versionBump } from "bumpp";
// @ts-expect-error no types
import conventionalChangelog from "conventional-changelog";
import type { Context } from "../../types/index.js";
import { ReleaseBase } from "./base.js";

export default class Bump extends ReleaseBase {
  constructor(ctx: Context) {
    super(ctx);
  }

  /**
   * Runs release
   *
   */
  async run() {
    await this.bump();

    // await this.ctx.hooks.callHook("release:version", this.ctx);

    this.ctx.release.changelog = await this.getChangelog();

    return this.ctx;
  }

  /**
   * Bumps release
   *
   * if is not CI，do bump version, git add, git commit, git tag, and git push;
   * if is CI, do not bump version, do git add, git commit, git tag, and git push.
   */
  async bump() {
    const bumppConfig = {
      ...this.ctx.release.bumpp,
      push: true,
      process: this.bumppProgress,
    };

    // await versionBumpInfo(bumppConfig).then((operation) => {
    //   this.logger.debug(operation);
    //   bumppConfig.release = operation.results.newVersion;
    // });

    const result = await versionBump(bumppConfig);
    this.ctx.version = result.newVersion;
    this.ctx.release.bumpp.tag = result.tag;
  }

  getChangelog(): Promise<string> {
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

  /**
   * bumpp 显示进度的回调
   *
   * @see https://github.com/antfu/bumpp/blob/main/src/cli/index.ts
   */
  private bumppProgress({
    event,
    script,
    updatedFiles,
    skippedFiles,
    newVersion,
  }: VersionBumpProgress): void {
    switch (event) {
      case ProgressEvent.FileUpdated:
        this.logger.success(`Updated ${updatedFiles.pop()} to ${newVersion}`);
        break;

      case ProgressEvent.FileSkipped:
        this.logger.info(`${skippedFiles.pop()} did not need to be updated`);
        break;

      case ProgressEvent.GitCommit:
        this.logger.success("Git commit");
        break;

      case ProgressEvent.GitTag:
        this.logger.success("Git tag");
        break;

      case ProgressEvent.GitPush:
        this.logger.success("Git push");
        break;

      case ProgressEvent.NpmScript:
        this.logger.success(`Npm run ${script}`);
        break;
    }
  }
}
