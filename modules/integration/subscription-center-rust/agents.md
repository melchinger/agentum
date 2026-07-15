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

### Cargo-Dependencies

Werden vom Generator aus `cargoDependencies` in `module.json` in die `Cargo.toml`
gemischt — kein manueller Schritt. Neue Crates dort eintragen, nicht in der
generierten `Cargo.toml`: ein erneutes Generieren würde die Handänderung verwerfen.

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
