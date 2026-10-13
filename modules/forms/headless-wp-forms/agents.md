### Module: Headless WordPress Forms (Fluent Forms proxy)

Contact form backed by a separate headless WordPress — the `melchinger/headless-wp-forms`
stack (Fluent Forms + `wp-fluent-forms-proxy`). The static form submits JSON to the proxy;
WordPress handles delivery, spam filtering and entry storage.

- **No WordPress in this repo.** `docs/headless-wp-forms.md` is the integration checklist
  (provision the stack, note the form ID and field keys, set `ALLOWED_ORIGINS`).
- **Endpoint:** `POST {WP_URL}/wp-json/wp-fluent-forms-proxy/v1/forms/{FORM_ID}/submit` with a
  JSON body of the field keys. Configure `form.endpoint` and `form.fields` in the YAML
  front matter of `content/kontakt.md`; `templates/contact-form.js` renders the form and
  `data-action`. Keep raw HTML out of SCM-managed Markdown. Field names must match the
  Fluent Form keys or the submission is rejected.
- **Never embed `PROXY_API_KEY` in client code.** The browser submit relies on the proxy's
  `ALLOWED_ORIGINS`. If your proxy requires the key, add a same-origin forwarder that injects
  it server-side and point `data-action` there (see the doc).
- Keep spam protection and rate limiting on the WordPress side — the endpoint is public.
- Treat every browser field as untrusted, including field names and consent values. Validate the
  allowed form ID and origin server-side, enforce the privacy field server-side, and never use
  GET for submissions because it exposes personal data in URLs.
