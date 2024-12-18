# Testing

`zotero-plugin-scaffold` can run [mocha](https://mochajs.org/)/[chai](https://www.chaijs.com/)-based tests against a live Zotero instance via a proxy plugin.
A temporary profile and data directory will be created when launching Zotero,
so tests can be run locally on the system Zotero installation.

## Configuration

> [!TIP]
> See the `TestConfig` interface in [`src/types/config.ts`](./src/types/config.ts) for full documentation

After configuring your project to be built with `zotero-plugin-scaffold`,
add a `test` object to your configuration:

```js
export default defineConfig({
  // ...
  test: {
    // Directories containing *.spec.js tests
    entries: ["test/"],
    // Abort the test when the first test fails
    abortOnFail: false,
    // Exit Zotero when the test is finished.
    exitOnFinish: true,
    // Function string that returns the initialization status of the plugin.
    // If set, the test will wait until the function returns true before running the test.
    // e.g.
    //   if your plugin created a `MyPlugin` object beneath `Zotero` and it set an
    //  `initialized` field to `true` at the end of its `startup` bootstrap method...
    waitForPlugin: `() => Zotero.MyPlugin.initialized`,
    // Run tests using xvfb without launching a Zotero window
    // (Linux only. defaults `true` in CI. Both xvfb and Zotero are installed automatically)
    headless: false,
  }
});
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "...": "...",
    "test": "zotero-plugin test --abort-on-fail --exit-on-finish"
  }
}
```

## CI

Tests can be run headlessly, e.g. on Github Actions:

::: warning

Currently ubuntu must be pinned lower than `24.04`, see [`#74`](https://github.com/northword/zotero-plugin-scaffold/issues/74)

:::

```yaml
name: test

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-22.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4

      - name: Install deps
        run: npm install

      - name: Test
        run: npm test
```
