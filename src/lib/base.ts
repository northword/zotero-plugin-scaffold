import type { Context } from "../types/index.js";

export abstract class Base {
  ctx: Context;
  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  get logger() {
    return this.ctx.logger;
  }

  get dist() {
    return this.ctx.dist;
  }

  get src() {
    return this.ctx.source;
  }

  get version() {
    return this.ctx.version;
  }

  get name() {
    return this.ctx.name;
  }

  get id() {
    return this.ctx.id;
  }

  get namespace() {
    return this.ctx.namespace;
  }

  get updateLink() {
    return this.ctx.xpiDownloadLink;
  }

  get updateURL() {
    return this.ctx.updateURL;
  }

  get xpiName() {
    return this.ctx.xpiName;
  }
}
