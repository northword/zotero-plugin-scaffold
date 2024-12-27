import type { EnhanceAppContext } from "vitepress";
// .vitepress/theme/index.ts
import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import Theme from "vitepress/theme";

import "@shikijs/vitepress-twoslash/style.css";

export default {
  extends: Theme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(TwoslashFloatingVue);
  },
};
