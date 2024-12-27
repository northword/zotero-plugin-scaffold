import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Zotero Plugin Scaffold",
  description: "Delivering a Modern and Elegant Development Experience for Zotero Plugins.",
  base: "/zotero-plugin-scaffold/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
    ],

    sidebar: [
      { text: "Why", link: "/why" },
      { text: "Quick Start", link: "/quick-start" },
      { text: "Serve", link: "/serve" },
      { text: "Build", link: "/build" },
      { text: "Test", link: "/test" },
      { text: "Release", link: "/release" },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/northword/zotero-plugin-scaffold" },
    ],

    outline: "deep",
  },

  markdown: {
    codeTransformers: [
      transformerTwoslash(),
    ],
  },
});
