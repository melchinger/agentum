## Profile: Board Game

- Ziel ist ein **server-autoritatives, rundenbasiertes Multiplayer-Spiel** auf boardgame.io. Die Spielregeln sind das Produkt — sie leben in einem deterministischen `Game`-Objekt, nicht in der UI.
- Baue **engine-first**: Erst die Regeln als testbare Bibliothek (`boardgame-io-core`), dann Transport/Lobby (`boardgame-io-server`), dann UI (`boardgame-io-react`), zuletzt Bots (`boardgame-io-bot`). Jede Schicht ist über `Client({ game })` headless testbar.
- Behandle den Client als **nicht vertrauenswürdig**. Validierung, Zufall und geheimer State gehören auf den Server — die Regeln dazu stehen in `game-fairness-baseline` und sind verpflichtend.
- Halte `G`/`ctx` JSON-serialisierbar und Moves deterministisch (Random-/Events-Plugin), damit Replays, Tests und Server/Client-Sync stabil bleiben.
- Für den Betrieb: persistentes Storage statt In-Memory, `origins` whitelisten, und für eine Single-Image-Auslieferung von Server + gebautem Frontend passt das `single-container-fullstack` Deploy-Modul.
