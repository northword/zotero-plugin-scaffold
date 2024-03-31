# Zotero Plugin Development Scaffold

Working in progress.

Create a standalone npm package for scripts in the zotero-plugin-template repository, so that downstream developers can follow along.

This repository serves only as a proof-of-concept for the above.

## Using in a blank project

> WIP: Not yet implemented

```bash
# npm
npx zotero-plugin create
# pnpm
pnpm dlx zotero-plugin create
```

## Using in an existing project

### 01. Install

#### From NPM

```bash
npm install -D zotero-plugin-scaffold

yarn add -D zotero-plugin-scaffold

pnpm add -D zotero-plugin-scaffold
```

#### From source code

```bash
# clone this repo
git clone https://github.com/northword/zotero-plugin-scaffold.git zotero-plugin-scaffold/
cd zotero-plugin-scaffold/

# build
pnpm install
pnpm build # or pnpm dev

# npm link
cd your-plugin-work-dir/
pnpm link ../zotero-plugin-scaffold
```

### 02. Create a config file

The configuration file needs to be stored in the following location. If the configuration file is not found, an error will be thrown.

```bash
zotero-plugin.config.ts  # also avaliable in *.js  *.mjs  *.cjs  *.ts
```

You can import `defineConfig` in js module to get type hints. If no value is specified for an optional property, the default value will be used.

```ts
import { defineConfig } from "zotero-plugin-scaffold";

export default defineConfig({
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://raw.githubusercontent.com/{{owner}}/{{repo}}/main/update.json`,
  xpiDownloadLink: "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",
  build: {
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
      },
    ],
  },
});

```

Full config please refrence in [src/types](./src/types/index.ts).

### 03. Create a env file

This file defines Zotero's runtime configuration such as binary paths, profile paths, and environment variables required for Node scripts to run.

NOTE: Do not check-in this file to the repository!

```bash
.env
```

```ini
# The path of the Zotero binary file.
# The path delimiter should be escaped as `\\` for win32. 
# The path is `*/Zotero.app/Contents/MacOS/zotero` for MacOS.
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
    "start": "zotero-plugin server",
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

## Contributing

```bash
# Git Clone
git clone https://github.com/northword/zotero-plugin-scaffold.git zotero-plugin-scaffold
cd zotero-plugin-scaffold/

# Install deps
pnpm install

# Development Mode
# This command creates a js runtime using jiti, and the modified code does not need to be built again.
pnpm run dev

# Build
pnpm run build

# Lint and Prettier
pnpm run lint:fix
```

## Acknowledgements

This project references the design and code of the [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template).

This project would not be possible without the support of the [open source community](https://github.com/northword/zotero-plugin-scaffold/network/dependencies).
