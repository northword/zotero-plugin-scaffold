# Testing

`zotero-plugin-scaffold` can run [Mocha](https://mochajs.org/) / [Chai](https://www.chaijs.com/)-based tests against a live Zotero instance via a proxy plugin.

A temporary profile and data directory will be created when launching Zotero, so tests can be run locally on the system Zotero installation.

## Why

Since Zotero is a browser environment and has a lot of private APIs, if we use the mainstream Node-side testing scheme, we will inevitably need to mock a lot of methods, which will distort the test results.

In Scaffold, we use mocha as the testing framework, which is a simple but flexible enough testing framework for the browser side. We also use chai as an assertion library.

When we start a test, we generate a temporary plugin in `.scaffold/test/resource/` that we use to run the test. Iterate through the test files in the `test.entries` directory and compile them in `.scaffold/test/resource/content`.

When Zotero starts up, it loads your plugin and the test plugin that was just generated separately, so we have complete access to all the APIs and can use them for testing.

## Usage

### Configuring Test Options

After configuring your project to be built with `zotero-plugin-scaffold`, add a `test` object to your configuration:

```ts twoslash
export default defineConfig({
  // ...
  test: {
    // Directories containing *.spec.js tests
    entries: ["test"],
    // Exit Zotero when the test is finished.
    exitOnFinish: true,
    // Function string that returns the initialization status of the plugin.
    // If set, the test will wait until the function returns true before running the test.
    // e.g.
    //   if your plugin created a `MyPlugin` object beneath `Zotero` and it set an
    //  `initialized` field to `true` at the end of its `startup` bootstrap method...
    waitForPlugin: `() => Zotero.MyPlugin.initialized`,
  }
});
```

::: tip

See the `TestConfig` interface in [`src/types/config.ts`](https://github.com/northword/zotero-plugin-scaffold/blob/main/src/types/config.ts) for full documentation.

:::

Add a script to `package.json`:

```json
{
  "scripts": {
    "test": "zotero-plugin test"
  }
}
```

### Install Mocha and Chai

We recommend that you install `mocha.js` locally as a development dependency, as this will avoid some potential dependency conflicts:

```bash
npm install -D mocha @types/mocha @types/chai
```

When Scaffold detects your locally installed mocha, it will automatically use your installed mocha, otherwise Scaffold will get the latest version of mocha from NPM.

Since the ESM import issue for Chai has not been resolved, chai will always use the remote version.

The mocha and chai downloaded from the remote will be cached in the `.scaffold/cache` directory, and you can delete the cache if you need to in order to force Scaffold to update their versions.

### Write Your Test Cases

You can then write your test file, see [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) for syntax.

### Run Test

一旦你完成测试代码的编写，你可以通过 `npm run test` 来启动测试。

`zotero-plugin test` 也提供了一些命令行参数，以便你可以覆盖配置文件中的设置，你可以通过 `zotero-plugin test --help` 来查看：

```bash
$ pnpm zotero-plugin test --help
Usage: cli test [options]

Run tests

Options:
  --abort-on-fail   Abort the test suite on first failure
  --exit-on-finish  Exit the test suite after all tests have run
  -h, --help        display help for command
```

## Watch Mode

In watch mode, Scaffold will:

- When the source code changes, it will automatically recompile the source code, reload the plugins and re-run the tests;
- When the test code changes, it will automatically re-run the tests;

This feature is not yet complete.

## Run Test on CI

Most of the time, we want tests to run automatically on CI services such as GitHub Actions, for which we provide `headless` mode.

In general, when we detect that you are running tests on a CI service, we will automatically enable headless mode. If you have a need to use headless locally, you just need to pass `headless` in the cli parameter or set `test.headless: true` in the configuration.

::: warning

Scaffold's built-in headless mode is only supported on Ubuntu 22.04, 24.04. If you are using a different Linux distribution, manually configure the headless environment, set Scaffold's `test.headless` to `false`, and start the test using something like `xvfb-run npm run test`, etc.

:::

For tests running on GitHub Actions, this is a typical workflow template:

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
