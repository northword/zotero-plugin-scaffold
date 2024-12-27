# Build

This `Build` class in your Node.js project encapsulates the process of building, packaging, and preparing a Zotero plugin for release. Below is a brief overview of its key features and functionality:

## 构建流程

### 复制资产

使用 `assets` 来定义需要复制的资产。

### 定义

Configurable via the define option.

This feature provides a way to replace global identifiers with constant expressions.

替换在复制资产完成后立即发生。

Replaces placeholders (`__PLACEHOLDER__`) in files with values defined in the build configuration.

### Manifest Generation

Merges user-supplied manifest data with required fields (e.g., `id`, `updateURL`) to create a complete `manifest.json` (`makeManifest`).

### Locale File Handling

Processes Fluent `.ftl` files, adding a namespace prefix and ensuring HTML references (`data-l10n-id`) are consistent with Fluent messages.

### Preference Management

- Supports prefixing preference keys in `prefs.js` with a custom namespace.
- Optionally generates TypeScript declaration files (`.d.ts`) for preferences.

### Script Bundling

Uses `esbuild` to bundle JavaScript files with options defined in the configuration (`esbuild`).

### Plugin Packing

Creates a `.xpi` archive for the plugin using `AdmZip`.

### Update Manifest

Generates `update.json` and `update-beta.json` with versioning and compatibility information for Zotero plugin updates.

## Extensibility

- The use of hooks allows custom behaviors to be injected at various stages of the build process.
