# Release

我们都知道，对于一个插件的发布，我们需要手动修改 `manifest.json` 中的 `version` 值，然后将其打包，上传到某个地方，随后，我们还需要更新 `update.json` 中的版本号和链接。

为了保持 Git 记录，我们在修改 version 值后，还需要提交代码并为这个提交添加 tag。

—— 这太麻烦了！

在 Scaffold 中，你只需要运行 `zotero-plugin release`，然后选择一个你需要的版本号，一切都将自动运行。
