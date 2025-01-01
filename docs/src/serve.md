# Serve

This module starts a development server, precompiles the plugin, and installs it after launching Zotero.

When source code changes are detected, the plugin is automatically recompiled and reloaded in Zotero.

## Zotero and Profile Path

Define the paths for the Zotero binary, profile, and data in a `.env` file:

```ini
# Path to the Zotero binary file.
# For macOS, the path is typically `*/Zotero.app/Contents/MacOS/zotero`.
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=/path/to/zotero.exe

# Path to the profile used for development.
# To create a profile for development, start the profile manager with `/path/to/zotero.exe -p`.
# More info: https://www.zotero.org/support/kb/profile_directory
ZOTERO_PLUGIN_PROFILE_PATH=/path/to/profile

# Optional path to the data directory (if needed).
ZOTERO_PLUGIN_DATA_DIR=/path/to/data
```

- **Zotero binary file path** and **profile path** are mandatory.
- If you manage multiple plugins, these paths can be stored in system/user environment variables. However, paths defined in `.env` currently do not override system/user-level variables. This behavior may change in future versions.

## Launch Arguments and Developer Tools

Customize launch arguments and enable developer tools using the `serve.tools` and `serve.startArgs` options:

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  server: {
    devtools: true,
    startArgs: [],
  },
});
```

- `--purgecaches` and `--no-remote` are always included in the Zotero startup arguments, regardless of the `server.startArgs` configuration.
- If `devtools` is set to `true`, the `--jsdebugger` argument is appended, enabling the Firefox developer tools.

## Hot Reloading and Proxy File

The Zotero team's [plugin development guide](https://www.zotero.org/support/dev/client_coding/plugin_development) describes using Proxy File for loading plugins from source. While this method works for older versions of Zotero (e.g., Zotero 6), it **does not support plugin reloading**.

Zotero 7 and later use an updated Firefox architecture, which supports more modern development methods using the [Remote Debugging Protocol (RDP)](https://firefox-source-docs.mozilla.org/devtools/backend/protocol.html#remote-debugging-protocol).

By default, Scaffold employs this new approach for plugin installation and reloading, similar to the method used by Firefox's `web-ext` tool.

For Zotero 6 or earlier, set `server.asProxy` to `true` to enable the Proxy File approach.

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  server: {
    asProxy: true
  },
});
```
