import { Config } from "../types.js";
import Log from "./log.js";

export abstract class LibBase {
  config: Config;
  logger: InstanceType<typeof Log>;

  constructor(config: Config) {
    this.config = config;
    this.logger = new Log(config);
  }
}
