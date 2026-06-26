### Module: boardgame.io React Client

- `Client()` aus `boardgame.io/react` verdrahtet das `Game`-Objekt mit deiner **Board-Komponente** und dem Transport. Es gibt eine React-Komponente zurück, die du mit `playerID` mountest.
- Die Board-Komponente bekommt `{ G, ctx, moves, playerID, isActive }`. Rendere aus `G`/`ctx`, löse Aktionen über `moves.*` aus, und sperre die UI über `isActive`, wenn der Spieler nicht am Zug ist.
- Der Client ist **optimistisch**: er rechnet Züge lokal voraus, der Server überschreibt bei Abweichung. Niemals Regel- oder Gewinnentscheidungen hier treffen — die liegen in den Moves (Core).
- `playerID` bestimmt den Sitz; ohne `playerID` ist der Client ein **Spectator** (sieht nur den über `playerView` gefilterten State). Geheime Daten dürfen nie ungefiltert ankommen.
- Transport: `SocketIO({ server })` für den echten Server, `Local()` für Pass-and-play/Tests im Browser. Die Server-URL kommt aus `VITE_SERVER_URL`.
- Aktiviere das Debug-Panel nur in Dev (`debug: import.meta.env.DEV`). Es nutzt `ai.enumerate` (Bot-Modul) für den "play"-Button.
