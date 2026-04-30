# Agentum

`agentum` hilft dir, neue Repositories sauber aufzusetzen oder bestehende Projekte sicher nachzurüsten.

Es ist gemacht für Teams und Einzelentwickler, die bereits schnell prototypisiert haben und jetzt Ordnung, Sicherheit und nachvollziehbare Regeln brauchen.

## Was das Tool macht

- erzeugt neue Projektstrukturen mit klaren Standards
- erstellt oder ergänzt `AGENTS.md` als zentrale Agent-Anweisung
- analysiert bestehende Repositories, bevor Änderungen geschrieben werden
- trennt sichere Auto-Änderungen von manueller Prüfung
- erstellt einen priorisierten Refactoring-Plan statt blind umzubauen
- validiert und erklärt bewusst zusammengesetzte Techstacks

## Zwei Wege

Agentum unterstützt derzeit zwei Modelle:

- `variants/` für das bisherige Variant- und Retrofit-System
- `profiles/runtimes/modules/policies` für das neue Kompositionsmodell

Faustregel:

- Nutze `variants`, wenn du ein klassisches Skeleton oder einen konservativen Retrofit-Flow willst.
- Nutze das Kompositionsmodell, wenn du einen Stack bewusst zusammenstellen und vorab prüfen willst.

## Schnellstart

```bash
node scripts/init-repo.js list-variants
node scripts/init-repo.js list-profiles
node scripts/init-repo.js list-runtimes
node scripts/init-repo.js list-modules --runtime python
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python,playwright-pdf,single-container --with-ci
node scripts/init-repo.js wizard ../myApp
```

Legacy-Repo erzeugen:

```bash
node scripts/init-repo.js new ../my-app --variant react --project-name my-app --with-ci
```

Komponiertes Repo erzeugen:

```bash
node scripts/init-repo.js new ../saas-app --profile saas-web-app --runtime python --project-name saas-app --modules htmx,mcp-python,playwright-pdf,single-container --policies mirror-instructions --with-ci
node scripts/init-repo.js new ../desktop-app --profile desktop-app --project-name desktop-app
```

Bestehendes Repo nachrüsten:

```bash
node scripts/init-repo.js scan ../existing-repo
node scripts/init-repo.js retrofit-plan ../existing-repo
node scripts/init-repo.js retrofit-apply ../existing-repo
node scripts/init-repo.js doctor ../existing-repo
```

## Legacy Varianten

Aktuell verfügbar:

- `node`
- `react`
- `nextjs`
- `php`
- `python`
- `wordpress-plugin`

Wichtig:

- `wordpress` ist kein gültiger Name
- nutze `--variant wordpress-plugin`

## Kompositionsmodell

Das neue Modell besteht aus:

- `profiles/` für Produktziele wie SaaS, MCP-Service oder Desktop-App
- `runtimes/` für Kernsprachen und Basisskelette
- `modules/` für technische Fähigkeiten wie FastAPI, Postgres, HTMX, Tauri oder PDF
- `policies/` für Querschnittsstandards wie CI, Sicherheitsbaseline und Spiegeldateien

Mehr Details dazu stehen in `docs/composition-model.md`.

## Sicherheitsprinzip

`agentum` ist absichtlich konservativ:

- bestehende kritische Dateien werden nicht blind überschrieben
- zuerst Analyse (`scan`), dann Planung (`retrofit-plan`), dann Anwendung (`retrofit-apply`)
- Pläne enthalten Stale/Fresh-Logik über Repository-Fingerprints

## Wichtige Dokumente

- `docs/quick-reference.md` schnelle Copy/Paste-Befehle
- `docs/usage-guide.md` vollständige Schritt-für-Schritt-Anleitung
- `docs/composition-model.md` Überblick über das neue Katalogmodell
- `docs/disclaimer-and-safety.md` Hinweise, Grenzen, Haftungsausschluss
- `docs/maintainer-guide.md` interne Pflege und Erweiterung

## Haftung und Verantwortung

Nutze das Tool verantwortungsvoll:

- immer in einem Branch arbeiten
- vor `retrofit-apply` den Plan lesen
- bei Produktivsystemen zusätzlich manuell prüfen und testen

Details dazu in `docs/disclaimer-and-safety.md`.
