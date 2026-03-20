# Quick Reference

Kurzübersicht für die häufigsten `agentum`-Befehle.

## Varianten anzeigen

```bash
node scripts/init-repo.js list-variants
```

## Neues Repository erzeugen

### React

```bash
node scripts/init-repo.js new ../my-react-app --variant react --project-name my-react-app
```

### Next.js mit CI

```bash
node scripts/init-repo.js new ../my-next-app --variant nextjs --project-name my-next-app --with-ci
```

### Python

```bash
node scripts/init-repo.js new ../my-python-app --variant python --project-name my-python-app
```

## Leeres Verzeichnis befüllen

```bash
node scripts/init-repo.js apply ../empty-folder --variant node --dry-run
```

## Bestehendes Repository analysieren

```bash
node scripts/init-repo.js scan ../legacy-app
```

## Sicheren Retrofit planen

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app
```

### Mit expliziter Variante

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app --variant react
```

### Mit CI und Mirror-Dateien

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app --with-ci --with-mirror-files
```

## Retrofit anwenden

```bash
node scripts/init-repo.js retrofit-apply ../legacy-app
```

## Refactoring-Plan erzeugen

```bash
node scripts/init-repo.js refactor-plan ../legacy-app
```

## Repository prüfen

```bash
node scripts/init-repo.js doctor ../legacy-app
```

## JSON-Ausgabe für Tools / CI

### Scan

```bash
node scripts/init-repo.js scan ../legacy-app --json
```

### Retrofit-Plan

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app --json
```

### Doctor

```bash
node scripts/init-repo.js doctor ../legacy-app --json
```

## Empfohlener Standard-Flow für Bestandsrepos

```bash
node scripts/init-repo.js scan ../legacy-app
node scripts/init-repo.js retrofit-plan ../legacy-app
node scripts/init-repo.js retrofit-apply ../legacy-app
node scripts/init-repo.js refactor-plan ../legacy-app
node scripts/init-repo.js doctor ../legacy-app
```

## Wichtige Hinweise

- Für bestehende Projekte erst `scan`, dann `retrofit-plan`, nicht direkt `apply`.
- `retrofit-apply` arbeitet nur auf Basis eines vorhandenen Plans.
- `doctor` kann vor dem Retrofit bei Bestandsrepos absichtlich noch Fehler melden.
- Ausführliche Erklärung: `docs/usage-guide.md`
