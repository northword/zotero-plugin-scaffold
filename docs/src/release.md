# Release

When releasing a plugin, we typically need to manually update the `version` value in `manifest.json`, package the plugin, upload it somewhere, and then update the `version` and link in `update.json`.

To maintain Git history, we also need to commit the changes and add a tag to the commit after updating the version.

— It’s too tedious!

With Scaffold, all you need to do is run `zotero-plugin release` and select the desired version number. Everything else will be handled automatically.

## Usage

```bash
zotero-plugin release
```

This will use Bumpp to prompt for the new version number, locally bump the version, run any (pre/post)version scripts defined in package.json, commit, build (optional), tag the commit with the version number and push commits and git tags. Bumpp can be configured in zotero-plugin-config.ts; for example, add release: { bumpp: { execute: "npm run build" } } to also build before committing.

Subsequently GitHub Action will rebuild the plugin and use zotero-plugin-scaffold's release script to publish the XPI to GitHub Release. In addition, a separate release (tag: release) will be created or updated that includes update manifests update.json and update-beta.json as assets. These will be available at `https://github.com/{{owner}}/{{repo}}/releases/download/release/update*.json`.
