import { defineConfig, loadConfig } from "./config.js";
import Build from "./core/builder.js";
import Release from "./core/releaser/index.js";
import Serve from "./core/server/index.js";

const Config = {
  defineConfig,
  loadConfig,
};

export { defineConfig, Config, Build, Serve, Release };
