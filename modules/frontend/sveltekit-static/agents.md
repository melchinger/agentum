### Module: SvelteKit (adapter-static)
- All routes are prerendered. Do not import from `$app/server`, `$env/static/private`, or write `+server.ts` endpoints.
- Use `$lib/services` to call the runtime — for Tauri this means `@tauri-apps/api` invoke wrappers, for plain CDN this means `fetch` against a separate API.
- Set `prerender = true` in the root `+layout.ts` and keep all dynamic routes inside `entries()` exports.
- The build output goes to `dist/` (root) so it pairs cleanly with the default Tauri `frontendDist: "../dist"`.
