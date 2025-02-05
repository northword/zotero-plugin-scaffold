import type { Buffer } from "node:buffer";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { beforeAll, describe, expect, it } from "vitest";

const SNAPSHOT_DIR = join(__dirname, "../snap");
const FIXTURES_DIR = join(__dirname, "../fixtures");

describe("#build", () => {
  let stdout: Buffer;
  beforeAll(() => {
    stdout = execSync("pnpm tsx build.ts", {
      cwd: FIXTURES_DIR,
      env: { ...process.env, NODE_ENV: "production" },
    });
  });

  it("should output correct files", async () => {
    const paths = [...globSync(["dist/**/*", "!**/*.xpi", "typings"], { cwd: FIXTURES_DIR })];

    for (const path of paths) {
      const content = readFileSync(`${FIXTURES_DIR}/${path}`, "utf-8");
      await expect(content).toMatchFileSnapshot(`${SNAPSHOT_DIR}/${path}`);
    }
  });

  it("should output correct warnings", () => {
    expect(stdout.toString()).toEqual(expect.stringContaining("meaasge-3"));
  });
});
