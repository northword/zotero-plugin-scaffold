import fs from "fs";
import path from "path";
import { globbySync } from "globby";
import { OpenAPI } from "@gitee/typescript-sdk-v5";
import { RepositoriesService } from "@gitee/typescript-sdk-v5/src/services.gen";
import type { Context } from "../../types/index.js";
import { ReleaseBase } from "./base.js";

OpenAPI.TOKEN = process.env.GITEE_TOKEN;

export default class Gitee extends ReleaseBase {
  readonly client = RepositoriesService;

  async run() {
    if (!OpenAPI.TOKEN) throw new Error("No GITEE_TOKEN provided!");
    this.checkFiles();

    this.logger.info("Uploading XPI to Gitee...");
    await this.uploadXPI();

    this.logger.info("Refreshing update manifest...");
    await this.refreshUpdateManifest();
  }

  async uploadXPI() {
    const { version, dist, xpiName } = this.ctx;
    const release = await this.refreshRelease(
      this.ctx.release.bumpp.tag!.toString().replaceAll("%s", version),
      `Release v${version}`,
      this.ctx.release.gitee.releaseNote(this.ctx)
    );
    await this.refreshAttach(release.id!, path.join(dist, `${xpiName}.xpi`));
  }

  async refreshUpdateManifest() {
    const updater = this.ctx.release.gitee.updater;
    if (!updater) {
      this.logger.debug(
        `Skip refresh update.json because release.gitee.updater = false`
      );
      return;
    }

    const { dist, version } = this.ctx;
    const assets = globbySync(`${dist}/update*.json`).map((p) => basename(p)),
      release = await this.refreshRelease(
        updater,
        "Zotero Auto Update Manifest",
        `This release is used to host \`update.json\`, Updated in UTC ${new Date().toISOString()} for v${version}.`,
        true
      );
    for (const asset of assets)
      await this.refreshAttach(release.id!, path.join(dist, asset));
  }

  async refreshRelease(
    tag: string,
    name: string,
    body: string,
    prerelease = false
  ) {
    const old = await this.client.getV5ReposOwnerRepoReleasesTagsTag({
      owner: this.owner,
      repo: this.repo,
      tag,
    });
    if (old?.id)
      return this.client.patchV5ReposOwnerRepoReleasesId({
        owner: this.owner,
        repo: this.repo,
        name,
        body,
        prerelease,
        id: old.id,
        tagName: tag,
      });
    return this.client.postV5ReposOwnerRepoReleases({
      owner: this.owner,
      repo: this.repo,
      name,
      body,
      prerelease,
      tagName: tag,
      targetCommitish: "main",
    });
  }

  async refreshAttach(releaseId: number, file: string) {
    const assets =
        await this.client.getV5ReposOwnerRepoReleasesReleaseIdAttachFiles({
          owner: this.owner,
          repo: this.repo,
          releaseId,
        }),
      fileBuffer = fs.readFileSync(file);
    for (const asset of assets)  // delete old assets, by file name
      if (asset.name == path.basename(file))
        await this.client
          .deleteV5ReposOwnerRepoReleasesReleaseIdAttachFilesAttachFileId({
            owner: this.owner,
            repo: this.repo,
            releaseId,
            attachFileId: asset.id!,
          })
          .catch(console.error);  // "eat" all exceptions
    this.client.postV5ReposOwnerRepoReleasesReleaseIdAttachFiles({
      owner: this.owner,
      repo: this.repo,
      releaseId,
      file: new Blob([fileBuffer], { type: "application/octet-stream" }),
    });
  }
}
