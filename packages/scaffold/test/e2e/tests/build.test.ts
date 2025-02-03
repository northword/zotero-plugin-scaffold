import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";

const SNAPSHOT_DIR = join(__dirname, "../snap"); // 预期的快照目录
const FIXTURES_DIR = join(__dirname, "../fixtures"); // 测试用例目录

describe("#build", () => {
  const stdout = execSync("pnpm tsx build.ts", {
    cwd: FIXTURES_DIR,
    env: { ...process.env, NODE_ENV: "production" },
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
