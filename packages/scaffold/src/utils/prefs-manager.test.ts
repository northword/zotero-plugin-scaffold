import { beforeEach, describe, expect, it } from "vitest";
import { PrefsManager } from "./prefs-manager.js";

describe("prefs-manager", () => {
  let prefsManager: PrefsManager;

  beforeEach(() => {
    prefsManager = new PrefsManager("pref");
  });

  describe("parse", () => {
    it("should correctly parse a prefs.js file", async () => {
      const fakePrefsContent = `
pref("test.string", "hello");
pref("test.number", 42);
pref("test.boolean.true", true);
pref("test.boolean.false", false);
pref("test.null", null);
pref("test.stringified.number", "123");
pref("test.stringified.true", "true");
          `;

      const result = prefsManager.parse(fakePrefsContent);

      expect(result["test.string"]).toBe("hello");
      expect(result["test.number"]).toBe(42);
      expect(result["test.boolean.true"]).toBe(true);
      expect(result["test.boolean.false"]).toBe(false);
      expect(result["test.null"]).toBe("null");
      expect(result["test.stringified.number"]).toBe("123");
      expect(result["test.stringified.true"]).toBe("true");
    });
  });

  describe("setPref", () => {
    it("should correctly set a string value", () => {
      prefsManager.setPref("test.string", "hello");
      expect(typeof prefsManager.getPref("test.string")).toBe("string");
      expect(prefsManager.getPref("test.string")).toBe("hello");
    });

    it("should correctly set a number value", () => {
      prefsManager.setPref("test.number", 42);
      expect(typeof prefsManager.getPref("test.number")).toBe("number");
      expect(prefsManager.getPref("test.number")).toBe(42);
    });

    it("should correctly set a number value 0", () => {
      prefsManager.setPref("test.number", 0);
      expect(typeof prefsManager.getPref("test.number")).toBe("number");
      expect(prefsManager.getPref("test.number")).toBe(0);
    });

    it("should correctly set a boolean value", () => {
      prefsManager.setPref("test.boolean", true);
      expect(typeof prefsManager.getPref("test.boolean")).toBe("boolean");
      expect(prefsManager.getPref("test.boolean")).toBe(true);
    });

    it("should correctly set a null value and remove the preference", () => {
      prefsManager.setPref("test.null", "value");
      prefsManager.setPref("test.null", null);
      expect(prefsManager.getPref("test.null")).toBeUndefined();
    });

    it("should handle stringified numbers and booleans", () => {
      prefsManager.setPref("test.string.number", "123");
      expect(typeof prefsManager.getPref("test.string.number")).toBe("string");
      expect(prefsManager.getPref("test.string.number")).toBe("123");

      prefsManager.setPref("test.number", "\"123\"");
      expect(typeof prefsManager.getPref("test.number")).toBe("string");
      expect(prefsManager.getPref("test.number")).toBe("\"123\"");

      prefsManager.setPref("test.string.true", "true");
      expect(typeof prefsManager.getPref("test.string.true")).toBe("string");
      expect(prefsManager.getPref("test.string.true")).toBe("true");

      prefsManager.setPref("test.string.false", "false");
      expect(typeof prefsManager.getPref("test.string.false")).toBe("string");
      expect(prefsManager.getPref("test.string.false")).toBe("false");
    });
  });

  describe("setPrefs", () => {
    it("should correctly set multiple preferences", () => {
      prefsManager.setPrefs({
        "test.string": "hello",
        "test.number": 42,
        "test.boolean": true,
      });

      expect(prefsManager.getPref("test.string")).toBe("hello");
      expect(prefsManager.getPref("test.number")).toBe(42);
      expect(prefsManager.getPref("test.boolean")).toBe(true);
    });
  });

  describe("getPrefs", () => {
    it("should return all preferences", () => {
      prefsManager.setPrefs({
        "test.string": "hello",
        "test.number": 42,
      });

      const prefs = prefsManager.getPrefs();
      expect(prefs).toEqual({
        "test.string": "hello",
        "test.number": 42,
      });
    });
  });

  describe("clearPrefs", () => {
    it("should clear all preferences", () => {
      prefsManager.setPrefs({
        "test.string": "hello",
        "test.number": 42,
      });

      prefsManager.clearPrefs();
      expect(prefsManager.getPrefs()).toEqual({});
    });
  });

  describe("getPrefsWithPrefix", () => {
    it("should return preferences with the specified prefix", () => {
      prefsManager.setPrefs({
        "prefix.key1": "value1",
        "prefix.key2": "value2",
        "other.key": "value3",
      });

      const prefs = prefsManager.getPrefsWithPrefix("prefix");
      expect(prefs).toEqual({
        "prefix.key1": "value1",
        "prefix.key2": "value2",
        "prefix.other.key": "value3",
      });
    });
  });

  describe("getPrefsWithoutPrefix", () => {
    it("should return preferences without the specified prefix", () => {
      prefsManager.setPrefs({
        "prefix.key1": "value1",
        "prefix.key2": "value2",
      });

      const prefs = prefsManager.getPrefsWithoutPrefix("prefix");
      expect(prefs).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });
  });
});
