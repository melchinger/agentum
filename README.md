# Agentum

`agentum` ist ein zentrales Template- und Generator-Repository für neue Projekt-Repositories mit professionellen Agent-Instruktionen, Sicherheitsleitplanken und stack-spezifischen Skeletons.

## Ziele

- gemeinsame Governance und saubere Projektstruktur als Standard
- `AGENTS.md` als kanonische Agent-Datei
- Varianten für `node`, `react`, `nextjs`, `php`, `python`
- interaktive und skriptbare Initialisierung neuer Ziel-Repositories

## Repository-Struktur

- `docs/` Hintergrundwissen und Maintainer-Doku
- `templates/base/` gemeinsame Dateien und Basis-Instruktionen
- `variants/` stack-spezifische Overlays und Skeleton-Dateien
- `scripts/` CLI und Generatorlogik
- `tests/` Generator- und Integrationsprüfungen

## Nutzung

```bash
node scripts/init-repo.js list-variants
node scripts/init-repo.js new ../my-app --variant react --project-name my-app
node scripts/init-repo.js apply ../existing-repo --variant python --dry-run
node scripts/init-repo.js scan ../existing-repo
node scripts/init-repo.js retrofit-plan ../existing-repo
node scripts/init-repo.js retrofit-apply ../existing-repo
node scripts/init-repo.js refactor-plan ../existing-repo
node scripts/init-repo.js doctor ../my-app
```

## Dokumentation

- `docs/quick-reference.md` bietet kurze Copy/Paste-Beispiele für die tägliche Nutzung
- `docs/usage-guide.md` erklärt die praktische Anwendung Schritt für Schritt
- `docs/maintainer-guide.md` beschreibt Pflege, Struktur und Erweiterung des Toolkits
- `docs/best-practices.md` dokumentiert die konzeptionellen Hintergründe

## Wichtige Defaults

- `AGENTS.md` ist die führende Instruktionsdatei.
- JS/TS-Varianten verwenden standardmäßig `pnpm`.
- Neue Repositories bekommen Governance + Skeleton, keine voll ausgebaute Business-Anwendung.
- Bestehende Repositories laufen zuerst durch `scan` und `retrofit-plan`, bevor Änderungen angewendet werden.
