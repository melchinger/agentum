# Usage Guide

Diese Anleitung ist für Menschen gemacht, die schon etwas gebaut haben, aber jetzt Struktur und Sicherheit wollen.

## Kurz gesagt

Wenn ein Projekt schon existiert, arbeite immer in dieser Reihenfolge:

1. `scan`
2. `retrofit-plan`
3. Plan lesen
4. `retrofit-apply`
5. `refactor-plan`
6. `doctor`

So vermeidest du blindes Überschreiben.

## Voraussetzungen

- Node.js `>=20`
- Ausführung aus dem Root dieses Repositories

```bash
node scripts/init-repo.js <command>
```

## Varianten

Verfügbare Varianten:

- `node`
- `react`
- `nextjs`
- `php`
- `python`
- `wordpress-plugin`

Wichtig:

- `--variant wordpress` funktioniert nicht
- korrekt ist `--variant wordpress-plugin`

## Neuerstellung eines Repositories

Beispiel:

```bash
node scripts/init-repo.js new ../my-app --variant react --project-name my-app --with-ci
```

Optional:

- `--package-manager pnpm|npm|yarn|composer|uv`
- `--with-mirror-files`
- `--dry-run`
- `--force`

## Bestehendes Repository sicher nachrüsten

### 1) Analyse

```bash
node scripts/init-repo.js scan ../legacy-app
```

Du siehst unter anderem:

- `detectedVariant`
- `projectStyle`
- `missingFiles`
- `divergentFiles`
- `manifestQuality`
- `repoFingerprint`

### 2) Plan erstellen

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app
```

Artefakte:

- `.agentum/retrofit-plan.json`
- `.agentum/retrofit-plan.md`

### 3) Plan prüfen

Prüfe vor dem Anwenden:

- ob die Variante passt
- ob `manualReviewItems` sinnvoll sind
- ob du CI/Mirror-Dateien wirklich willst
- ob der Plan noch frisch ist

### 4) Plan anwenden

```bash
node scripts/init-repo.js retrofit-apply ../legacy-app
```

Wenn das Repo nach der Planerstellung geändert wurde, bricht der Apply bewusst mit "stale plan" ab.

### 5) Refactoring planen

```bash
node scripts/init-repo.js refactor-plan ../legacy-app
```

Artefakte:

- `.agentum/refactor-plan.md`
- `.agentum/refactor-plan.json`

Der Plan priorisiert Hotspots und gibt konkrete Extraktionsrichtungen statt nur allgemeiner Architekturtexte.

### 6) Zustand prüfen

```bash
node scripts/init-repo.js doctor ../legacy-app
```

## JSON-Modus

Für CI, Automationen oder Agent-Pipelines:

```bash
node scripts/init-repo.js scan ../legacy-app --json
node scripts/init-repo.js retrofit-plan ../legacy-app --json
node scripts/init-repo.js refactor-plan ../legacy-app --json
node scripts/init-repo.js doctor ../legacy-app --json
```

## WordPress-Hinweis

Wenn dein Projekt ein WP-Plugin ist, nutze `wordpress-plugin`.

Beispiel:

```bash
node scripts/init-repo.js new ../aiLeadMagnet --variant wordpress-plugin --project-name aiLeadMagnet --with-ci
```

Zielbild bei WP:

- `includes/` als dünne Adapter/Bootstrap
- Fachlogik in `src/Domain`, `src/Application`, `src/Infrastructure`

## Typische Fehler und schnelle Lösung

### "Unknown variant: wordpress"

Nutze:

```bash
--variant wordpress-plugin
```

### "Retrofit plan is stale"

Repo wurde nach Planerstellung geändert. Neu erzeugen:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app
```

### Doctor meldet Missing bei Bestandsrepo

Normal, wenn noch kein vollständiger Retrofit gelaufen ist.

## Gute Arbeitsweise (empfohlen)

- vor Änderungen eigenen Branch erstellen
- bei kritischen Systemen Backup/Snapshot machen
- nach jedem größeren Schritt Projekt-Tests laufen lassen
- `manualReviewItems` nicht ignorieren

## Grenzen des Tools

`agentum` ist ein Struktur- und Sicherheitswerkzeug, kein Autopilot für komplette Migrationen.

Es macht nicht automatisch:

- komplexe Legacy-Migration ohne Review
- blindes Überschreiben bestehender Kern-Dateien
- rechtsverbindliche Security- oder Compliance-Freigaben

Für formale Anforderungen siehe `docs/disclaimer-and-safety.md`.
