import { readFile, writeFile } from "node:fs/promises";
import { ensureFile, pathExists } from "fs-extra";

export async function checkGitIgnore() {
  if (!pathExists(".git"))
    return;

  await ensureFile(".gitignore");
  const contents = (await readFile(".gitignore", "utf-8")).split("\n");

  const ignores = ["node_modules", ".env", ".scaffold"];

  ignores.forEach((ignore) => {
    if (!contents.includes(ignore))
      contents.push(ignore);
  });

  await writeFile(".gitignore", contents.join("\n"));
}
