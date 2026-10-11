### Module: Markdown Static Site

This site is a flat-file static site. There is no framework and no server runtime.

- **Content is data.** Every page is a `content/*.md` file: YAML front matter (title,
  slug, hero fields, description) plus a Markdown body. `content/site.md` is special —
  it holds site-wide settings (nav, footer, contact) and is not rendered as a page.
- **`slug` decides the URL.** `slug: about` → `/about/`; `slug: ""` → `/`. A new page is
  a new `.md` file; nothing else to register.
- **SCM-safe content only.** Keep `content/*.md` compatible with the SCM editor: YAML
  front matter plus ordinary Markdown, without raw HTML or task lists. Quote YAML 1.1-like
  string values such as `on`, `off`, `yes`, and `no` so an editor cannot change their type.
- **Templates are plain JS.** `templates/layout.js` and `templates/page.js` own structure.
  Form modules add `templates/contact-form.js`; a page opts in with a `form:` mapping in
  front matter. Never put form HTML in Markdown.
- **Build:** `npm run build` (or `node build.js`) renders `content/` into `dist/` and copies `assets/` verbatim.
  `node --watch build.js` rebuilds on change. Serve `dist/` as static files. `dist/` is
  generated — never edit it and never commit it.
- SCM onboarding uses `contentDir=content`, `buildCommand=npm run build`, and
  `buildDir=dist`. SCM edits existing content; adding pages or assets remains a Git task.
- If you add a `kontakt` page via a forms module, it lines up with the `Contact` nav entry
  in `content/site.md`. If no forms module is installed, remove that nav entry or add your
  own `content/kontakt.md`.
- `build.js` uses CommonJS-compatible entry points for `marked` and `yaml`. Keep the
  front-matter parser on `yaml` rather than reintroducing legacy parsers with stale
  transitive dependencies.
