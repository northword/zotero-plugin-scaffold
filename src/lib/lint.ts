// AddonLint
import { Config } from "../types/index.js";
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
