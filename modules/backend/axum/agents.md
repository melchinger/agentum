### Module: Axum (Rust)

HTTP delivery layer for Rust services, backed by PostgreSQL through SQLx.

- `src/main.rs` — process entrypoint: tracing, config from env, pool, listener.
- `src/state.rs` — `AppState` with the `PgPool`. Clone it freely; the pool is an `Arc`.
- `src/http/` — router and handlers. `GET /health` doubles as a readiness probe.

Rules:

- Keep handlers thin. Parse and validate the request, delegate to a domain function,
  map the result back to a response. Business rules do not live in `src/http/`.
- Never put a `PgPool` behind a `Mutex`; it already pools internally.
- Prefer `sqlx::query` over the `query!` macro unless the build environment is
  guaranteed a reachable database or a checked-in `.sqlx/` offline cache.
- Return `503` from readiness checks when a dependency is down. Do not report `ok`
  for a process that cannot serve traffic.
- This module owns the `[dependencies]` contributions for the HTTP and database
  stack. Add crates via `cargoDependencies` in `module.json`, not by hand-editing the
  generated `Cargo.toml` — a regenerate would silently drop the edit.
