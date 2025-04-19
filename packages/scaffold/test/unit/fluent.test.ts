import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MessageManager,
  processFTLFile,
  processHTMLFile,
  transformFluent,
} from "../../src/core/builder/fluent.js";
import { logger } from "../../src/utils/logger.js";

vi.mock("../../src/utils/logger.js");

describe("transformFluent()", () => {
  const input = `
welcome = Welcome
about = About { welcome }
`;

  it("should correctly transform message IDs", () => {
    const result = transformFluent(input, "test");
    expect(result).toMatch(/test-welcome = Welcome/);
    expect(result).toMatch(/test-about = About \{ test-welcome \}/);
  });
});

describe("processFTLFile()", () => {
  it("should keep content unchanged when prefixing is disabled", () => {
    const input = "message = Hello";
    const { messages, processedContent } = processFTLFile(input, "test", false);

    expect(messages).toEqual(["message"]);
    expect(processedContent).toBe(input);
  });

  it("should handle empty content correctly", () => {
    const { messages, processedContent } = processFTLFile("", "test", true);

    expect(messages).toEqual([]);
    expect(processedContent).toBe("");
  });
});

describe("processHTMLFile", () => {
  const namespace = "myNamespace";
  const ignores = ["ignoredMessage"];
  const allMessages = new Set(["validMessage1", "validMessage2"]);
  const filePath = "path/to/file.html";

  it("should replace data-l10n-id with namespace-prefixed ID", () => {
    const inputContent = `<div data-l10n-id="validMessage1"></div>`;

    const { processedContent, foundMessages } = processHTMLFile(inputContent, namespace, allMessages, ignores, filePath);

    expect(processedContent).toBe("<div data-l10n-id=\"myNamespace-validMessage1\"></div>");
    expect(foundMessages.includes("validMessage1")).toBe(true);
  });

  it("should skip ignored IDs", () => {
    const inputContent = `<div data-l10n-id="ignoredMessage"></div>`;
    const { processedContent, foundMessages } = processHTMLFile(inputContent, namespace, allMessages, ignores, filePath);

    expect(processedContent).toBe("<div data-l10n-id=\"ignoredMessage\"></div>");
    expect(foundMessages.includes("ignoredMessage")).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Skipped ignored ID:"));
  });

  it("should warn when an FTL message is missing", () => {
    const inputContent = `<div data-l10n-id="missingMessage"></div>`;

    const { processedContent, foundMessages } = processHTMLFile(inputContent, namespace, allMessages, ignores, filePath);

    expect(processedContent).toBe("<div data-l10n-id=\"missingMessage\"></div>");
    expect(foundMessages.includes("missingMessage")).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Missing FTL:"));
  });

  it("should not modify the content if no matching messages are found", () => {
    const inputContent = `<div data-l10n-id="validMessage3"></div>`;
    const { processedContent, foundMessages } = processHTMLFile(inputContent, namespace, allMessages, ignores, filePath);

    expect(processedContent).toBe("<div data-l10n-id=\"validMessage3\"></div>"); // No replacement
    expect(foundMessages.includes("validMessage3")).toBe(true); // No message found
  });
});

describe("message-manager", () => {
  let messageManager: MessageManager;
  const ignores = ["ignore"];

  beforeEach(() => {
    messageManager = new MessageManager(ignores);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should add FTL messages for a specific locale", () => {
    const locale = "en";
    const messages = ["welcome", "goodbye"];

    messageManager.addMessages(locale, messages);

    const ftlMessages = messageManager.getFTLMessagesByLocale(locale);

    expect(ftlMessages.has("welcome")).toBe(true);
    expect(ftlMessages.has("goodbye")).toBe(true);
  });

  it("should add HTML messages", () => {
    const messages = ["about", "contact"];

    messageManager.addMessages("html", messages);

    const htmlMessages = messageManager.getHTMLMessages();

    expect(htmlMessages.has("about")).toBe(true);
    expect(htmlMessages.has("contact")).toBe(true);
  });

  it("should validate missing HTML messages in FTL locales", () => {
    messageManager.addMessages("en", ["welcome", "goodbye"]);
    messageManager.addMessages("fr", ["welcome"]);
    messageManager.addMessages("html", ["welcome", "goodbye"]);

    messageManager.validateMessages();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Missing message: .*goodbye.* in locale: fr/),
    );
  });

  it("should not trigger a warning when HTML messages are present in all FTL locales", () => {
    messageManager.addMessages("en", ["welcome", "about"]);
    messageManager.addMessages("fr", ["welcome", "about"]);
    messageManager.addMessages("html", ["about", "welcome"]);

    messageManager.validateMessages();

    // No warnings should be logged for "about" and "welcome"
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should return all FTL messages", () => {
    messageManager.addMessages("en", ["welcome", "about"]);
    messageManager.addMessages("fr", ["welcome"]);

    const allMessages = messageManager.getFTLMessages();

    expect(allMessages).toEqual(new Set(["welcome", "about"]));
  });

  it("should return an empty set when no FTL messages exist for a locale", () => {
    messageManager.addMessages("en", ["welcome", "about"]);

    const frMessages = messageManager.getFTLMessagesByLocale("fr");

    expect(frMessages.size).toBe(0);
  });

  it("should return empty HTML messages if none have been added", () => {
    const htmlMessages = messageManager.getHTMLMessages();

    expect(htmlMessages.size).toBe(0);
  });
});
