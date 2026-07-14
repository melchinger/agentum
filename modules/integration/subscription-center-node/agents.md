## Module: SubscriptionCenter (Node)

Additives Integrationsmodul: macht ein Express-Backend SC-ready (OIDC-Login
via KanIDM, Autorisierung ueber KanIDM-Gruppen, Session-Kill-Webhook). Es
liefert nur Auth-Quellcode unter `src/auth/` und `docs/subscription-center.md`
- **keine** `package.json`/`tsconfig.json`. Der Auth-Quellcode ist ESM,
strict TypeScript und liest alle Geheimnisse aus `process.env`.

### npm-Abhaengigkeiten hinzufuegen

Dieses Modul bringt keine Manifeste mit. Ergaenze die Dependencies im
`package.json` des generierten Projekts (Versionen als sinnvolle Untergrenze):

```
{{PACKAGE_MANAGER}} add openid-client@^5.6.5 express@^4.19.2 express-session@^1.18.0
{{PACKAGE_MANAGER}} add -D @types/express@^4.17.21 @types/express-session@^1.18.0 @types/node@^22.0.0
```

- `openid-client` (v5) - Discovery, PKCE, Token-/id_token-Validierung
  (JWKS, ES256, aud, iss, nonce). Die v5-API (`Issuer.discover`,
  `client.authorizationUrl`, `client.callbackParams`, `client.callback`)
  ist API-inkompatibel zu v6 - bei v5 bleiben.
- `express` / `express-session` - HTTP-Router und Session-Handling.

### Einbinden in die App

`express-session` VOR dem Router registrieren (der Router liest/schreibt die
Session):

```ts
import session from "express-session";
import { sessionOptions, subscriptionCenterRouter } from "./auth/index.js";

app.use(session(sessionOptions));      // In-Memory-Store (Dev); Prod: Redis/connect-redis
app.use(subscriptionCenterRouter);     // mountet /auth/* und /internal/session-kill
```

Routen schuetzen mit den exportierten Middlewares:

```ts
import { requireLogin, requireGroup } from "./auth/index.js";

app.get("/me", requireLogin, handler);
app.get("/admin", requireGroup("admins"), handler);
```

Bei `OPENID_ENABLED=false` umgeht die Auth den Flow (Warnung im Log) - nur
fuer lokale Entwicklung.

### Weiteres

- Der Session-Kill-Endpunkt (`POST /internal/session-kill`, Bearer =
  `SESSION_KILL_SECRET`) spiegelt das WordPress-Pendant
  `POST /wp-json/openid-role-mapper/v1/session-kill`.
- Registrierungs-Checkliste (subscriptionCenter `/apps`), `.env`-Werte und
  das Zugriffsmodell (KanIDM-Gruppen -> Rollen): siehe
  `docs/subscription-center.md`.
