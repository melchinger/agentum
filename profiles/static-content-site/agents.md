## Profile: Static Content Site

A flat-file website whose content is edited as Markdown. `content/*.md` (front matter +
Markdown) builds to static HTML in `dist/` via `node build.js` — no framework, no runtime
server for the pages themselves. Deploy `dist/` as static files.

- **Content is the interface.** Non-developers edit `content/*.md` and `assets/`. Keep the
  JS templates in `templates/` structural; never move page copy into them.
- **Contact/mail is a pluggable strategy** (exactly one, they are mutually exclusive):
  - `static-mail-gateway` — form posts to an external service (Formspree/Web3Forms/Basin/
    self-hosted). Works on static-only hosts. Submissions reach a third party — note it in
    the privacy page.
  - `phpmailer-endpoint` — self-hosted PHP + SMTP under `/mail/`. Needs a PHP host; no third
    party. Credentials live in `mail/config.inc.php` (git-ignored).
  - `headless-wp-forms` — submits to a WordPress Contact Form 7 REST endpoint. Use when a
    WordPress already exists.
- **If you pick no forms module**, replace the `Contact` nav entry in `content/site.md`
  with a `mailto:` link, or add your own `content/kontakt.md`, so it does not 404.
- Privacy matters here: external form gateways, embedded booking widgets and web fonts are
  all third-party data flows. Gate them and document them in the privacy page.
