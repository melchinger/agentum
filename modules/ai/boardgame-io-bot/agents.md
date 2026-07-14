### Module: boardgame.io Bots

- Bots brauchen `ai.enumerate`: eine Funktion, die für den aktuellen State **alle legalen Züge** als `{ move, args }` auflistet. Sie ist die einzige Stelle, die ein Bot über die Spielregeln weiß.
- Verdrahte `enumerate` ins `Game`-Objekt (Core), damit Bots und das Debug-Panel es finden:
  ```ts
  import { enumerate } from '../ai/enumerate';
  export const game: Game<GameState> = { /* ... */, ai: { enumerate } };
  ```
- `RandomBot` wählt gleichverteilt, `MCTSBot` sucht via Monte-Carlo-Tree-Search (beide aus `boardgame.io/ai`). MCTS ist nur so gut wie `enumerate` vollständig ist — fehlt ein legaler Zug, sieht der Bot ihn nie.
- Halte Bots **deterministisch** (gleicher Seed → gleicher Lauf), sonst sind Bot-Partien nicht reproduzierbar. `Simulate(...)` spielt einen Bot gegen sich selbst für Tests/Balancing.
- Bots laufen serverseitig (oder über `Local`), nie als vertrauenswürdige Client-Logik. `enumerate` muss mit dem **gefilterten** State eines Spielers funktionieren — ein Bot darf nicht über `playerView` hinaus sehen.
