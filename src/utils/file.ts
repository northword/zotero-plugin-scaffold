import fs from "node:fs/promises";

export async function saveResource(url: string, path: string) {
  const res = await fetch(url);
  await fs.writeFile(path, await res.text());
}
