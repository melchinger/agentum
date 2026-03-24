# Maintainer Guide

## Dokumentationspflicht

Diese Dateien müssen den aktuellen Produktzustand widerspiegeln:

- `README.md` als kompakter Einstieg
- `docs/usage-guide.md` als vollständige Nutzeranleitung
- `docs/quick-reference.md` als Copy/Paste-Seite
- `docs/composition-model.md` als Überblick über das neue Modell
- `docs/disclaimer-and-safety.md` für Sicherheits- und Haftungshinweise

Wenn sich CLI, Generatorlogik oder UX ändern, aktualisiere diese Dateien gemeinsam.

## Zwei Modelle im Repository

Agentum unterstützt derzeit zwei Wege:

### 1. Legacy Variant Model

- `variants/<name>/variant.json`
- `variants/<name>/agents.md`
- `variants/<name>/files/`

Nutze diesen Pfad für das bestehende Variant- und Retrofit-System.

### 2. Composition Model

- `profiles/<name>/profile.json`
- `runtimes/<name>/runtime.json`
- `modules/<category>/<name>/module.json`
- `policies/<name>/policy.json`

Nutze diesen Pfad für bewusst kombinierbare Zielstacks.

## Architekturregeln

- Gemeinsame Agent-Regeln liegen in `templates/base/agents/base.md`.
- Spiegeldateien niemals direkt pflegen; sie werden aus `AGENTS.md` abgeleitet.
- Gemeinsame Basisdateien liegen in `templates/base/files/`.
- Katalog-Einträge sollen möglichst datengetrieben bleiben und nicht sofort neue Sonderlogik im CLI erzwingen.

## Wann ändere ich was?

Ändere den Generatorcode nur, wenn das Datenmodell nicht mehr ausreicht.

Ändere Manifeste, wenn:

- ein neuer Stack oder eine neue Policy hinzukommt
- sich Kompatibilitäten ändern
- neue Standard-Dateien oder Commands notwendig sind

## Neue Legacy-Variante ergänzen

1. `variants/<name>/` anlegen
2. `variant.json` ergänzen
3. `agents.md` ergänzen
4. nur echte Abweichungen in `files/` ablegen
5. Tests für `list-variants`, `new`, `apply` und `doctor` ergänzen

## Neuen Katalogeintrag ergänzen

### Neues Profile

1. `profiles/<name>/profile.json` anlegen
2. optional `agents.md` ergänzen
3. auf gültige Runtime-, Modul- und Policy-Referenzen achten

### Neue Runtime

1. `runtimes/<name>/runtime.json` anlegen
2. optional `agents.md` ergänzen
3. Basisdateien in `files/` ablegen

### Neues Modul

1. `modules/<category>/<name>/module.json` anlegen
2. optional `agents.md` ergänzen
3. nur modul-spezifische Dateien in `files/` ablegen
4. `compatibleRuntimes`, `requiresModules`, `conflictsWith` und `implies` sauber pflegen

### Neue Policy

1. `policies/<name>/policy.json` anlegen
2. optional `agents.md` ergänzen
3. nur echte Querschnittsregeln hier modellieren

## Validierung

Vor dem Commit mindestens:

```bash
node scripts/validate-manifests.js
npm test
```

Zusätzlich sinnvoll:

```bash
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python
node scripts/init-repo.js explain-stack --profile desktop-app
```

## Pflege-Regeln

- Generator-Optionen erst datengetrieben modellieren, dann im CLI auswerten.
- Bei Änderungen an UX oder Kommandos immer auch die Referenz-Doku anpassen.
- Bestehende Repos dürfen nicht blind überschrieben werden; Retrofit bleibt konservativ.
- Tests sollen sowohl Legacy- als auch Composition-Pfade absichern.