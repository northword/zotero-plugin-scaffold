import type { ConsolaInstance } from "consola";
import { createConsola } from "consola";
import type { Context } from "../types/index.js";
import { LogLevels } from "../utils/log.js";

export abstract class Base {
  ctx: Context;
  // logger: InstanceType<typeof Log>;
  logger: ConsolaInstance;
  constructor(ctx: Context) {
    this.ctx = ctx;
    // this.logger = new Log(config);
    this.logger = createConsola({
      level: LogLevels[ctx.logLevel],
      fancy: true,
    });
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
