import { Context } from "../types";
import { Base } from "./base.js";
import versionBump from "bumpp";
import conventionalChangelog from "conventional-changelog";
import { default as glob } from "fast-glob";
import fs from "fs-extra";
import mime from "mime";
import { Octokit } from "octokit";
import path from "path";
import _ from "radash";
import releaseIt from "release-it";
import { isCI } from "std-env";

export default class Release extends Base {
  isCI: boolean;
  client: Octokit;
  constructor(ctx: Context) {
    super(ctx);
    this.isCI = isCI;
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
    if (!this.isCI) {
      this.bump();
    } else {
      if (glob.globSync(`${this.dist}/*.xpi`).length == 0) {
        this.logger.error(
          "No xpi file found, are you sure you have run the build?",
        );
      }
      this.uploadXPI();
      this.uploadUpdateJSON();
    }
  }

  /**
   * Bumps release
   *
   * release: bump version, run build, git add, git commit, git tag, git push
   */
  bump() {
    versionBump(this.ctx.release.bumpp);
    // const releaseItConfig: ReleaseItConfig = {
    //   "only-version": true,
    // };
    // releaseIt(_.defaultsDeep(releaseItConfig, this.config.release.releaseIt));
  }

  /**
   * Create new release and upload XPI to asset
   */
  async uploadXPI() {
    // const releaseItConfig: ReleaseItConfig = {
    //   increment: false,
    //   git: { commit: false, tag: false, push: false },
    //   github: {
    //     release: true,
    //   },
    //   verbose: 2,
    //   ci: true,
    // };

    // releaseIt(_.defaultsDeep(releaseItConfig, this.config.release.releaseIt));

    const release = await this.creatRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: `v${this.version}`,
      name: `Release v${this.version}`,
      body: await this.getChangelog(),
      prerelease: this.version.includes("-"),
      make_latest: "true",
    });

    if (!release) throw new Error("Create release failed!");

    this.uploadAsset(release.id, path.join(this.dist, `${this.xpiName}.xpi`));
  }

  async getReleaseByTag(tag: string) {
    return await this.client.rest.repos
      .getReleaseByTag({
        owner: this.owner,
        repo: this.repo,
        tag: tag,
      })
      .then((res) => {
        if (res.status == 200) {
          return res.data;
        }
      })
      .catch((err) => {
        this.logger.debug(err);
        return undefined;
      });
  }

  async creatRelease(
    options: Parameters<Octokit["rest"]["repos"]["createRelease"]>[0],
  ) {
    return await this.client.rest.repos
      .createRelease(options)
      .then((res) => {
        if (res.status == 201) {
          return res.data;
        }
      })
      .catch((err) => {
        this.logger.debug(err);
        return undefined;
      });
  }

  async uploadAsset(releaseID: number, asset: string) {
    return await this.client.rest.repos
      .uploadReleaseAsset({
        owner: this.owner,
        repo: this.repo,
        release_id: releaseID,
        data: fs.readFileSync(asset) as unknown as string,
        headers: {
          "content-type": mime.getType(asset) || "application/octet-stream",
          "content-length": fs.statSync(asset).size,
        },
        name: path.basename(asset),
      })
      .then((res) => {
        return res.data;
      });
  }

  async uploadUpdateJSON() {
    const assets = ["update.json", "update-beta.json"];

    const release =
      (await this.getReleaseByTag("release")) ??
      (await this.creatRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: "release",
      }));

    if (!release) throw new Error("Get or create 'release' failed.");

    await this.client.rest.repos.updateRelease({
      owner: this.owner,
      repo: this.repo,
      release_id: release.id,
      name: "Release Manifest",
      body: `This release is used to host \`update.json\`, please do not delete or modify it! \n Updated in UTC ${new Date().toISOString()} for version ${this.version}`,
      make_latest: "false",
    });

    const existAssets = await this.client.rest.repos
      .listReleaseAssets({
        owner: this.owner,
        repo: this.repo,
        release_id: release.id,
      })
      .then((res) => {
        return res.data.filter((asset) => assets.includes(asset.name));
      });

    if (existAssets) {
      for (const existAsset of existAssets) {
        await this.client.rest.repos.deleteReleaseAsset({
          owner: this.owner,
          repo: this.repo,
          asset_id: existAsset.id,
        });
      }
    }

    for (const asset of assets) {
      await this.uploadAsset(release.id, path.join(this.dist, asset));
    }
  }

  getChangelog(): Promise<string> {
    return new Promise((resolve, reject) => {
      let changelog = "";
      conventionalChangelog({ releaseCount: 2 }, { version: this.version })
        .on("data", (chunk) => {
          changelog += chunk.toString();
        })
        .on("end", () => {
          this.logger.debug("changelog:", changelog);
          resolve(changelog);
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  getClient(): Octokit {
    if (!process.env.GITHUB_TOKEN) throw new Error("No GITHUB_TOKEN.");
    const client = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: `zotero-plugin-scaffold/${this.version}`,
    });

    return client;
  }

  get owner(): string {
    return this.ctx.templateDate.owner;
  }
  get repo(): string {
    return this.ctx.templateDate.repo;
  }
}
