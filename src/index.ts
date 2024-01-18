import Build from "./lib/build.js";
import { defineConfig, loadConfig } from "./lib/config.js";
import Server from "./lib/server.js";

const Config = {
  defineConfig,
  loadConfig,
};

export { defineConfig, Config, Build, Server };
