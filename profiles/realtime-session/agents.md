## Profile: Realtime Session

- Für **zwei-Parteien-, echtzeit-, rollen-asymmetrische** Sessions (z. B. interaktives Karten-Coaching: Coach steuert Ziehphasen, Coachee deckt auf). Bewusst **ohne Game-Framework** — plain Socket.IO über eine server-autoritative State-Machine, volle Kontrolle, wenig Code.
- Die Wahrheit liegt im Server (`socketio-session`); der Client (`socketio-react`) ist eine reine Ansicht des `state`-Events. Verlagere niemals Entscheidungen (Ziehen, Validierung, Geheimhaltung) auf den Client — die Invarianten stehen in `realtime-authority-baseline` und sind verpflichtend.
- **Drei Schichten, nicht eine:** (1) der Live-Tisch hier; (2) ein normaler Content-/Admin-Layer für Decks, Almanach-Texte, Nutzer, Buchung, Historie (eigene DB/API); (3) Coach-only Inhalte (Almanach) per ID out-of-band geladen. Pack Schicht 2/3 nie in den synchronisierten State.
- Latenz-tolerant: keine Optimistic Updates nötig. Die UI wartet auf das Server-Echo und bleibt dadurch trivial konsistent.
- Persistenz nach Bedarf: In-Memory für die laufende Session, ein Store (Redis/DB) hinter derselben State-Machine für Restart-Festigkeit/Skalierung. Das `sqlite`/`postgres` Modul liefert die DB für Schicht 2.
