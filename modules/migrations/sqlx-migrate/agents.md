### Module: SQLx Migrations (Rust)

Versioned SQL migrations under `migrations/`, applied with the `sqlx` CLI.

Rules:

- Migrations are append-only and checksummed. Editing an already-applied migration
  makes `sqlx migrate run` fail for everyone who has run it. Reverse it with a new
  migration instead.
- Schema changes and the code that depends on them ship in the same change, in the
  order that keeps the deployed version working: add the column, deploy the reader,
  then backfill, then drop the old one.
- Do not reach for the `query!` macros unless the build has a reachable database or a
  checked-in `.sqlx/` offline cache. `cargo check` must work without a live database.
