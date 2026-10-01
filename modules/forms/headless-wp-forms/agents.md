### Module: Headless WordPress Forms (Fluent Forms proxy)

Contact form backed by a separate headless WordPress — the `melchinger/headless-wp-forms`
stack (Fluent Forms + `wp-fluent-forms-proxy`). The static form submits JSON to the proxy;
WordPress handles delivery, spam filtering and entry storage.

- **No WordPress in this repo.** `docs/headless-wp-forms.md` is the integration checklist
  (provision the stack, note the form ID and field keys, set `ALLOWED_ORIGINS`).
- **Endpoint:** `POST {WP_URL}/wp-json/wp-fluent-forms-proxy/v1/forms/{FORM_ID}/submit` with a
  JSON body of the field keys. Configure it in the form's `data-action` in
  `content/kontakt.md`; align the input `name` attributes with the Fluent Form field keys or
  the submission is rejected.
- **Never embed `PROXY_API_KEY` in client code.** The browser submit relies on the proxy's
  `ALLOWED_ORIGINS`. If your proxy requires the key, add a same-origin forwarder that injects
  it server-side and point `data-action` there (see the doc).
- Keep spam protection and rate limiting on the WordPress side — the endpoint is public.
