import Build from "./lib/build.js";
import { defineConfig, loadConfig } from "./lib/config.js";
import Create from "./lib/create.js";
import Release from "./lib/release.js";
import Serve from "./lib/serve.js";

const Config = {
  defineConfig,
  loadConfig,
};

export { defineConfig, Config, Create, Build, Serve, Release };
