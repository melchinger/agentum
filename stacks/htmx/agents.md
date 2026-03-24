### Stack Module: HTMX
- Prefer server-rendered HTML and small declarative interactions over client-heavy state machines.
- Keep HTMX endpoints narrow and idempotent where possible, and always provide usable non-JavaScript fallbacks for core flows.
- Return partials intentionally; do not bury business rules inside HTML snippets.
