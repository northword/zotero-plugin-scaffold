# Zotero Plugin Development Tools

Working in progress.

Create a standalone npm package for scripts in the zotero-plugin-template repository, so that downstream developers can follow along.

This repository serves only as a proof-of-concept for the above.

## Usage

### 01. Install

#### From NPM

> WIP

#### From GitHub

```bash
# clone this repo
git clone 

# npm link
cd your-plugin-work-dir/
pnpm link ../zotero-plugin-dev-tool

```

### 02. Creat a config file

```bash
.zotero-pluginrc
zotero-plugin.config.ts
# also avaliable in *.js  *.mjs  *.cjs  *.ts  *.yaml  *.json
```

```ts
import { defineConfig } from "zotero-plugin-dev-tool/";

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

### 03. Creat a env file

```bash
.env
scripts/.env
```

```ini
zoteroBinPath = /path/to/zotero.exe
profilePath = /path/to/profile
dataDir = 
```

### 04. Run

```bash
pnpm exec zotero-plugin build
```

## Using in NodeJS code

```ts
import { Config, Build } from "zotero-plugin-dev-tool";

const config = Config.loadConfig();

const Builder = new Build(config, "production");
Builder.run();
```
