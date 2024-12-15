import type { Context } from "../../types/index.js";
import { isCI } from "std-env";
import { globSync } from "tinyglobby";
import { Base } from "../base.js";

export abstract class ReleaseBase extends Base {
  isCI: boolean;
  constructor(ctx: Context) {
    super(ctx);
    this.isCI = isCI;
  }

  abstract run(): Context | Promise<Context> | void | Promise<void>;

  checkFiles() {
    const { dist } = this.ctx;

    if (globSync(`${dist}/*.xpi`).length === 0) {
      throw new Error("No xpi file found, are you sure you have run build?");
    }
  }

  abstract get remote(): { owner: string; repo: string };
}
