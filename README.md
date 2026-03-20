# Agentum

`agentum` hilft dir, neue Repositories sauber aufzusetzen oder bestehende Projekte sicher nachzurüsten.

Es ist gemacht für Teams und Einzelentwickler, die bereits schnell "vibe-coded" haben und jetzt Ordnung, Sicherheit und nachvollziehbare Regeln brauchen.

## Was das Tool macht

- erzeugt neue Projektstrukturen mit klaren Standards
- erstellt oder ergänzt `AGENTS.md` als zentrale Agent-Anweisung
- analysiert bestehende Repositories, bevor Änderungen geschrieben werden
- trennt sichere Auto-Änderungen von manueller Prüfung
- erstellt einen priorisierten Refactoring-Plan statt blind umzubauen

## Für wen das sinnvoll ist

- du hast schnell prototypisiert und willst den Code jetzt professionalisieren
- du willst nicht bei jeder Session dieselben Regeln neu erklären
- du willst riskante Änderungen zuerst als Plan sehen
- du willst Team-Standards konsistent in mehrere Repos tragen

## Schnellstart

```bash
node scripts/init-repo.js list-variants
node scripts/init-repo.js scan ../existing-repo
node scripts/init-repo.js retrofit-plan ../existing-repo
node scripts/init-repo.js retrofit-apply ../existing-repo
node scripts/init-repo.js doctor ../existing-repo
```

Für neue Repositories:

```bash
node scripts/init-repo.js new ../my-app --variant react --project-name my-app --with-ci
```

## Varianten

Aktuell verfügbar:

- `node`
- `react`
- `nextjs`
- `php`
- `python`
- `wordpress-plugin`

Wichtig:

- `wordpress` ist **kein** gültiger Name
- nutze `--variant wordpress-plugin`

## Sicherheitsprinzip

`agentum` ist absichtlich konservativ:

- bestehende kritische Dateien werden nicht blind überschrieben
- zuerst Analyse (`scan`), dann Planung (`retrofit-plan`), dann Anwendung (`retrofit-apply`)
- Pläne enthalten Stale/Fresh-Logik über Repository-Fingerprints

## Wichtige Dokumente

- `docs/quick-reference.md` schnelle Copy/Paste-Befehle
- `docs/usage-guide.md` vollständige Schritt-für-Schritt-Anleitung
- `docs/disclaimer-and-safety.md` Hinweise, Grenzen, Haftungsausschluss
- `docs/maintainer-guide.md` interne Pflege und Erweiterung

## Haftung und Verantwortung

Nutze das Tool verantwortungsvoll:

- immer in einem Branch arbeiten
- vor `retrofit-apply` den Plan lesen
- bei Produktivsystemen zusätzlich manuell prüfen und testen

Details dazu in `docs/disclaimer-and-safety.md`.
