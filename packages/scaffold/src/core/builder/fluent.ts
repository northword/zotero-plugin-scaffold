import type { BaseNode, Message, MessageReference, Resource } from "@fluent/syntax";
import type { BuildConfig } from "../../types/config.js";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { parse, serialize, Transformer } from "@fluent/syntax";
import { move } from "fs-extra/esm";
import styleText from "node-style-text";
import { glob } from "tinyglobby";
import { logger } from "../../utils/logger.js";
import { toArray } from "../../utils/string.js";

export default async function buildLocale(
  dist: string,
  namespace: string,
  options: BuildConfig["fluent"],
) {
  const ignores = toArray(options.ignore);
  const localeNames = await getLocales(dist);
  const messageManager = new MessageManager(ignores);

  // Process FTL files and add messages to the manager
  await Promise.all(localeNames.map(async (locale) => {
    const ftlPaths = await glob(`${dist}/addon/locale/${locale}/**/*.ftl`);
    await Promise.all(ftlPaths.map(async (ftlPath) => {
      const originalContent = await readFile(ftlPath, "utf-8");
      const { messages, processedContent } = processFTLFile(originalContent, namespace, options.prefixFluentMessages);

      // Add FTL messages for the current locale
      messageManager.addMessages(locale, messages);

      if (options.prefixFluentMessages) {
        await writeFile(ftlPath, processedContent);
      }

      if (options.prefixLocaleFiles) {
        const newPath = `${dirname(ftlPath)}/${namespace}-${basename(ftlPath)}`;
        await move(ftlPath, newPath);
        logger.debug(`Renamed FTL: ${ftlPath} → ${newPath}`);
      }
    }));
  }));

  // Process HTML files and add messages to the manager
  const htmlPaths = await glob([`${dist}/addon/**/*.xhtml`, `${dist}/addon/**/*.html`]);
  await Promise.all(htmlPaths.map(async (htmlPath) => {
    const content = await readFile(htmlPath, "utf-8");
    const { processedContent, foundMessages } = processHTMLFile(
      content,
      namespace,
      messageManager.getFTLMessages(),
      ignores,
      htmlPath,
    );

    // Add all found HTML messages
    messageManager.addMessages("html", foundMessages);

    if (options.prefixFluentMessages) {
      await writeFile(htmlPath, processedContent);
    }
  }));

  // Validate that all HTML messages exist in all locales
  messageManager.validateMessages();
}

export class MessageManager {
  private ftlMessages: Map<string, Set<string>> = new Map();
  private htmlMessages: Set<string> = new Set();
  private ignores: string[];

  constructor(ignores: string[]) {
    this.ignores = ignores;
  }

  // Add a set of messages (FTL or HTML) for a specific locale or for HTML globally
  addMessages(target: string | "html", messages: string[]) {
    if (target === "html") {
      messages.forEach(msg => this.htmlMessages.add(msg));
    }
    else {
      let ftlLocaleMessages = this.ftlMessages.get(target);
      if (!ftlLocaleMessages) {
        ftlLocaleMessages = new Set();
        this.ftlMessages.set(target, ftlLocaleMessages);
      }
      messages.forEach(msg => ftlLocaleMessages.add(msg));
    }
  }

  // Validate that all HTML messages exist in all FTL locales
  validateMessages() {
    this.htmlMessages.forEach((msg) => {
      if (this.ignores.includes(msg))
        return;

      this.ftlMessages.forEach((messages, locale) => {
        if (!messages.has(msg)) {
          logger.warn(`Missing message: ${styleText.blue(msg)} in locale: ${locale}`);
        }
      });
    });
  }

  getFTLMessages(): Set<string> {
    const allMessages = new Set<string>();
    this.ftlMessages.forEach(messages => messages.forEach(msg => allMessages.add(msg)));
    return allMessages;
  }

  // Get all FTL messages for a specific locale
  getFTLMessagesByLocale(locale: string): Set<string> {
    return this.ftlMessages.get(locale) || new Set();
  }

  // Get all HTML messages
  getHTMLMessages(): Set<string> {
    return this.htmlMessages;
  }
}

// Step 1: Extract all locale folder names
async function getLocales(dist: string): Promise<string[]> {
  const localePaths = await glob(`${dist}/addon/locale/*`, { onlyDirectories: true });
  return localePaths.map(p => basename(p));
}

// Parse and optionally prefix messages in an FTL file
export function processFTLFile(
  content: string,
  namespace: string,
  shouldPrefix: boolean,
) {
  const messages = extractMessages(content);
  const processed = shouldPrefix ? transformFluent(content, namespace) : content;
  return { messages, processedContent: processed };
}

// Scan HTML content for l10n references and apply namespace prefix
export function processHTMLFile(
  content: string,
  namespace: string,
  allMessages: Set<string>,
  ignores: string[],
  filePath: string,
) {
  const foundMessages = new Set<string>();

  const L10N_PATTERN = new RegExp(`(data-l10n-id)="((?!${namespace})\\S*)"`, "g");
  const processed = content.replace(L10N_PATTERN, (match, attr, id) => {
    foundMessages.add(id);

    if (ignores.includes(id)) {
      logger.debug(`Skipped ignored ID: ${styleText.blue(id)} in ${styleText.gray(filePath)}`);
      return match;
    }

    if (!allMessages.has(id)) {
      logger.warn(`Missing FTL: ${styleText.blue(id)} in ${styleText.gray(filePath)}`);
      return match;
    }

    return `${attr}="${namespace}-${id}"`;
  });

  return { processedContent: processed, foundMessages: [...foundMessages] };
}

// Fluent parsing and serialization helpers
export function parseFluent(source: string): Resource {
  return parse(source, {});
}

export function extractMessages(source: string): string[] {
  return parseFluent(source)
    .body
    .filter(entry => entry.type === "Message")
    .map(message => message.id.name);
}

export function serializeFluent(resource: Resource): string {
  return serialize(resource, {});
}

// Prefix Fluent message IDs using a transformer
export function transformFluent(source: string, prefix: string | false): string {
  const resource = parseFluent(source);
  new FluentTransformer(prefix).genericVisit(resource);
  return serializeFluent(resource);
}

// Custom Fluent AST transformer to apply message ID prefix
class FluentTransformer extends Transformer {
  constructor(private readonly prefix: string | false) {
    super();
  }

  private needsPrefix(name: string): boolean {
    return !!this.prefix && !name.startsWith(this.prefix);
  }

  visitMessage(node: Message): BaseNode {
    if (this.needsPrefix(node.id.name)) {
      node.id.name = `${this.prefix}-${node.id.name}`;
    }
    return this.genericVisit(node);
  }

  visitMessageReference(node: MessageReference): BaseNode {
    if (this.needsPrefix(node.id.name)) {
      node.id.name = `${this.prefix}-${node.id.name}`;
    }
    return this.genericVisit(node);
  }
}
