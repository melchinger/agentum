# Agentum Composition Model

Agentum now supports a second, more composable catalog alongside legacy variants.

## Building Blocks

- `profiles/` describe product goals such as `saas-web-app`, `mcp-service`, `desktop-app`, `desktop-app-svelte`, `desktop-app-sveltekit`, `browser-extension`, `board-game`, and `realtime-session`.
- `runtimes/` define the core language/runtime skeleton such as `python`, `node`, or `rust`.
- `modules/` add technical capabilities such as `fastapi`, `htmx`, `postgres`, `alembic`, `playwright-pdf`, `tauri`, `react`, `nextjs`, `svelte`, `sveltekit`, `sveltekit-static`, `chrome-mv3`, `boardgame-io-core`, or `socketio-session`.
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

## Design Notes

- Profiles can inject default modules and required policies.
- Modules declare compatibility, dependencies, conflicts, directories, files, commands, and environment defaults.
- Policies stay separate from modules so repository governance can evolve without pretending to be a framework choice.
- Legacy `variants/` remain supported while the new catalog matures.
