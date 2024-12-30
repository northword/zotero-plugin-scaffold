# Build

该模块提供了编译和打包插件的能力，它预置了一些使用的打包器，如“复制”、“替换”、“bundling”等，使你可以快速配置插件构建流程。

同时还提供了一组钩子，以便你对构建过程进行定制。

## 内建的构建器

内置的构建起按照下面行文的顺序串行运行。

### 复制资产

此步骤将源目录的静态资产复制到构建目录。

使用 `build.assets` 来配置需要复制的资产：

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    assets: ["addon"]
  }
});
```

### 定义

This feature provides a way to replace global identifiers with constant expressions.

Configurable via the `build.define` option.

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    define: {
      placeholder: "placeholderValue"
    }
  }
});
```

::: warning

替换在复制资产完成后立即发生，且仅在当前状态下 `config.dist` 下的所有资产中发生。

如果你需要为非资产文件替换占位符，如 `README.md` 等，可以使用 Scaffold 导出的实用工具 `replaceInFile`，见：[实用工具](#)。

如果你需要为 JavaScript 脚本替换常量，你可以使用 `esbuild.define`，参：[Script Bundling](#script-bundling)。

:::

替换时，定义的占位符 `placeholder` 将被转为正则表达式 `/__placeholder__/g` 进行替换（而不是 `/placeholder/g`）。

该选项提供了一些内置的占位符供你使用，如 `version`, `buildTime` 等，见 `Context.templateData`。

### Manifest Generation

自动更新 `manifest.json` 中的字段，包括 `version`, `id`, `update_url` 等。

该功能默认启用，将 `makeManifest` 设置为 `false` 来禁用该功能。

`version` 值来自 `package.json`，其余值可以在配置文件中配置。

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  name: "Your Plugin Name",
  id: "Your Plugin ID",
  updateURL: "Your update.json Path",
  build: {
    makeManifest: {
      enable: true
    }
  }
});
```

### Locale File Handling

处理本地化文件以防止冲突。

通过 `fluent` 配置。

#### 为 FTL 文件名添加前缀

//

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  namespace: "Your Plugin Namespace",
  build: {
    fluent: {
      prefixLocaleFiles: true
    }
  }
});
```

#### 为 FTL Message 添加前缀

Processes Fluent `.ftl` files, adding a namespace prefix and ensuring HTML references (`data-l10n-id`) are consistent with Fluent messages.

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  namespace: "Your Plugin Namespace",
  build: {
    fluent: {
      prefixFluentMessages: true
    }
  }
});
```

#### 为 FTL Message 生成类型定义

> 尚在开发。

### Preference Management

> 尚在开发。

- Supports prefixing preference keys in `prefs.js` with a custom namespace.
- Optionally generates TypeScript declaration files (`.d.ts`) for preferences.

### Script Bundling

使用 `esbuild` 来编译/打包你的 JavaScript/TypeScript 脚本代码。

使用 `build.esbuild` 来配置：

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  build: {
    esbuildOptions: []
  }
});
```

由于 esbuild 仅编译/打包代码，不执行类型检查，因此你需要手动调用 `tsc` 进行类型检查。

### Plugin Packing

Creates a `.xpi` archive for the plugin using `AdmZip`.

```ts twoslash
import { defineConfig } from "zotero-plugin-scaffold";
// ---cut---
export default defineConfig({
  xpiName: "Your Plugin Built XPI Name"
});
```

### Update Manifest

Generates `update.json` and `update-beta.json` with versioning and compatibility information for Zotero plugin updates.

通过 `build.makeUpdateJson` 来配置：

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
              strict_max_version: "6.9.9"
            }
          }
        }
      ],
      hash: true
    }
  }
});
```

## Extensibility

- The use of hooks allows custom behaviors to be injected at various stages of the build process.
