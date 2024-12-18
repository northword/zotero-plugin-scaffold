# Quick Start

## Using in a blank project

::: details WIP: Not yet implemented

```bash
# npm
npx zotero-plugin create
# pnpm
pnpm dlx zotero-plugin create
```

:::

## Using in an existing project

### 01. Install

```bash
npm install -D zotero-plugin-scaffold

yarn add -D zotero-plugin-scaffold

pnpm add -D zotero-plugin-scaffold
```

### 02. Create a config file

The configuration file needs to be stored in the following location.

```bash
zotero-plugin.config.ts  # also avaliable in *.js  *.mjs  *.cjs  *.ts
```

You can import helper `defineConfig` to get type hints. If no value is specified for an optional property, the default value will be used.

```ts
import { defineConfig } from "zotero-plugin-scaffold";

export default defineConfig({
  name: "the plugin name",
  id: "the plugin id",
  namespace: "the plugin namespace",
  build: {
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        bundle: true,
        target: "firefox115",
      },
    ],
  },
});
```

Full config please refrence in [src/types](https://github.com/northword/zotero-plugin-scaffold/blob/main/src/types/config.ts).

### 03. Create a env file

This file defines Zotero's runtime configuration such as binary paths, profile paths, and environment variables required for Node scripts to run.

::: warning

NOTE: Do not check-in this file to the repository!

:::

```bash
.env
```

```ini
# The path of the Zotero binary file.
# The path is `*/Zotero.app/Contents/MacOS/zotero` for macOS.
ZOTERO_PLUGIN_ZOTERO_BIN_PATH = /path/to/zotero.exe

# The path of the profile used for development.
# Start the profile manager by `/path/to/zotero.exe -p` to create a profile for development.
# @see https://www.zotero.org/support/kb/profile_directory
ZOTERO_PLUGIN_PROFILE_PATH = /path/to/profile
```

### 04. Add scripts to package.json

```json
{
  "scripts": {
    "start": "zotero-plugin serve",
    "build": "zotero-plugin build",
    "release": "zotero-plugin release"
  }
}
```

### 05. Run

```bash
pnpm run start
pnpm run build
```

## Using in NodeJS code

```ts
import { Build, Config } from "zotero-plugin-scaffold";

const config = await Config.loadConfig();

const Builder = new Build(config);
await Builder.run();
```
