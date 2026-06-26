# Game Fairness Baseline Policy

Diese Regeln sind für rundenbasierte Multiplayer-Spiele (boardgame.io) **zwingend**. Sie verhindern Cheating und nicht-reproduzierbare Spielzustände.

## 1. Der Server ist die einzige Wahrheit
* Jede Regel- und Gewinnlogik lebt in `moves` / `endIf` und läuft auf dem Master. Der Client ist **optimistisch** und manipulierbar.
* Niemals eine Aktion nur clientseitig validieren. Ungültige Züge mit `INVALID_MOVE` ablehnen, nicht still ignorieren.
* Setze `turn.minMoves` / `turn.maxMoves` und die Zugreihenfolge explizit, statt dich auf UI-Disziplin zu verlassen.

## 2. Geheime Information bleibt geheim
* Verdeckte Daten (Hand, Deck, verdeckte Rollen) **nur** über `playerView` filtern — z. B. `PlayerView.STRIP_SECRETS` mit Schlüsselnamen `secret`.
* UI-Verstecken reicht nicht: ungefilterter State landet im Netzwerk-Paket und ist auslesbar.
* Moves, die geheimen State lesen oder erzeugen, mit `client: false` markieren, damit sie ausschließlich serverseitig laufen.

## 3. Determinismus
* Kein `Math.random()` und kein `Date.now()` in Moves. Beides bricht Server/Client-Sync, Replays und Tests.
* Zufall ausschließlich über das **Random-Plugin** (`random.Shuffle`, `random.D6`, …), Zeit/Flow über das **Events-Plugin** (`events.endTurn`, `events.setPhase`).
* `G` und `ctx` müssen JSON-serialisierbar bleiben (keine Klassen, Functions, `Map`/`Set`, `undefined`-Löcher).

## 4. Betrieb & Härtung
* `origins` am Server whitelisten (kein Wildcard in Produktion), sonst verbinden Sockets nicht — oder jeder verbindet.
* Produktiv ein persistentes Storage (FlatFile/Postgres) statt des In-Memory-Defaults; sonst gehen alle Matches beim Neustart verloren.
* Authentifiziere `playerID`-Bindung server-seitig (Match-Credentials), damit niemand für einen fremden Spieler zieht.
