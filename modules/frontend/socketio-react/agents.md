### Module: Socket.IO React Client

- `connectSession(token)` (`src/client/socket.ts`) öffnet eine typisierte `socket.io-client`-Verbindung. Das **Token** kommt aus deinem Auth-/Session-Flow und kodiert den Sitz (coach/coachee) — der Client behauptet seine Rolle nie selbst.
- Die UI ist eine **reine Funktion des `state`-Events**: auf `state` setzen, aus `view.slots`/`view.phase` rendern. Kein lokaler Spielzustand, der vom Server abweichen könnte.
- Aktionen sind **Absichten**: `socket.emit('session:configure', …)` (Coach), `socket.emit('slot:reveal', …)` (Coachee). Was der Sitz darf, entscheidet der Server — die UI blendet nur entsprechend ein/aus.
- Optimistic Updates sind hier **unnötig**: Sessions sind latenz-tolerant. Ein Klick darf auf das `state`-Echo des Servers warten; das hält die UI trivial konsistent.
- Den **Almanach** (oder andere Coach-only Inhalte) holt der Coach-Client per ID aus einer separaten API — nicht über den Socket-State. So sieht der Coachee ihn nie.
- Eine Socket-Instanz pro Mount (in `useRef`/`useState` halten, im Cleanup `disconnect`). Nicht bei jedem Klick neu verbinden.
