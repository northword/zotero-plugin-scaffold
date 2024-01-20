# Zotero Plugin Development Scaffold

Working in progress.

Create a standalone npm package for scripts in the zotero-plugin-template repository, so that downstream developers can follow along.

This repository serves only as a proof-of-concept for the above.

## Usage

### 01. Install

#### From NPM

> WIP

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
pnpm run build

# npm link
cd your-plugin-work-dir/
pnpm link ../zotero-plugin-scaffold
```

### 02. Create a config file

The configuration file needs to be stored in the following location. If the configuration file is not found, an error will be thrown.

```bash
zotero-plugin.config.ts
# also avaliable in *.js  *.mjs  *.cjs  *.ts
# Or The `zotero-plugin`` property in `package.json`
# see https://github.com/cosmiconfig/cosmiconfig?tab=readme-ov-file#usage-for-end-users
```

You can import `defineConfig` in js module to get type hints. If no value is specified for an optional property, the default value will be used.

```ts
import { defineConfig } from "zotero-plugin-scaffold";

export default defineConfig({
  placeholders: {
    addonName: "Test Addon for Zotero",
    addonID: "",
    addonRef: "",
    addonInstance: "",
    updateJSON: "",
    releasePage: ""
  },
});
```

Full config please refrence in [src/types.ts](./src/types.ts).

### 03. Create a env file

This file defines Zotero's runtime configuration such as binary paths, profile paths, and environment variables required for Node scripts to run.

NOTE: Do not check-in this file to the repository!

```bash
.env
```

```ini
# Please input the path of the Zotero binary file in `zoteroBinPath`.
# The path delimiter should be escaped as `\\` for win32. The path is `*/Zotero.app/Contents/MacOS/zotero` for MacOS.
zoteroBinPath = /path/to/zotero.exe

# Please input the path of the profile used for development in `profilePath`.
# Start the profile manager by `/path/to/zotero.exe -p` to create a profile for development
# https://www.zotero.org/support/kb/profile_directory
profilePath = /path/to/profile

# Please input the directory where the database is located in dataDir
# If this field is kept empty, Zotero will start with the default data.
# https://www.zotero.org/support/zotero_data
dataDir =

# Other environment variables (optional)
# GITHUB_TOKEN =
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

# Or, run cmd in terminal
pnpm exec zotero-plugin build
```

## Using in NodeJS code

```ts
import { Build, Config } from "zotero-plugin-scaffold";

const config = await Config.loadConfig();

const Builder = new Build(config, "production");
await Builder.run();
```

## Contributing

```bash
# Git Clone
git clone https://github.com/northword/zotero-plugin-scaffold.git zotero-plugin-scaffold
cd zotero-plugin-scaffold/

# Install deps
pnpm install

# Watch
pnpm run dev

# Build
pnpm run build

# Lint and Prettier
pnpm run lint:fix
```

## Acknowledgements

This project references the design and code of the [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template).

This project would not be possible without the support of the [open source community](https://github.com/northword/zotero-plugin-scaffold/network/dependencies).
