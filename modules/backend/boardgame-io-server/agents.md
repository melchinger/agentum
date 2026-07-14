### Module: boardgame.io Server

- Der `Server` (Koa + SocketIO, aus `boardgame.io/server`) ist der **autoritative Master**: er rechnet jeden Zug, hält den wahren State und broadcastet Updates. Clients sind nur optimistische Ansichten.
- `origins` ist eine **Whitelist** — in Produktion kein Wildcard. Sonst verbindet sich entweder niemand oder jeder. Lokale Entwicklung: `Origins.LOCALHOST`.
- **Storage wird aus der Umgebung gewählt** (`src/server/storage.ts`, via `createStorage()`): kein env → in-memory (verliert Matches beim Neustart, nur für Tests); `STORAGE_DIR` → `FlatFile` auf Platte (eingebaut, zero-dep, restart-fest); `DATABASE_URL` → Postgres über das optionale `bgio-postgres` (`npm i bgio-postgres`, spricht auch MySQL/SQLite). Sobald das `postgres`-Modul dabei ist, liefert es `DATABASE_URL` und der Server greift automatisch zu.
- Moves mit `client: false` (geheimer State) laufen **ausschließlich hier**. Der Server ist auch der Ort, an dem `playerView` greift, bevor State das Haus verlässt.
- `matchID` trennt parallele Partien; die Lobby-/Match-API (`/games`, `/games/:name/create`, `join`, `leave`) liefert Match-Credentials. Binde `playerID` server-seitig an diese Credentials, damit niemand für einen fremden Sitz zieht.
- Server-Logik gehört nicht in dieses Modul dupliziert: das Spiel kommt aus `src/game/game.ts` (Core). Der Server importiert es nur und stellt es bereit.
