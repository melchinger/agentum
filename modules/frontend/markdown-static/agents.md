### Module: Markdown Static Site

This site is a flat-file static site. There is no framework and no server runtime.

- **Content is data.** Every page is a `content/*.md` file: YAML front matter (title,
  slug, hero fields, description) plus a Markdown body. `content/site.md` is special —
  it holds site-wide settings (nav, footer, contact) and is not rendered as a page.
- **`slug` decides the URL.** `slug: about` → `/about/`; `slug: ""` → `/`. A new page is
  a new `.md` file; nothing else to register.
- **Templates are plain JS.** `templates/layout.js` (page shell) and `templates/page.js`
  (hero + body) are `require()`d by `build.js`. Keep them free of page content — content
  belongs in Markdown.
- **Raw HTML in a Markdown body is passed through.** That is how a contact form or an
  embed lands on a page. Do not add page-specific markup to the templates.
- **Build:** `node build.js` renders `content/` into `dist/` and copies `assets/` verbatim.
  `node --watch build.js` rebuilds on change. Serve `dist/` as static files. `dist/` is
  generated — never edit it and never commit it.
- If you add a `kontakt` page via a forms module, it lines up with the `Contact` nav entry
  in `content/site.md`. If no forms module is installed, remove that nav entry or add your
  own `content/kontakt.md`.
- Dependencies are pinned for CommonJS `require()` (`marked@^4`, `gray-matter`). If you
  switch `build.js` to ESM `import`, move to `marked@latest` and set `"type": "module"`.
