import { readFile, writeFile } from "node:fs/promises";
import { glob } from "tinyglobby";

export function dateFormat(fmt: string, date: Date) {
  let ret;
  const opt: { [key: string]: string } = {
    "Y+": date.getFullYear().toString(),
    "m+": (date.getMonth() + 1).toString(),
    "d+": date.getDate().toString(),
    "H+": date.getHours().toString(),
    "M+": date.getMinutes().toString(),
    "S+": date.getSeconds().toString(),
  };
  for (const k in opt) {
    ret = new RegExp(`(${k})`).exec(fmt);
    if (ret) {
      fmt = fmt.replace(
        ret[1],
        ret[1].length === 1 ? opt[k] : opt[k].padStart(ret[1].length, "0"),
      );
    }
  }
  return fmt;
}

export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * template is used to replace data by name in template strings.
 * The default expression looks for {{name}} to identify names.
 *
 * Ex. template('Hello, {{name}}', { name: 'ray' })
 * Ex. template('Hello, <name>', { name: 'ray' }, /<(.+?)>/g)
 *
 * @see https://github.com/sodiray/radash/blob/069b26cdd7d62e6ac16a0ad3baa1c9abcca420bc/src/string.ts#L111-L126
 */
export function template(str: string, data: Record<string, any>, regex = /\{\{(.+?)\}\}/g) {
  return Array.from(str.matchAll(regex)).reduce((acc, match) => {
    return acc.replace(match[0], data[match[1]]);
  }, str);
}

export function parseRepoUrl(url?: string) {
  if (!url)
    throw new Error("Parse repository URL failed.");

  const match = (url).match(/:\/\/.+com\/([^/]+)\/([^.]+)\.git$/);
  if (!match) {
    throw new Error("Parse repository URL failed.");
  }
  const [, owner, repo] = match;
  return { owner, repo };
}

export function replace(contents: string, from: RegExp | RegExp[], to: string | string[]) {
  const froms = Array.isArray(from) ? from : [from];
  const tos = Array.isArray(to)
    ? to
    : Array.from({ length: froms.length }, () => to);

  if (froms.length !== tos.length) {
    throw new Error("The lengths of 'from' and 'to' must be equal");
  }

  return froms.reduce((result, pattern, index) => result.replace(pattern, tos[index]), contents);
}

export async function replaceInFile({ files, from, to, isGlob = true }: {
  files: string | string[];
  from: RegExp | RegExp[];
  to: string | string[];
  isGlob?: boolean;
}) {
  const paths = isGlob ? await glob(files) : toArray(files);
  await Promise.all(paths.map(async (path) => {
    const contents = await readFile(path, "utf-8");
    const newContents = replace(contents, from, to);
    if (contents !== newContents)
      await writeFile(path, newContents);
  }));
}
