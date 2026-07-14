# Realtime Authority Baseline Policy

Für server-autoritative Echtzeit-Sessions (Socket.IO + State-Machine) **zwingend**. Diese fünf Punkte sind die Verantwortung, die du übernimmst, wenn du ohne Game-Framework arbeitest.

## 1. Rollen sind server-vertraut
* Die Rolle (z. B. coach/coachee) kommt aus einem **server-ausgestellten Token**, nie aus einem `role`-Feld im Client-Payload. Auflösung passiert in einer `io.use()`-Middleware, bevor irgendein Event greift.
* Ein Client, dessen Token keine gültige Rolle/Session ergibt, wird abgewiesen (`next(new Error(...))`).

## 2. Jedes Event wird validiert
* Pro Handler: **Rolle** prüfen (darf dieser Sitz das?), **Phase** prüfen (ist die Aktion jetzt erlaubt?), **Existenz/Idempotenz** prüfen (Slot vorhanden, nicht schon aufgedeckt).
* Der Client sendet **Absichten, nie Ergebnisse**. „Wie viele Karten" ja, „welche Karte" niemals.

## 3. Zufall passiert serverseitig
* Mischen/Ziehen läuft auf dem Server mit `crypto.randomInt` (Fisher–Yates), nicht `Math.random`. Reststapel verlassen den Server nie.

## 4. Geheimnis ist eine einzige Regel — und Content bleibt out-of-band
* Die einzige Geheimhaltung im State: verdeckte Werte (z. B. `cardId`) erst bei `revealed` ausliefern. Das ist die `viewFor`-Projektion.
* Große/asymmetrische Inhalte (Almanach-Texte, Deck-Verwaltung) gehören **nicht** in den synchronisierten State, sondern in eine separate DB/API, abgefragt per ID. Damit ist „Coachee sieht den Almanach nicht" trivial gelöst.

## 5. Reconnect & Persistenz
* Bei `connection` den aktuellen `viewFor`-State senden — das ist das gesamte Resync. Socket.IO macht den Transport-Reconnect, du das State-Resync.
* In-Memory reicht für eine laufende Session. Für Restart-Festigkeit/horizontale Skalierung einen Store (Redis/DB) hinter dieselbe State-Machine setzen.
