# Usage Guide

Diese Anleitung beschreibt die praktische Nutzung von `agentum` für zwei Hauptfälle:

- neue Repositories sauber initialisieren
- bestehende Repositories sicher mit Governance, Agent-Instruktionen und Refactoring-Planung nachrüsten

Die Anleitung ist bewusst schrittweise aufgebaut und erklärt nicht nur die Befehle, sondern auch, **wann** welcher Befehl sinnvoll ist und **wie** die Ergebnisse zu lesen sind.

## Grundprinzip

`agentum` arbeitet in zwei Modi:

- **Scaffolding-Modus** für neue oder leere Verzeichnisse
- **Retrofit-Modus** für bestehende Projekte

Wichtig ist die Trennung:

- `new` und `apply` schreiben direkt Dateien
- `scan`, `retrofit-plan` und `refactor-plan` analysieren bzw. planen zuerst
- `retrofit-apply` wendet nur bereits geplante, sichere Änderungen an

Für bestehende Anwendungen sollte fast immer zuerst der Retrofit-Flow verwendet werden.

## Voraussetzungen

- Node.js `>=20`
- Zugriff auf dieses Repository oder eine lokale Kopie davon
- Ausführung der CLI aus dem Root dieses Repositories:

```bash
node scripts/init-repo.js <command>
```

## Schnellüberblick

### Für neue Repositories

```bash
node scripts/init-repo.js list-variants
node scripts/init-repo.js new ../my-app --variant react --project-name my-app
node scripts/init-repo.js doctor ../my-app
```

### Für bestehende Repositories

```bash
node scripts/init-repo.js scan ../existing-repo
node scripts/init-repo.js retrofit-plan ../existing-repo
node scripts/init-repo.js retrofit-apply ../existing-repo
node scripts/init-repo.js refactor-plan ../existing-repo
node scripts/init-repo.js doctor ../existing-repo
```

## Varianten

Aktuell unterstützt `agentum` diese Profile:

- `node`
- `react`
- `nextjs`
- `php`
- `python`

Die Variante bestimmt:

- die generierte `AGENTS.md`
- die empfohlene Zielstruktur
- typische Stack-Kommandos
- die Marker für Stack-Erkennung bei bestehenden Projekten

## Teil 1: Neue Repositories erzeugen

### `list-variants`

Zeigt alle verfügbaren Varianten an.

```bash
node scripts/init-repo.js list-variants
```

Sinnvoll, wenn du vor einer Initialisierung die unterstützten Stack-Profile prüfen willst.

### `new <target-dir>`

Erzeugt ein neues Repository in einem Zielverzeichnis.

Beispiel:

```bash
node scripts/init-repo.js new ../customer-portal --variant nextjs --project-name customer-portal
```

Typische Wirkung:

- legt die Basisstruktur an
- erzeugt `AGENTS.md`
- ergänzt Governance-Dateien wie `.env.example`, `.editorconfig`, Checklisten
- fügt stack-spezifische Skeleton-Dateien hinzu

Wichtige Flags:

- `--variant <name>` wählt die Variante
- `--project-name <name>` setzt den Projektnamen
- `--package-manager <pm>` überschreibt den Default
- `--with-ci` ergänzt einen CI-Workflow
- `--with-mirror-files` erzeugt abgeleitete Dateien wie `CLAUDE.md`
- `--dry-run` zeigt nur die geplanten Schreiboperationen
- `--force` erlaubt das Schreiben in nicht-leere Zielverzeichnisse

### `apply <target-dir>`

Gedacht für bestehende, aber bewusst direkt zu befüllende Verzeichnisse. Dieser Modus schreibt direkt und ist deshalb eher für kontrollierte Setups geeignet.

Beispiel:

```bash
node scripts/init-repo.js apply ../empty-existing-folder --variant python --dry-run
```

Empfehlung:

- für wirklich bestehende Anwendungen lieber **nicht** direkt `apply` verwenden
- stattdessen `scan` → `retrofit-plan` → `retrofit-apply`

## Teil 2: Bestehende Repositories nachrüsten

Der Retrofit-Flow ist der sichere Weg für laufende oder individuell gewachsene Projekte.

### Ziel des Retrofit-Flows

Er soll:

- den Stack erkennen
- fehlende Governance-Dateien identifizieren
- bestehende kritische Dateien schützen
- nur sichere, additive oder klar mergebare Änderungen automatisch anwenden
- tieferes Refactoring separat planen

### Empfohlene Reihenfolge

