import type { Context } from "../types/index.js";
import type { Logger } from "../utils/logger.js";

export abstract class Base {
  ctx: Context;
  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  abstract run(): any;

  get logger(): Logger {
    return this.ctx.logger;
  }
}
