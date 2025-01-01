# Build

This module provides the capability to compile and package plugins, with built-in bundlers such as "copy," "replace," and "bundling" for quickly configuring your plugin's build process.

It also offers a set of hooks for customizing the build process.

## Information of Plugin

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  name: "Your Plugin Name",
  id: "Your Plugin ID",
  namespace: "Your Plugin Namespace",
});
```

## Built-in Builders

The built-in builders run sequentially in the following order.

### Make Directory

This step creates a new build storage folder.

Configured via the `dist` option:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  dist: ".scaffold/build",
});
```

If the target folder already exists, it will be cleared before creating the new one.

::: details The file structure of `dist`

- `addon` contains the plugin code after the build process but before packaging.
- `*.xpi` represents the packaged plugin files.
- `update*.json` are update manifest.

```text {4,10,12}
.
|-- .scaffold
|   |-- build
|   |   |-- addon
|   |   |   |-- bootstrap.js
|   |   |   |-- content
|   |   |   |-- locale
|   |   |   |-- manifest.json
|   |   |   `-- prefs.js
|   |   |-- linter-for-zotero.xpi
|   |   |-- update-beta.json
|   |   `-- update.json
|   `-- cache
`-- zotero-plugin.config.ts
```

:::

### Copy Assets

This step copies static assets from the source directory to the build directory.

Configure the assets to be copied using `build.assets`:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    assets: ["addon"],
  },
});
```

This is a glob list that supports negation patterns using `!`. For more details, refer to [tinyglobby](https://github.com/SuperchupuDev/tinyglobby).

### Define

This feature allows you to replace global identifiers with constant expressions.

Configurable via the `build.define` option:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    define: {
      placeholder: "placeholderValue",
    },
  },
});
```

::: warning

Replacement occurs immediately after copying assets and applies only to all assets in `config.dist` under the current state.

For non-asset files such as `README.md`, use the Scaffold utility `replaceInFile` (see: [Utilities](#utils)).

For JavaScript constant replacement, use `esbuild.define` (see: [Script Bundling](#script-bundling)).

:::

During replacement, the placeholder `placeholder` is converted into the regular expression `/__placeholder__/g` for replacement (instead of `/placeholder/g`).

This option provides built-in placeholders such as `version` and `buildTime`. See `Context.templateData` for details.

### Manifest Generation

Automatically updates fields in `manifest.json`, including `version`, `id`, `update_url`, and more.

This feature is enabled by default and can be disabled by setting `makeManifest` to `false`.

The `version` is sourced from `package.json`, while other values can be configured in the configuration file:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  name: "Your Plugin Name",
  id: "Your Plugin ID",
  updateURL: "Your update.json Path",
  build: {
    makeManifest: {
      enable: true,
    },
  },
});
```

When `manifest.json` already exists in `dist/addon`, the values will always be deeply merged with the existing content, with priority given to the existing entries.

### Locale File Handling

Handles localization files to prevent conflicts.

Configured via `build.fluent`.

#### Add Prefix to FTL File Names

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  namespace: "Your Plugin Namespace",
  build: {
    fluent: {
      prefixLocaleFiles: true,
    },
  },
});
```

#### Add Prefix to FTL Messages

Processes Fluent `.ftl` files by adding a namespace prefix and ensuring HTML references (`data-l10n-id`) align with Fluent messages.

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  namespace: "Your Plugin Namespace",
  build: {
    fluent: {
      prefixFluentMessages: true,
    },
  },
});
```

#### Generate Type Definitions for FTL Messages

> In development.

### Preference Management

> In development.

- Supports prefixing preference keys in `prefs.js` with a custom namespace.
- Optionally generates TypeScript declaration files (`.d.ts`) for preferences.

### Script Bundling

Uses `esbuild` to compile and bundle your JavaScript/TypeScript code.

Configure it using `build.esbuild`:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    esbuildOptions: [],
  },
});
```

Since `esbuild` only compiles and bundles code without type checking, you need to run `tsc` manually for type checking.

### Plugin Packing

Creates a `.xpi` archive for the plugin using `AdmZip`.

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  xpiName: "Your Plugin Built XPI Name",
});
```

This step executes only in the `production` environment.

### Update Manifest

Generates `update.json` and `update-beta.json` with versioning and compatibility information for Zotero plugin updates.

Configured via `build.makeUpdateJson`:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    makeUpdateJson: {
      updates: [
        {
          version: "0.9.9",
          update_link: "https://example.com/plugin-for-older-zotero.xpi",
          applications: {
            zotero: {
              strict_min_version: "5.9.9",
              strict_max_version: "6.9.9",
            },
          },
        },
      ],
      hash: true,
    },
  },
});
```

This step executes only in the `production` environment.

When the version number includes a `-` (pre-release), only `update-beta.json` is generated. Otherwise, both `update.json` and `update-beta.json` are generated. After installing a pre-release version, users will automatically update to the next pre-release version until the official release. Installing the next pre-release version still requires manual installation.

For different plugin versions targeting different Zotero versions, specify the Zotero version and corresponding plugin version in `build.makeUpdateJson.updates`. Refer to: [Zotero 7 for developers](https://www.zotero.org/support/dev/zotero_7_for_developers#updaterdf_updatesjson).

## Hooks

> Documentation in progress.

## Utils

Scaffold exports utilities and third-party dependencies for use. Import them from `zotero-plugin-scaffold/vendor`.

### replaceInFile

```ts
import { replaceInFile } from "zotero-plugin-scaffold/vendor";

replaceInFile({
  files: ["README.md", "**/README.md"],
  from: [/from/g],
  to: ["to"],
});
```

### fs-extra

> Node.js: Extra methods for the `fs` object like `copy()`, `remove()`, `mkdirs()`.

Refer to the [fs-extra documentation](https://github.com/jprichardson/node-fs-extra).

```ts
import { fse } from "zotero-plugin-scaffold/vendor";

fse.copy("a.txt", "b.txt");
```

### es-toolkit

> es-toolkit: State-of-the-art JavaScript utility library

Refer to the [es-toolkit documentation](https://es-toolkit.slash.page/).

```ts
import { esToolkit } from "zotero-plugin-scaffold/vendor";

esToolkit.isNotNil(null);
```
