# Testing

`zotero-plugin-scaffold` enables testing with [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) in a live Zotero instance through a proxy plugin.

When running tests, a temporary profile and data directory are created, allowing the tests to execute locally on the installed Zotero application.

## Why Use This Approach?

Zotero operates in a browser-like environment with many private APIs. Using conventional Node.js testing frameworks would require extensive mocking, leading to distorted test results.

To address this, Scaffold uses Mocha as a lightweight yet flexible browser-compatible testing framework, complemented by Chai for assertions.

Tests are executed via a temporary plugin generated in `.scaffold/test/resource/`. The test files in the `test.entries` directory are compiled into `.scaffold/test/resource/content`. When Zotero launches, it loads both the primary plugin and the generated test plugin, providing full access to all APIs needed for testing.

## Usage

### Configuring Test Options

After setting up your project with `zotero-plugin-scaffold`, add a `test` object to your configuration:

```ts
export default defineConfig({
  // ...
  test: {
    // Directories containing *.spec.js test files
    entries: ["test"],
    // Exit Zotero after the tests complete
    exitOnFinish: true,
    // Function string that returns the plugin's initialization status
    // The test waits until this function returns true
    // Example: if your plugin sets `Zotero.MyPlugin.initialized` to `true` in its `startup` method...
    waitForPlugin: `() => Zotero.MyPlugin.initialized`,
  }
});
```

::: tip
Refer to the `TestConfig` interface in [`src/types/config.ts`](https://github.com/northword/zotero-plugin-scaffold/blob/main/src/types/config.ts) for complete documentation.
:::

Add a `test` script to your `package.json`:

```json
{
  "scripts": {
    "test": "zotero-plugin test"
  }
}
```

### Install Mocha and Chai

Install `mocha` as a local development dependency to avoid potential conflicts:

```bash
npm install -D mocha @types/mocha @types/chai
```

If Scaffold detects a local `mocha` installation, it will use it. Otherwise, it fetches the latest version from NPM. Due to unresolved ESM import issues with Chai, Scaffold always uses the remote version.

Cached versions of `mocha` and `chai` are stored in `.scaffold/cache`. Delete this cache if you need to force an update.

### Writing Test Cases

Write test cases using [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) syntax.

### Running Tests

After writing your test cases, run them using:

```bash
npm run test
```

You can override configuration settings with CLI parameters. Use `zotero-plugin test --help` to view available options:

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

In watch mode, Scaffold automatically:

- Recompiles source code, reloads plugins, and reruns tests when the source changes.
- Reruns tests when test files are modified.

This feature is still under development.

## Running Tests on CI

To run tests automatically on CI services like GitHub Actions, Scaffold provides a `headless` mode.

By default, Scaffold enables headless mode on CI services. To enable it locally, pass `headless` as a CLI parameter or set `test.headless: true` in the configuration.

::: warning
Scaffold's built-in headless mode supports only Ubuntu 22.04 and 24.04. For other Linux distributions, manually configure a headless environment, set `test.headless` to `false`, and use tools like `xvfb-run npm run test`.
:::

For GitHub Actions, use the following workflow template:

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
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test
```