1. `scan`
2. `retrofit-plan`
3. Ergebnis prüfen
4. `retrofit-apply`
5. `refactor-plan`
6. `doctor`

## `scan <target-dir>`

Analysiert ein bestehendes Repository und gibt eine erste Einschätzung aus.

Beispiel:

```bash
node scripts/init-repo.js scan ../legacy-dashboard
```

Was `scan` erkennt:

- wahrscheinliche Variante
- Vertrauenswert (`confidence`)
- gefundene Repo-Marker wie `package.json`, `next.config.ts`, `pyproject.toml`
- fehlende Governance-Dateien
- Konflikte, z. B. vorhandene `AGENTS.md` oder bestehende CI-Dateien

Typische Ausgabe:

- `Detected variant`: vom Tool erkannte Stack-Variante
- `Selected variant`: tatsächlich verwendete Variante
- `Markers`: erkannte Stack-/Repo-Hinweise
- `Missing governance`: fehlende Standarddateien
- `Conflicts`: Dateien, die nicht blind überschrieben werden sollen
- `Recommended next action`: nächster sinnvoller Schritt

### Wann `scan` nützlich ist

- vor jedem Retrofit eines Bestandsprojekts
- wenn unklar ist, welche Variante am besten passt
- wenn du schnell den Reifegrad eines Repositories einschätzen willst

## `retrofit-plan <target-dir>`

Erstellt einen konkreten Nachrüstungsplan für ein bestehendes Repository, ohne kritische Dateien blind zu überschreiben.

Beispiel:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-dashboard
```

Optional mit expliziter Variante:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-dashboard --variant react
```

