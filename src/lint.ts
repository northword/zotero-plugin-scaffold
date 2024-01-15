// AddonLint
import { Config } from "./config.js";
import webext from "web-ext";

export default class Lint {
  options: Config;
  constructor(options: Config) {
    this.options = options;
  }

  lint() {
    // webext.cmd.lint({});
  }
}
