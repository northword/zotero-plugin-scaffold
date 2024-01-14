#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";

import zPlugin from "../dist/main.js";

const absolutePackageDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

await zPlugin.main(absolutePackageDir);
