import type { Context } from "../../types/index.js";
import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";
import { Octokit } from "octokit";
import { glob } from "tinyglobby";
import { getMimeTypeByFileName } from "../../utils/mime.js";
import { ReleaseBase } from "./base.js";

export default class GitHub extends ReleaseBase {
  client: Octokit;
  constructor(ctx: Context) {
    super(ctx);
    this.client = this.getClient();
  }

  async run() {
    this.checkFiles();

    this.logger.info("Uploading XPI to GitHub...");
    await this.uploadXPI();

    this.logger.info("Refreshing update manifest...");
    await this.refreshUpdateManifest();

    return this.ctx;
  }

  /**
   * Create new release and upload XPI to asset
   */
  async uploadXPI() {
    const { version, dist, xpiName } = this.ctx;

    const release = await this.createRelease({
      ...this.remote,
      tag_name: this.ctx.release.bumpp
        .tag!.toString().replaceAll("%s", version),
      name: `Release v${version}`,
      body: await this.getChangelog(),
      prerelease: version.includes("-"),
      make_latest: "true",
    });

    if (!release)
      throw new Error("Create release failed!");

    this.logger.debug("Uploading xpi asset...");

    await this.uploadAsset(release.id, join(dist, `${xpiName}.xpi`));
  }

  async getReleaseByTag(tag: string) {
    return await this.client.rest.repos
      .getReleaseByTag({
        ...this.remote,
        tag,
      })
      .catch((e) => {
        this.logger.debug(`Release with tag ${tag} not found. ${e}`);
        return undefined;
      })
      .then((res) => {
        if (res && res.status === 200) {
          this.logger.debug(`Found release with tag "${tag}", id=${res.data.id}.`);
          return res.data;
        }
      });
  }

  async createRelease(
    options: Parameters<Octokit["rest"]["repos"]["createRelease"]>[0],
  ) {
    this.logger.debug("Creating release...");
    this.logger.debug(options);
    return await this.client.rest.repos
      .createRelease(options)
      .catch((e) => {
        this.logger.error(e);
        throw new Error("Create release failed.");
      })
      .then((res) => {
        if (res.status === 201) {
          this.logger.debug(`Create release "${res.data.tag_name}" success, id: ${res.data.id}.`);
          return res.data;
        }
      });
  }

  async uploadAsset(releaseID: number, asset: string) {
    this.logger.debug(`Uploading ${asset} to release ${releaseID}`);
    return await this.client.rest.repos
      .uploadReleaseAsset({
        ...this.remote,
        release_id: releaseID,
        data: await readFile(asset) as unknown as string,
        headers: {
          "content-type": getMimeTypeByFileName(asset) || "application/octet-stream",
          "content-length": (await stat(asset)).size,
        },
        name: basename(asset),
      })
      .then((res) => {
        this.logger.debug(`Upload "${res.data.name}" success, assetId: ${res.data.id}`);
        return res.data;
      });
  }

  async refreshUpdateManifest() {
    const updater = this.ctx.release.github.updater;
    if (!updater) {
      this.logger.debug(`Skip refresh update.json because release.github.updater = false`);
      return;
    }

    const { dist, version } = this.ctx;

    const assets = (await glob(`${dist}/update*.json`))
      .map(p => basename(p));

    const release
      = (await this.getReleaseByTag(updater))
        ?? (await this.createRelease({
          ...this.remote,
          tag_name: updater,
          prerelease: true,
          make_latest: "false",
        }));

    if (!release)
      throw new Error("Get or create 'release' failed.");

    const existAssets = await this.client.rest.repos
      .listReleaseAssets({
        ...this.remote,
        release_id: release.id,
      })
      .then((res) => {
        return res.data.filter(asset => assets.includes(asset.name));
      });

    if (existAssets) {
      for (const existAsset of existAssets) {
        if (assets.includes(existAsset.name)) {
          this.logger.debug(`Delete existed asset ${existAsset.name} in release ${updater}`);
          await this.client.rest.repos.deleteReleaseAsset({
            ...this.remote,
            asset_id: existAsset.id,
          });
        }
      }
    }

    for (const asset of assets) {
      await this.uploadAsset(release.id, join(dist, asset));
    }

    await this.client.rest.repos.updateRelease({
      ...this.remote,
      release_id: release.id,
      name: "Release Manifest",
      body: `This release is used to host \`update.json\`, please do not delete or modify it! \n Updated in UTC ${new Date().toISOString()} for version ${version}`,
      prerelease: true,
      make_latest: "false",
    });
  }

  async getChangelog() {
    const { release } = this.ctx;
    const { github } = release;
    const { releaseNote } = github;
    return releaseNote(this.ctx);
  }

  getClient(): Octokit {
    if (!process.env.GITHUB_TOKEN)
      throw new Error("No GITHUB_TOKEN.");
    const client = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: "zotero-plugin-scaffold",
    });

    return client;
  }

  get remote() {
    const [owner, repo] = this.ctx.release.github.repository.split("/");
    return {
      owner,
      repo,
    };
  }
}
