### Module: Socket.IO Session Server

- Die Wahrheit lebt in einer **reinen State-Machine** (`src/server/session.ts`): `createSession`, `configure`, `reveal`, `close`, `viewFor`. Diese Funktionen kennen kein Socket — deshalb sind sie direkt mit Vitest testbar (`tests/session.test.ts`).
- `src/server/index.ts` ist nur **Transport**: Socket.IO-Räume pro Session, eine `io.use()`-Middleware löst das Token zu `{ sessionId, role }` auf, Handler rufen die State-Machine und broadcasten `viewFor`. Logik gehört nicht hierher dupliziert.
- **Server-Autorität ist nicht verhandelbar:** der Client schickt Absichten (`session:configure`, `slot:reveal`), nie Ergebnisse. Ziehen/Mischen passiert serverseitig mit `crypto.randomInt`. Siehe `realtime-authority-baseline`.
- **Eine** Geheimhaltungsregel: `viewFor` blendet `cardId` aus, solange `revealed === false`. Reststapel (`decks`) verlassen den Server nie. Beide Rollen sehen denselben View — die Asymmetrie (z. B. Almanach) ist **out-of-band** (separate API/DB per ID), nicht im State.
- **Reconnect** = bei `connection` den aktuellen `viewFor` senden. Mehr Resync braucht es nicht.
- Dieses Modul ist der **Stack-Anker**: es besitzt `package.json`/`tsconfig.json` für das ganze Projekt (Socket.IO + socket.io-client + React/Vite-Toolchain). Der `socketio-react`-Client liefert nur Quellcode und teilt sich diese Dependencies.
- In-Memory-`Map` ist der Default-Store. Für Restart-Festigkeit/Skalierung einen Redis/DB-Store hinter dieselbe State-Machine setzen — die Funktionen ändern sich dabei nicht.
