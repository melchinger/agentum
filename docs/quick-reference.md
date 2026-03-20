# Quick Reference

Kurze Copy/Paste-Befehle für den Alltag.

## Varianten anzeigen

```bash
node scripts/init-repo.js list-variants
```

## Neues Repo erzeugen

```bash
node scripts/init-repo.js new ../my-app --variant react --project-name my-app --with-ci
```

WordPress-Plugin:

```bash
node scripts/init-repo.js new ../aiLeadMagnet --variant wordpress-plugin --project-name aiLeadMagnet --with-ci
```

## Bestehendes Repo sicher nachrüsten

```bash
node scripts/init-repo.js scan ../legacy-app
node scripts/init-repo.js retrofit-plan ../legacy-app
node scripts/init-repo.js retrofit-apply ../legacy-app
node scripts/init-repo.js refactor-plan ../legacy-app
node scripts/init-repo.js doctor ../legacy-app
```

## JSON für CI/Automationen

```bash
node scripts/init-repo.js scan ../legacy-app --json
node scripts/init-repo.js retrofit-plan ../legacy-app --json
node scripts/init-repo.js refactor-plan ../legacy-app --json
node scripts/init-repo.js doctor ../legacy-app --json
```

## Häufige Stolpersteine

### Falscher Variant-Name

Nicht:

```bash
--variant wordpress
```

Richtig:

```bash
--variant wordpress-plugin
```

### Stale Plan

Wenn `retrofit-apply` wegen stale Plan stoppt:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app
```

## Sicherheits-Reminder

- zuerst planen, dann anwenden
- in Branch arbeiten
- `manualReviewItems` immer lesen

Mehr Kontext: `docs/usage-guide.md` und `docs/disclaimer-and-safety.md`.
