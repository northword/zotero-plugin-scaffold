import { defineConfig, loadConfig } from "./config.js";
import Build from "./lib/build.js";
import Release from "./lib/release.js";
import Serve from "./lib/serve.js";

const Config = {
  defineConfig,
  loadConfig,
};

export { defineConfig, Config, Build, Serve, Release };
