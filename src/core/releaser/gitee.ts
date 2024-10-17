import fs from "node:fs";
import { basename, join } from "node:path";
import { env } from "node:process";
import { OpenAPI, RepositoriesService } from "@gitee/typescript-sdk-v5";
import { globbySync } from "globby";
import { ofetch } from "ofetch";
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

  private get token() {
    if (!env.GITEE_TOKEN)
      throw new Error("No GITEE_TOKEN provided!");
    return env.GITEE_TOKEN;
  }

  // private getParams(params: object) {
  //   return {
  //     access_token: this.token,
  //     ...this.remote,
  //     ...params,
  //   };
  // }

  _fetch = ofetch.create({ baseURL: "https://gitee.com/api/v5", params: {
    access_token: this.token,
    ...this.remote,
  } });

  /**
   * @see https://gitee.com/api/v5/swagger#/getV5ReposOwnerRepoReleasesTagsTag
   */
  private async getReleaseByTag(tag: string): Promise<{
    body: string;
    created_at: string;
    id: number;
    name: string;
    prerelease: boolean;
    tag_name: string;
    target_commitish: string;
  }> {
    // return (await _fetch(`/repos/{owner}/{repo}/releases/tags/{tag}`, { params: this.getParams({ tag }) }));
    return (await this._fetch(`/repos/{owner}/{repo}/releases/tags/{tag}`, { params: { tag } }));
  }

  private async createRelease(tag_name: string, name: string, body: string, prerelease: boolean = false) {
    //
  }
}
