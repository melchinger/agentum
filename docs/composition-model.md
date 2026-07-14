# Agentum Composition Model

Agentum now supports a second, more composable catalog alongside legacy variants.

## Building Blocks

- `profiles/` describe product goals such as `saas-web-app`, `mcp-service`, `desktop-app`, `desktop-app-svelte`, `desktop-app-sveltekit`, `browser-extension`, `board-game`, and `realtime-session`.
- `runtimes/` define the core language/runtime skeleton such as `python`, `node`, or `rust`.
- `modules/` add technical capabilities such as `fastapi`, `htmx`, `postgres`, `alembic`, `playwright-pdf`, `tauri`, `react`, `nextjs`, `svelte`, `sveltekit`, `sveltekit-static`, `chrome-mv3`, `boardgame-io-core`, `socketio-session`, or the `subscription-center-*` KanIDM/OIDC integrations.
- `policies/` add cross-cutting repository defaults such as `ci`, `mirror-instructions`, `security-baseline`, `game-fairness-baseline`, and `realtime-authority-baseline`.

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
```

## subscriptionCenter / KanIDM Integration

The `subscription-center-*` modules make a generated app "SC-ready": it logs users
in via **KanIDM OIDC** (Authorization Code + PKCE, confidential client), authorizes
by **KanIDM group membership** (the `groups` claim), and exposes a **session-kill**
webhook (`POST /internal/session-kill`, bearer-secured) that
[subscriptionCenter](https://github.com/melchinger) calls to revoke a user's sessions
on subscription loss — the same contract WordPress's OpenID Role Mapper implements.
All variants share one env contract (`OPENID_*`, `SESSION_SECRET`, `SESSION_KILL_SECRET`)
and are additive (they ship auth source + `docs/subscription-center.md`; the extra
runtime dependencies are documented in each module's `agents.md`).

| Module | Stack |
| --- | --- |
| `subscription-center-rust` | Axum service (mirrors SC's own `adapter-idm/oidc.rs`) |
| `subscription-center-fastapi` | Python / FastAPI (over the `fastapi` module) |
| `subscription-center-node` | Node / Express (`openid-client`) |
| `subscription-center-sveltekit` | SvelteKit server layer (over the `sveltekit` module) |

```bash
node scripts/init-repo.js new ../my-api --runtime python --project-name my-api --modules fastapi,subscription-center-fastapi
node scripts/init-repo.js new ../my-web --runtime node --project-name my-web --modules sveltekit,subscription-center-sveltekit
node scripts/init-repo.js new ../my-svc --runtime rust --project-name my-svc --modules subscription-center-rust
```

## Design Notes

- Profiles can inject default modules and required policies.
- Modules declare compatibility, dependencies, conflicts, directories, files, commands, and environment defaults.
- Policies stay separate from modules so repository governance can evolve without pretending to be a framework choice.
- Legacy `variants/` remain supported while the new catalog matures.
