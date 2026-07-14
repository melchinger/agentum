## Module: SubscriptionCenter (Rust / Axum)

KanIDM-OIDC-Relying-Party (Authorization Code + PKCE, **Confidential Client**) für die
Anbindung an **subscriptionCenter**. Autorisierung erfolgt über KanIDM-Gruppen
(`groups`-Claim), nicht über eine lokale Tabelle. Siehe `docs/subscription-center.md`
für die Registrierung im SC-Admin.

Bereitgestellt unter `src/auth/`:
- `config.rs` — `OidcConfig::from_env()` (Dev-Bypass bei `OPENID_ENABLED=false`).
- `oidc.rs` — Discovery, Authorize-URL + PKCE, Token-Tausch, ID-Token-Validierung via JWKS (ES256, aud/iss/nonce).
- `session.rs` — In-Memory-Sessionstore mit uid-Index (`kill_uid` für Session-Kill).
- `router.rs` — Axum-Router: `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`, `POST /internal/session-kill`, plus `current_user` / `has_group`.

### Cargo-Dependencies ergänzen

Diese Crate ist additiv — trage die folgenden Abhängigkeiten in die `Cargo.toml`
des generierten Projekts ein:

```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
jsonwebtoken = "9"
sha2 = "0.10"
base64 = "0.22"
url = "2"
getrandom = "0.2"
tracing = "0.1"
```

### In `main.rs` einbinden

```rust
mod auth;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let config = auth::OidcConfig::from_env().expect("OIDC config");
    let state = auth::build(config).expect("auth state");

    let app = axum::Router::new()
        .merge(auth::router(state.clone()))
        // ... eigene Routen; mit auth::current_user(&state, &headers) absichern
        ;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
```

Das Session-Kill-Cookie ist `Secure` — hinter TLS betreiben (oder für lokale
HTTP-Tests `OPENID_ENABLED=false` nutzen). Der In-Memory-Sessionstore ist für den
Einstieg gedacht; für horizontale Skalierung gegen Redis/Postgres tauschen.
