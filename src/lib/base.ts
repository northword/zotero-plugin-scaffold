import { Config } from "../types.js";
import Log from "../utils/log.js";

export abstract class Base {
  config: Config;
  logger: InstanceType<typeof Log>;

  constructor(config: Config) {
    this.config = config;
    this.logger = new Log(config);
  }

  get version() {
    return this.config.define.buildVersion;
  }
  get addonName() {
    return this.config.define.addonName;
  }
  get addonID() {
    return this.config.define.addonID;
  }
  get addonRef() {
    return this.config.define.addonRef;
  }
  get addonInstence() {
    return this.config.define.addonInstance;
  }
  get updateLink() {
    return this.config.define.updateLink;
  }
  get updateURL() {
    return this.config.define.updateURL;
  }
  get xpiName() {
    return this.config.define.xpiName;
  }
}
