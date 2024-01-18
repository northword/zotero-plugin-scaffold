# Zotero Plugin Development Tools

Working in progress.

Create a standalone npm package for scripts in the zotero-plugin-template repository, so that downstream developers can follow along.

This repository serves only as a proof-of-concept for the above.

## Usage

### 01. Install

#### From NPM

> WIP

#### From source code

```bash
# clone this repo
git clone https://github.com/northword/zotero-plugin-dev-tool.git zotero-plugin-dev-tool/
cd zotero-plugin-dev-tool/

# build
pnpm install
pnpm run build

# npm link
cd your-plugin-work-dir/
pnpm link ../zotero-plugin-dev-tool
```

### 02. Create a config file (optional)

The configuration file needs to be stored in the following location. If not found, the default configuration will be used.

```bash
zotero-plugin.config.ts
# also avaliable in *.js  *.mjs  *.cjs  *.ts
```

```ts
import { defineConfig } from "zotero-plugin-dev-tool";

export default defineConfig({
  placeholders: {
    addonName: "Test Addon for Zotero",
    addonDescription: "Test desc for Zotero",
    addonID: "",
    addonInstance: "",
    addonRef: "",
    prefsPrefix: "",
  },
});
```

Full config please refrence in [src/config.ts](./src/types.ts).

### 03. Create a env file

This file defines Zotero's runtime configuration such as binary paths, profile paths, and environment variables required for Node scripts to run.

NOTE: Do not check-in this file to the repository!

```bash
.env
scripts/.env
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

# GitHub Token
# For release-it
# GITHUB_TOKEN =
```

### 04. Add scripts to package.json

```json
{
  "scripts": {
    "start": "zotero-plugin server",
    "build": "zotero-plugin build"
  }
}
```

### 05. Run

```bash
pnpm run build

# Or, run cmd in terminal
pnpm exec zotero-plugin build
```

## Using in NodeJS code

```ts
import { Build, Config } from "zotero-plugin-dev-tool";

const config = Config.loadConfig();

const Builder = new Build(config, "production");
Builder.run();
```

## Contributing

```bash
# Git Clone
git clone https://github.com/northword/zotero-plugin-dev-tool.git zotero-plugin-dev-tool
cd zotero-plugin-dev-tool/

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

This project would not be possible without the support of the [open source community](https://github.com/northword/zotero-plugin-dev-tool/network/dependencies).
