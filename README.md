# Zotero Plugin Development Scaffold

[![NPM Version](https://img.shields.io/npm/v/zotero-plugin-scaffold)](https://www.npmjs.com/package/zotero-plugin-scaffold)
[![NPM Downloads](https://img.shields.io/npm/dm/zotero-plugin-scaffold)](https://www.npmjs.com/package/zotero-plugin-scaffold)
![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/zotero-plugin-scaffold)
![GitHub License](https://img.shields.io/github/license/northword/zotero-plugin-scaffold)

This is an npm package designed to assist in the development of Zotero plugins. It provides features such as compiling plugins, starting Zotero and installing plugins from source code, reloading plugins when the source code changes, and releasing plugins, and so on.

Initially, the code of this package was part of the [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template) repository. To allow downstream developers to easily stay up-to-date, we have abstracted these scripts into a standalone npm package.

This project is under active development, and some APIs may change. However, it is ready for production and has been [used in several projects](https://github.com/northword/zotero-plugin-scaffold/network/dependents).

For best practices regarding this package, please refer to [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template).

## Using in a blank project

<details>

<summary>WIP: Not yet implemented</summary>

```bash
# npm
npx zotero-plugin create
# pnpm
pnpm dlx zotero-plugin create
```

</details>

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

Full config please refrence in [src/types](./src/types/index.ts).

### 03. Create a env file

This file defines Zotero's runtime configuration such as binary paths, profile paths, and environment variables required for Node scripts to run.

NOTE: Do not check-in this file to the repository!

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

## Contributing

```bash
# Git Clone
git clone https://github.com/northword/zotero-plugin-scaffold.git zotero-plugin-scaffold
cd zotero-plugin-scaffold/

# Install deps
pnpm install

# Development Mode
# This command creates a typescript runtime using jiti,
# and the modified code does not need to be built again.
pnpm run dev

# Build
pnpm run build

# ES Lint
pnpm run lint:fix
```

## License

GNU Affero General Public License Version 3.

## Acknowledgements

This project references the design and code of the [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template).

This project would not be possible without the support of the [open source community](https://github.com/northword/zotero-plugin-scaffold/network/dependencies).
