### WordPress Plugin Overlay
- Keep WordPress bootstrap, hooks, and integration glue in `includes/` only.
- Move business rules into `src/Domain`, use-case orchestration into `src/Application`, and WordPress/options/http/logging concerns into `src/Infrastructure`.
- Do not keep plugin bootstrap, remote API calls, settings access, and domain decisions in the same class long-term.
- Treat adapter classes under `includes/` as thin entrypoints that delegate to application services.
