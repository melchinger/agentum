# Quick Reference

Kurze Copy/Paste-Befehle für den Alltag.

## Legacy Variants

```bash
node scripts/init-repo.js list-variants
node scripts/init-repo.js new ../my-app --variant react --project-name my-app --with-ci
node scripts/init-repo.js new ../my-plugin --variant wordpress-plugin --project-name my-plugin --with-ci
```

## Composition Catalog

```bash
node scripts/init-repo.js list-profiles
node scripts/init-repo.js list-runtimes
node scripts/init-repo.js list-modules --runtime python
node scripts/init-repo.js list-policies
node scripts/init-repo.js wizard ../soliCalc
```

## Stack prüfen

```bash
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python,playwright-pdf,single-container --with-ci
node scripts/init-repo.js explain-stack --profile desktop-app
```

## Komponiertes Repo erzeugen

```bash
node scripts/init-repo.js new ../saas-app --profile saas-web-app --runtime python --project-name saas-app --modules htmx,mcp-python,playwright-pdf,single-container --policies mirror-instructions --with-ci
node scripts/init-repo.js new ../desktop-app --profile desktop-app --project-name desktop-app
```

## Bestehendes Repo sicher nachrüsten

```bash
node scripts/init-repo.js scan ../legacy-app
node scripts/init-repo.js retrofit-plan ../legacy-app
node scripts/init-repo.js retrofit-apply ../legacy-app
node scripts/init-repo.js refactor-plan ../legacy-app
node scripts/init-repo.js doctor ../legacy-app
```

## JSON für CI und Agenten

```bash
node scripts/init-repo.js scan ../legacy-app --json
node scripts/init-repo.js doctor ../legacy-app --json
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python --json
node scripts/init-repo.js explain-stack --profile desktop-app --json
```

## Manifest-Validierung

```bash
node scripts/validate-manifests.js
```

## Häufige Stolpersteine

Falscher WordPress-Name:

```bash
--variant wordpress-plugin
```

Stale Plan:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app
```
