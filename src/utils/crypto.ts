import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "fs-extra";

export function generateHash(
  filePath: string,
  algorithm: "sha256" | "sha512" | string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      const fileHash = hash.digest("hex");
      resolve(`${algorithm}:${fileHash}`);
    });

    stream.on("error", (error) => {
      reject(error);
    });
  });
}

export function generateHashSync(
  filePath: string,
  algorithm: "sha256" | "sha512" | string,
): string {
  const data = readFileSync(filePath);
  const hash = createHash(algorithm).update(data).digest("hex");
  return `${algorithm}:${hash}`;
}
