# ES Lint Config for Zotero

## Features

- Flat ESLint configuration, easily composable!
- Designed with TypeScript in mind.
- Ignores common files such as `.scaffold`, `dist`, `node_modules`, and files listed in `.gitignore`.
- [Special cases](./src/configs/specialCases.ts) tailored for Zotero plugins.
- Mocha support.

## Usage

```bash
npm install -D @zotero-plugin/eslint-config
```

```js
import zotero from "@zotero-plugin/eslint-config";

export default zotero();
```

## Thanks

- [`sxzz/eslint-config`](https://github.com/sxzz/eslint-config)
