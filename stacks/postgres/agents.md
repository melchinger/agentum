### Stack Module: Postgres
- Treat PostgreSQL as the production source of truth and design persistence around concurrent writes, migrations, and explicit transactions.
- Keep SQL and repository code in infrastructure boundaries; domain and delivery code should not depend on connection details.
