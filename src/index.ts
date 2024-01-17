import Build from "./build.js";
import { defineConfig, loadConfig } from "./config.js";
import Server from "./server.js";

const Config = {
  defineConfig,
  loadConfig,
};

export { defineConfig, Config, Build, Server };
