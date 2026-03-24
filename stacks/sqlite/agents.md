### Stack Module: SQLite
- Use SQLite only when the runtime assumptions fit single-node or low-concurrency workloads.
- Keep the persistence layer adapter-shaped so a later move to PostgreSQL or MariaDB does not force domain rewrites.