Optional mit zusätzlichen Artefakten:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-dashboard --with-ci --with-mirror-files
```

### Ergebnisdateien

Der Befehl erzeugt unter `.agentum/`:

- `.agentum/retrofit-plan.json`
- `.agentum/retrofit-plan.md`

### Was im Plan steht

- erkannte bzw. gewählte Variante
- fehlende Governance-Dateien
- vorgeschlagene sichere Änderungen
- manuell zu prüfende Konflikte

### Sicherheitsstufen im Plan

#### Additiv

Datei existiert noch nicht und kann sicher angelegt werden.

Typische Beispiele:

- `docs/security-checklist.md`
- `docs/review-checklist.md`
- `.agentum-template.json`

#### Mergebar

Datei existiert bereits, kann aber strukturiert erweitert werden.

Typische Beispiele:

- `.gitignore`
- `.env.example`
- `README.md`

Diese Änderungen werden nicht blind ersetzt, sondern nur ergänzt.

#### Manuelle Prüfung

Datei ist zu kritisch oder zu individuell für automatische Überschreibung.

Typische Beispiele:

- `AGENTS.md`
- `.github/workflows/ci.yml`
- bestehende Spiegeldateien wie `CLAUDE.md`

### Wie du den Plan liest

Die Markdown-Datei ist für Menschen gedacht, die JSON-Datei für Tools oder Automationen.

Prüfe vor dem Anwenden besonders:

- ob die Variante korrekt erkannt wurde
- ob die `manualReviewItems` plausibel sind
- ob `with-ci` oder `with-mirror-files` wirklich gewünscht sind

## `retrofit-apply <target-dir>`

Wendet den vorhandenen Retrofit-Plan an.

Beispiel:

```bash
node scripts/init-repo.js retrofit-apply ../legacy-dashboard
```

Wichtig:

- es wird **kein neuer Plan berechnet**
- angewendet wird nur, was in `.agentum/retrofit-plan.json` steht
- manuelle Review-Items werden **nicht** automatisch überschrieben

### Was tatsächlich passiert

- neue Governance-Dateien werden hinzugefügt
- `README.md`, `.gitignore` und `.env.example` werden nur ergänzend erweitert
- vorhandene kritische Dateien bleiben unangetastet

### Vor dem Anwenden empfohlen

- `retrofit-plan.md` lesen
- Änderungen ggf. in Git vormerken
- bei kritischen Projekten zuerst in einem Branch oder Backup arbeiten

## `refactor-plan <target-dir>`

Erstellt einen priorisierten Refactoring-Fahrplan für ein bestehendes Projekt.

Beispiel:

```bash
node scripts/init-repo.js refactor-plan ../legacy-dashboard
```

Ergebnis:

- `.agentum/refactor-plan.md`

### Was analysiert wird

- große Dateien
- vermischte Verantwortlichkeiten
- mögliche Mischung aus UI und Datenzugriff
- fehlende Zielverzeichnisse für die gewählte Variante

### Ziel des Refactor-Plans

Nicht sofort umbauen, sondern:

- Hotspots sichtbar machen
- sinnvolle Reihenfolge definieren
- kleine, validierbare Schritte vorbereiten

### Typische Inhalte

- fehlende Governance zuerst ergänzen
- Zielstruktur für den Stack herstellen
- große oder vermischte Dateien schrittweise aufteilen
- am Ende mit `doctor` und Projekt-Tests validieren

## `doctor <target-dir>`

Prüft, ob ein Repository die erwarteten Governance- und Variant-Dateien besitzt.

Beispiel:

```bash
node scripts/init-repo.js doctor ../legacy-dashboard
```

`doctor` prüft:

- Basisdateien aus dem Manifest
- variantenspezifische Pflichtdateien
- optionale Artefakte wie Mirror-Dateien oder CI, falls im Metadatenzustand vorgesehen

Wichtig:

- bei Bestandsrepos ohne `.agentum-template.json` oder `.agentum`-Metadaten kann `doctor` zunächst Fehler melden
- das ist normal, wenn das Repo noch nicht vollständig durch `retrofit-plan` / `retrofit-apply` vorbereitet wurde

## JSON-Modus

Für maschinelle Auswertung unterstützen mehrere Befehle `--json`.

Aktuell sinnvoll nutzbar für:

- `scan`
- `retrofit-plan`
- `doctor`
- `refactor-plan`

### Beispiel: `scan --json`

```bash
node scripts/init-repo.js scan ../legacy-dashboard --json
```

Typische Anwendungsfälle:

- Automationen
- CI-Vorprüfungen
- Weiterverarbeitung durch andere Agenten
- strukturierte Logging-/Dashboard-Auswertung

### Beispiel: `retrofit-plan --json`

```bash
node scripts/init-repo.js retrofit-plan ../legacy-dashboard --json
```

Enthält u. a.:

- `status`
- `planPath`
- `markdownPath`
- `variant`
- `proposedOperations`
- `manualReviewItems`

### Beispiel: `doctor --json`

```bash
node scripts/init-repo.js doctor ../legacy-dashboard --json
```

Enthält u. a.:

- `ok`
- `variant`
- `results`
- optional `error`

## Sichere Anwendung auf Bestandsprojekte

Empfohlene Praxis:

1. Vor dem ersten Retrofit in einem separaten Git-Branch arbeiten
2. Immer zuerst `scan`
3. Danach `retrofit-plan`
4. Plan bewusst prüfen, besonders `manualReviewItems`
5. Erst dann `retrofit-apply`
6. Danach `refactor-plan`
7. Abschließend `doctor` und projektspezifische Tests ausführen

## Grenzen des Tools

`agentum` ist bewusst konservativ.

Es macht **nicht** automatisch:

- komplexe Migration von Build-Konfigurationen
- Überschreiben vorhandener `AGENTS.md`
- Ersetzen bestehender CI-Workflows
- tiefes Architektur-Refactoring im Code

Das Tool liefert dafür:

- sichere Nachrüstung
- transparente Pläne
- maschinenlesbare Outputs
- priorisierte Refactoring-Hinweise

## Empfohlene Standard-Workflows

### Neuer React-Start

```bash
node scripts/init-repo.js new ../my-react-app --variant react --project-name my-react-app --with-ci
node scripts/init-repo.js doctor ../my-react-app
```

### Bestehendes Next.js-Projekt nachrüsten

```bash
node scripts/init-repo.js scan ../legacy-next
node scripts/init-repo.js retrofit-plan ../legacy-next --with-mirror-files
node scripts/init-repo.js retrofit-apply ../legacy-next
node scripts/init-repo.js refactor-plan ../legacy-next
node scripts/init-repo.js doctor ../legacy-next
```

### Automations- oder CI-freundlicher JSON-Flow

```bash
node scripts/init-repo.js scan ../legacy-next --json
node scripts/init-repo.js retrofit-plan ../legacy-next --json
node scripts/init-repo.js doctor ../legacy-next --json
```

## Wann du welche Befehle verwenden solltest

- **Nur ein neues Repo erzeugen:** `new`
- **Leeres bestehendes Verzeichnis befüllen:** `apply`
- **Bestehendes Projekt analysieren:** `scan`
- **Sichere Nachrüstung vorbereiten:** `retrofit-plan`
- **Vorbereiteten Retrofit anwenden:** `retrofit-apply`
- **Code- und Struktur-Baustellen priorisieren:** `refactor-plan`
- **Ergebnis prüfen:** `doctor`
