### Module: Static-Site Mail Gateway

Contact form for static-only hosting (CDN, object storage, GitHub Pages). The form posts
JSON to a central mail-gateway service that turns it into email. No backend code and no PHP
ship in this repo. This mirrors the cardcoaching/landing lead flow.

- **Gateway contract:** `POST <endpoint>` with `Content-Type: application/json` and body
  `{ to, subject, body, fromName }`; success is HTTP 2xx with `{ "success": true }`. A
  same-origin `/mail/send` or a shared service both work.
- **Configure** the `data-action` (endpoint) and `data-to` (recipient) attributes on the
  form in `content/kontakt.md`. Credentials live in the gateway, never in this repo.
- **`assets/js/contact.js`** builds the message body from the fields, honours the `website`
  honeypot, and shows the thank-you block on success. This flow is JSON-only, so it needs
  JavaScript — if you must support no-JS, fall back to a `mailto:` link.
- **Privacy:** submissions leave the browser for the gateway service. Say so in the form
  hint and the privacy page; prefer an EU-hosted gateway if that matters.
- If your host runs PHP and you'd rather not depend on an external service, use
  `phpmailer-endpoint` instead.
