# Zotero Plugin Development Tools

Working in progress.

Create a standalone npm package for scripts in the zotero-plugin-template repository, so that downstream developers can follow along.

This repository serves only as a proof-of-concept for the above.

## Usage

### Install

```bash
# clone this repo
git clone 

# npm link
cd your-plugin-work-dir/
pnpm link ../zotero-plugin-dev-tool

```

### Config

creat a config

```ts
// zotero-plugin.config.ts
import { ZoteroPluginDev } from "zotero-plugin-dev-tool/";

export default ZoteroPluginDev({
  addon: {
    addonName: "Test Addon for Zotero",
    addonDescription: "Test desc for Zotero",
    addonID: "",
    addonInstance: "",
    addonRef: "",
    prefsPrefix: "",
  },
});
```
