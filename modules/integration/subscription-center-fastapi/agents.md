## Module: SubscriptionCenter (FastAPI)

Dieses additive Modul macht die generierte FastAPI-App "SC-ready": KanIDM-OIDC-Login,
Autorisierung ueber KanIDM-Gruppenmitgliedschaft und Session-Kill-Webhooks vom
subscriptionCenter-Dienst. Es besitzt **keinen** Stack-Anker (kein `pyproject.toml`) und
haengt sich in das bestehende `fastapi`-Modul ein.

### 1. Zusaetzliche Abhaengigkeiten

Fuege diese Eintraege in `pyproject.toml` unter `[project].dependencies` hinzu (das
`fastapi`-Modul besitzt `pyproject.toml`, dieses Modul editiert es bewusst nicht):

```toml
dependencies = [
    # ... bestehende Eintraege (fastapi, uvicorn, ...) ...
    "httpx>=0.27,<0.29",
    "pyjwt[crypto]>=2.9,<3.0",
    "itsdangerous>=2.2,<3.0",
]
```

- `httpx` — OIDC-Discovery und Token-Exchange
- `pyjwt[crypto]` — JWKS-Validierung des `id_token` (`jwt.PyJWKClient`, ES256)
- `itsdangerous` — signierte Session- und Flow-Cookies

### 2. Router einbinden

In `src/{{PYTHON_PACKAGE}}/interfaces/http/app.py` den Auth-Router registrieren:

```python
from fastapi import FastAPI

from {{PYTHON_PACKAGE}}.interfaces.http.auth import auth_router

app = FastAPI(title="{{PROJECT_NAME}}")
app.include_router(auth_router)
```

Geschuetzte Routen absichern:

```python
from fastapi import Depends

from {{PYTHON_PACKAGE}}.interfaces.http.auth import Principal, require_group, require_login

@app.get("/me")
async def me(user: Principal = Depends(require_login)) -> dict[str, object]:
    return {"uid": user.uid, "groups": sorted(user.groups)}

@app.get("/admin")
async def admin(user: Principal = Depends(require_group("app-admins"))) -> dict[str, str]:
    return {"status": "ok"}
```

### 3. Weitere Doku

Einrichtungscheckliste (App im subscriptionCenter registrieren, `.env` befuellen,
Zugriffsmodell): siehe `docs/subscription-center.md`.
