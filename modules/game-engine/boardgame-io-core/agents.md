### Module: boardgame.io Core

- Das **`Game`-Objekt** (`src/game/game.ts`) ist die State-Machine: `setup` initialisiert `G`, `moves` transformieren `G`, `endIf` beendet das Spiel. Halte alle Regeln hier — der Client ist nur eine Ansicht.
- State ist zweigeteilt: **`G`** sind deine Spieldaten (du veränderst sie), **`ctx`** ist read-only Framework-Metadaten (Runde, aktiver Spieler). Beides muss JSON-serialisierbar bleiben.
- Moves bekommen `{ G, ctx, playerID, random, events }` als erstes Argument. Mutiere den **immer-Draft** von `G` direkt — niemals mutieren *und* zusätzlich zurückgeben. Gib `INVALID_MOVE` (aus `boardgame.io/core`) zurück, um einen Zug abzulehnen.
- **Determinismus ist Pflicht:** Zufall nur über `random.*` (Random-Plugin), Flow nur über `events.*` (Events-Plugin). `Math.random`/`Date.now` zerstören Sync, Replay und Tests — siehe `game-fairness-baseline`.
- **Geheimer State:** alles unter dem Schlüssel `secret` wird von `playerView: PlayerView.STRIP_SECRETS` aus Client-Payloads entfernt. Moves, die `secret` lesen, brauchen `client: false`.
- **Struktur skaliert** über `phases` (Spielabschnitte mit eigener Zugreihenfolge), `turn.stages` (Sub-Zustände pro Spieler) und `turn.minMoves`/`maxMoves`. Fang minimal an, führe Phasen erst ein, wenn die Regeln sie verlangen.
- **Testen** ist trivial, weil alles deterministisch ist: `Client({ game })` aus `boardgame.io/client` instanziiert das Spiel headless, `client.moves.*` spielt Züge, `client.getState()` liest `G`/`ctx`. Genau ein Konzept pro Test (`game-fairness-baseline` + `tdd-baseline`).
- Dieses Modul ist der **Stack-Anker**: es besitzt `package.json` und `tsconfig.json` für das gesamte board-game Projekt (boardgame.io plus React/Vite/tsx-Toolchain). Server-Transport/Lobby, React-UI und Bots kommen über die Module `boardgame-io-server`, `boardgame-io-react`, `boardgame-io-bot` dazu und teilen sich diese Dependencies — alle `boardgame.io/*`-Subpfade stecken im einen `boardgame.io`-Paket.
