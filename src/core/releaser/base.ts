import { isCI } from "std-env";
import { globSync } from "fast-glob";
import type { Context } from "../../types/index.js";
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

  get owner(): string {
    return this.ctx.templateDate.owner;
  }

  get repo(): string {
    return this.ctx.templateDate.repo;
  }
}
