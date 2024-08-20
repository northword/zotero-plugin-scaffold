import type { Context } from "../types/index.js";

export abstract class Base {
  ctx: Context;
  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  get logger() {
    return this.ctx.logger;
  }
}
