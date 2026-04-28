### Profile: Desktop App (SvelteKit)
- Design for local UX, offline resilience, and explicit privilege boundaries around OS integration.
- SvelteKit with adapter-static — fully prerendered at build time. No SSR, no server endpoints.
- Build output goes to `dist/`, which matches Tauri's default `frontendDist: "../dist"` in `src-tauri/tauri.conf.json`.
