# Docs

The documentation is written in Markdown syntax, using VitePress as the SSG, Shiki as the syntax highlighter, and Twoslash to provide inline type hover inside code blocks.

You can execute the following command in the project root directory:

```bash
# development
pnpm docs:dev

# build
pnpm docs:build
```

Alternatively, you can run `pnpm dev` / `pnpm build` in the `docs` directory instead.

For syntax and configuration, see the following:

- [Markdown Syntax Reference](https://vitepress.dev/guide/markdown)
- [Twoslash Notation References](https://twoslash.netlify.app/refs/notations)
- [VitePress Config Reference](https://vitepress.dev/reference/site-config)

For code blocks, you can trigger Twoslash by adding `twoslash` after the Markdown block language, see [Explicit Use of Twoslash](https://shiki.style/packages/twoslash#explicit-trigger).
