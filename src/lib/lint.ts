// AddonLint
import type { Config } from "../types/index.js";

export default class Lint {
  options: Config;
  constructor(options: Config) {
    this.options = options;
  }

  lint() {
    // webext.cmd.lint({});
  }
}
