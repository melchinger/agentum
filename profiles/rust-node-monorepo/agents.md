## Profile: Rust + Node Monorepo

A Rust/Axum backend and a Node frontend workspace in one repository, sharing one
PostgreSQL database.

Layout:

- `src/`, `Cargo.toml` — the Axum service. The repository root is the Cargo package.
- `apps/web/` — the frontend application, with its own `package.json`.
- `packages/` — shared TypeScript libraries with their own release cycle.
- `migrations/` — SQL migrations, owned by the backend.

Rules:

- The database schema has exactly one owner: the backend. The frontend reaches it
  through the API, never through its own connection.
- Types crossing the wire are defined once. Generate or hand-maintain them in a
  `packages/` library rather than declaring them twice on both sides.
- Backend and frontend must be buildable independently. A frontend change must not
  require `cargo build` to pass, and the reverse.
- Authorization decisions belong to the backend. The frontend may hide a control the
  user cannot use, but hiding is not enforcing.
- Rust crates are declared through each module's `cargoDependencies`; npm packages in
  the relevant workspace `package.json`. Do not hand-edit a generated `Cargo.toml`.
