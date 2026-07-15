## Module: SubscriptionCenter (SvelteKit)

Additive integration that makes the `sveltekit` app (under `apps/web/`)
SubscriptionCenter-ready: OIDC login via KanIDM, authorization by KanIDM group
membership, and a session-kill endpoint the subscriptionCenter service calls to
revoke sessions. This module ships only server-side auth source — it does not
own `package.json`, `svelte.config.js`, or `tsconfig.json`.

### 1. npm dependencies

Merged into `apps/web/package.json` by the generator from `npmDependencies` in
`module.json` — no manual step. Run an install afterwards.

- `openid-client` v5 — OIDC discovery, PKCE (S256), token exchange and full
  id_token validation (JWKS / ES256 / aud / iss / nonce). The v5 API is
  incompatible with v6; stay on v5.
- `jose` — HMAC-signs the short-lived state cookie and the session cookie with
  `SESSION_SECRET`.

Add new packages to `module.json`, not to the generated `apps/web/package.json`:
regenerating drops a hand-edit.

### 2. `hooks.server.ts` is picked up automatically

SvelteKit auto-loads `apps/web/src/hooks.server.ts`. Its `handle` reads the
signed session cookie and resolves the current user into `event.locals.user`
(`{ uid, groups } | null`). When `OPENID_ENABLED=false` it bypasses auth with a
dev user and logs a warning.

Gate routes on `event.locals.user`:

```ts
import { requireLogin, hasGroup } from "$lib/server/config";

export const load = ({ locals }) => {
  const user = requireLogin(locals);            // 401 if not logged in
  const isAdmin = hasGroup(locals, "admins");   // KanIDM group -> role
  return { user, isAdmin };
};
```

- Per-app login URL: `GET /auth/login`
- Logout: `POST /auth/logout`
- Session-kill webhook: `POST /internal/session-kill` (Bearer `SESSION_KILL_SECRET`)

The session store is in-memory (`$lib/server/session.ts`) — swap for Redis/KV
in production.

### 3. Setup checklist

See `docs/subscription-center.md` for the full German checklist: registering
this app in the subscriptionCenter admin (`/apps`), the OAuth2 confidential
client, the groups scope-map, the redirect URL, the session-kill webhook, and
the KanIDM-groups → roles access model. Fill the corresponding keys in `.env`.
