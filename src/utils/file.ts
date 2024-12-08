import fs from "node:fs/promises";

export async function clearDir(dirPath: string) {
  if (await fs.stat(dirPath).catch(() => false)) {
    await fs.rm(dirPath, { recursive: true, force: true });
  }
  await fs.mkdir(dirPath, { recursive: true });
}

export async function saveResource(url: string, path: string) {
  const res = await fetch(url);
  await fs.writeFile(path, await res.text());
}

export async function recursiveFindFiles(dirPath: string, ext: string) {
  const files = await fs.readdir(dirPath, { withFileTypes: true });
  const result: string[] = [];
  for (const file of files) {
    if (file.isDirectory()) {
      result.push(...await recursiveFindFiles(`${dirPath}/${file.name}`, ext));
    }
    else if (file.name.endsWith(ext)) {
      result.push(`${dirPath}/${file.name}`);
    }
  }
  return result;
}
