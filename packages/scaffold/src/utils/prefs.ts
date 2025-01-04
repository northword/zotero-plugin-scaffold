import { readFile } from "node:fs/promises";
import { escapeRegExp, isNotNil } from "es-toolkit";
import { outputFile } from "fs-extra/esm";
import { logger } from "./log.js";
import { prefs as defaultPrefs } from "./zotero/preference.js";

export type Prefs = Record<string, string | number | boolean | undefined | null>;

export class PrefsManager {
  private namespace: "pref" | "user_pref";
  private regExp: RegExp;
  private prefs: Prefs;

  constructor(namespace: "pref" | "user_pref") {
    this.namespace = namespace;
    this.regExp = new RegExp(escapeRegExp(`/${namespace}\(['"](.*)["'],\s*(.*)\)/`));
    this.prefs = { ...defaultPrefs };
  }

  private parsePrefjs(content: string) {
    const PrefsLines = content.split("\n");
    PrefsLines.forEach((line: string) => {
      const found = line.match(this.regExp);
      if (found) {
        this.prefs[found[1]] = found[2];
      }
    });
  }

  public async read(path: string) {
    const content = await readFile(path, "utf-8");
    this.parsePrefjs(content);
  }

  private renderPrefjs() {
    return Object.entries(this.prefs).map(([key, value]) => {
      if (!isNotNil(value))
        return "";

      let cleanValue = "";
      if (typeof value === "boolean") {
        cleanValue = `${value}`;
      }
      else if (typeof value === "string") {
        cleanValue = `"${value.replace("\n", "\\n")}"`;
      }
      else {
        cleanValue = value.toString();
      }

      return `${this.namespace}("${key}", ${cleanValue});`;
    }).filter(c => !!c).join("\n");
  }

  public async write(path: string) {
    const content = this.renderPrefjs();
    await outputFile(path, content, "utf-8");
    logger.debug("The <profile>/prefs.js has been modified.");
  }

  setPref(key: string, value: any) {
    this.prefs[key] = value;
  };

  setPrefs(prefs: Prefs) {
    Object.entries(prefs).forEach(([key, value]) => {
      this.setPref(key, value);
    });
  }

  getPref(key: string) {
    return this.prefs[key] ?? undefined;
  }

  getPrefs() {
    return this.prefs;
  }
}
