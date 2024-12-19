# Release

When releasing a plugin, we typically need to manually update the `version` value in `manifest.json`, package the plugin, upload it somewhere, and then update the `version` and link in `update.json`.

To maintain Git history, we also need to commit the changes and add a tag to the commit after updating the version.

— It’s too tedious!

With Scaffold, all you need to do is run `zotero-plugin release` and select the desired version number. Everything else will be handled automatically.
