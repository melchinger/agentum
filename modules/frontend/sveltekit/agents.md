### Module: SvelteKit (adapter-node)
- Routes live in `apps/web/src/routes`. Use `+page.server.ts` for server-only data loading and `+server.ts` for API endpoints.
- Keep server code free of business logic — call into `apps/web/src/lib/server` services.
- Use Svelte stores only for UI state. Persistent state belongs to the runtime/backend.
- Variables intended for the browser must be prefixed `PUBLIC_` (SvelteKit env contract).
