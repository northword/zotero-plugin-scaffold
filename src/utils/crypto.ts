import * as crypto from "node:crypto";
import fs from "fs-extra";

export function generateHash(
  filePath: string,
  algorithm: "sha256" | "sha512" | string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

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
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash(algorithm).update(data).digest("hex");
  return `${algorithm}:${hash}`;
}
