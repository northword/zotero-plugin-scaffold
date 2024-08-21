import { isCI } from "std-env";
import type { Context } from "../../types/index.js";
import { Base } from "../base.js";

export abstract class ReleaseBase extends Base {
  isCI: boolean;
  constructor(ctx: Context) {
    super(ctx);
    this.isCI = isCI;
  }

  abstract run(): Promise<Context> | Context;

  get owner(): string {
    return this.ctx.templateDate.owner;
  }

  get repo(): string {
    return this.ctx.templateDate.repo;
  }
}
