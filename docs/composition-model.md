# Agentum Composition Model

Agentum now supports a second, more composable catalog alongside legacy variants.

## Building Blocks

- `profiles/` describe a product goal — what kind of thing is being built.
- `runtimes/` define the core language skeleton and own the root manifest.
- `modules/` add one technical capability each.
- `policies/` add cross-cutting repository defaults, merged into the generated `AGENTS.md`.

**What exists is not listed here.** See [catalog.md](catalog.md) for the current
contents, generated from the manifests, or ask the CLI (`list-profiles`,
`list-modules --runtime <rt>`, …). A hand-written list in prose goes stale on the next
commit; this one used to, which is why it is gone.

## Typical Commands

```bash
node scripts/init-repo.js list-profiles
node scripts/init-repo.js list-runtimes
node scripts/init-repo.js list-modules --runtime python
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python,playwright-pdf,single-container --with-ci
node scripts/init-repo.js explain-stack --profile desktop-app
```

## Example Generators

```bash
node scripts/init-repo.js new ../saas-app --profile saas-web-app --runtime python --project-name saas-app --modules htmx,mcp-python,playwright-pdf,single-container --policies mirror-instructions --with-ci
node scripts/init-repo.js new ../desktop-app --profile desktop-app --project-name desktop-app
node scripts/init-repo.js new ../desktop-svelte --profile desktop-app-svelte --project-name desktop-svelte
node scripts/init-repo.js new ../desktop-sveltekit --profile desktop-app-sveltekit --project-name desktop-sveltekit
node scripts/init-repo.js new ../browser-ext --profile browser-extension --project-name browser-ext
node scripts/init-repo.js new ../card-game --profile board-game --project-name card-game
node scripts/init-repo.js new ../coaching --profile realtime-session --project-name coaching
node scripts/init-repo.js new ../tours --profile rust-node-monorepo --project-name tours --modules ts-library,subscription-center-rust,subscription-center-sveltekit
```

## Multi-Runtime Profiles

A profile names either one `recommendedRuntime` or a `runtimes` array, never both.
With `runtimes`, every runtime contributes its own skeleton and manifest side by side
— `rust-node-monorepo` yields a `Cargo.toml` at the root next to a `package.json`, and
a module is accepted when it is compatible with *any* of the selected runtimes.

## subscriptionCenter / KanIDM Integration

The `subscription-center-*` modules make a generated app "SC-ready": it logs users
in via **KanIDM OIDC** (Authorization Code + PKCE, confidential client), authorizes
by **KanIDM group membership** (the `groups` claim), and exposes a **session-kill**
webhook (`POST /internal/session-kill`, bearer-secured) that
[subscriptionCenter](https://github.com/melchinger) calls to revoke a user's sessions
on subscription loss — the same contract WordPress's OpenID Role Mapper implements.
All variants share one env contract (`OPENID_*`, `SESSION_SECRET`, `SESSION_KILL_SECRET`)
and are additive: they ship auth source + `docs/subscription-center.md` and layer onto
the backend module named below. Mounting the auth router in your app stays a manual
step — which routes an app protects is a design decision, not a mechanical one.

| Module | Stack |
| --- | --- |
| `subscription-center-rust` | Axum service over the `axum` module (mirrors SC's own `adapter-idm/oidc.rs`) |
| `subscription-center-fastapi` | Python / FastAPI (over the `fastapi` module) |
| `subscription-center-node` | Node / Express (`openid-client`) |
| `subscription-center-sveltekit` | SvelteKit server layer (over the `sveltekit` module) |

```bash
node scripts/init-repo.js new ../my-api --runtime python --project-name my-api --modules fastapi,subscription-center-fastapi
node scripts/init-repo.js new ../my-web --runtime node --project-name my-web --modules sveltekit,subscription-center-sveltekit
node scripts/init-repo.js new ../my-svc --runtime rust --project-name my-svc --modules axum,subscription-center-rust
```

## Cargo Dependencies

Rust has no equivalent of the "one module owns the whole manifest" pattern the Node
modules use for `package.json`: an Axum service and the OIDC layer on top of it must
both contribute crates to the *same* `Cargo.toml`. Modules therefore declare crates as
data, and the generator merges them into the `[dependencies]` table the `rust` runtime
owns:

```json
"cargoDependencies": {
  "axum": "0.8",
  "sqlx": { "version": "0.8", "default-features": false, "features": ["postgres"] }
}
```

Two modules may request the same crate. Identical requirements collapse into one entry
with the union of their features; differing version requirements are a `validate-stack`
error rather than a surprise at build time. Never hand-edit a generated `Cargo.toml` —
regenerating drops the edit. Add the crate to the owning module instead.

## Design Notes

- Profiles can inject default modules and required policies.
- Modules declare compatibility, dependencies, conflicts, directories, files, commands, and environment defaults.
- Policies stay separate from modules so repository governance can evolve without pretending to be a framework choice.
- Legacy `variants/` remain supported while the new catalog matures.
