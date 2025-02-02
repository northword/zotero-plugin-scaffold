import { extname } from "node:path";

const mimeTypes: { [key: string]: string[] } = {
  "application/json": ["json"],
  "application/x-xpinstall": ["xpi"],
};

export function getMimeTypeByFileName(filename: string) {
  const ext = extname(filename);

  for (const type in mimeTypes) {
    if (mimeTypes[type].includes(ext))
      return type;
  }

  return undefined;
}
