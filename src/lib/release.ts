import { Config } from "../types.js";
import { LibBase } from "../utils/libBase.js";
import versionBump from "bumpp";
import ci from "ci-info";
import { default as glob } from "fast-glob";
import fs from "fs-extra";
import _ from "lodash";
import { Octokit } from "octokit";
import path from "path";
import releaseIt from "release-it";

export default class Release extends LibBase {
  isCI: boolean;
  client: Octokit["rest"];
  constructor(config: Config) {
    super(config);
    this.isCI = ci.isCI;
    this.client = this.getClient().rest;
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
      // this.createRelease();
      // this.uploadAssets();
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

  // @ts-ignore 01111
  async getRelease(tag: string, isPreRelease: boolean) {
    try {
      return await this.client.repos.getReleaseByTag({
        owner: this.owner,
        repo: this.repo,
        tag: tag,
      });
    } catch {
      return await this.client.repos.createRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: tag,
        prerelease: isPreRelease,
      });
    }
  }

  async uploadAsset(
    release: any,
    asset: string,
    contentType: string,
    isUpdate: boolean,
  ) {
    this.logger.debug(
      `uploading ${path.basename(asset)} to ${release.data.tag_name}`,
    );
    const name = path.basename(asset);
    // const contentType = mime.contentType(name) || 'application/octet-stream';
    const contentLength = fs.statSync(asset).size;

    const exists = (
      await this.client.repos.listReleaseAssets({
        owner: this.owner,
        repo: this.repo,
        release_id: release.data.id,
      })
    ).data.find((a) => a.name === name);
    if (exists && isUpdate) {
      await this.client.repos.deleteReleaseAsset({
        owner: this.owner,
        repo: this.repo,
        asset_id: exists.id,
      });
    } else {
      throw new Error(
        `failed to upload ${path.basename(asset)} to ${release.data.html_url}: asset exists`,
      );
    }

    try {
      await this.client.repos.uploadReleaseAsset({
        owner: this.owner,
        repo: this.repo,
        url: release.data.upload_url,
        release_id: release.data.id,
        data: fs.readFileSync(asset) as unknown as string,
        headers: {
          "content-type": contentType,
          "content-length": contentLength,
        },
        name,
      });
    } catch (err) {
      throw new Error(
        `failed to upload ${path.basename(asset)} to ${release.data.html_url}: ${err}`,
      );
    }
  }

  uploadUpdateJSON() {
    //
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
    return this.config.define.ghOwner;
  }
  get repo(): string {
    return this.config.define.ghRepo;
  }
}
