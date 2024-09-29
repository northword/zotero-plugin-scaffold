/**
 * Patch web-ext's getValidatedManifest
 * @see https://github.com/mozilla/web-ext?tab=readme-ov-file#using-web-ext-in-nodejs-code
 * @see https://github.com/mozilla/web-ext/blob/master/src/util/manifest.js#L15
 */
export function getValidatedManifest(_sourceDir?: string) {
  return {
    manifest_version: 2,
    name: "zoterp-plugin-scaffold-fake-name",
    version: "0.0.0.0",
  };
}
