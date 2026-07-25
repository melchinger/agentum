### Module: PHPMailer Contact Endpoint

Self-hosted contact form. The static form (`content/kontakt.md`) posts to `mail/send.php`,
which sends mail over SMTP with PHPMailer. No third-party form service.

- **Requires a PHP host.** The static `dist/` is served as usual; `mail/` must be reachable
  as `/mail/` on a PHP-capable server (PHP 8.1+). If your host is static-only, use
  `static-mail-gateway` or `headless-wp-forms` instead.
- **Setup:** in `mail/`, run `composer install`, then copy `config.sample.inc.php` to
  `config.inc.php` and set `recipient`. Leave `smtp.host` empty to use the host's PHP
  `mail()` (works with no further setup), or fill in the `smtp` block for authenticated
  SMTP (better deliverability). `config.inc.php` and `vendor/` are git-ignored — credentials
  never enter the repo.
- **Deploy:** publish `dist/` to the web root and place `mail/` (with its `vendor/` and
  `config.inc.php`) at `/mail/` under the same origin, so the form's `action="/mail/send.php"`
  resolves.
- **Endpoint contract:** `send.php` validates input, honours the `website` honeypot, and
  answers JSON `{ ok, message }`. `assets/js/contact.js` submits over fetch and shows the
  thank-you block; the form also works as a plain POST without JavaScript.
- Do not weaken the CR/LF stripping or the honeypot check — both are anti-abuse measures.
