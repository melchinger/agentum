# Usage Guide

Diese Anleitung zeigt beide Arbeitsmodi von Agentum:

- `variants/` für das bisherige, einfache Variant-Modell
- `profiles/runtimes/modules/policies` für das neue Kompositionsmodell

## Kurz gesagt

Nutze `variants`, wenn du schnell ein klassisches Skeleton oder einen Retrofit-Flow brauchst.

Nutze das Kompositionsmodell, wenn du bewusst einen Stack zusammensetzen, validieren und erklären willst, zum Beispiel:

- `saas-web-app + python + fastapi + postgres + alembic`
- `desktop-app + rust + tauri + react + sqlite`
- `desktop-app-svelte + rust + tauri + svelte + sqlite`
- `desktop-app-sveltekit + rust + tauri + sveltekit-static + sqlite`

## Voraussetzungen

- Node.js `>=20`
- Ausführung aus dem Root dieses Repositories

```bash
node scripts/init-repo.js <command>
```

## 1. Legacy Variant Workflow

### Varianten anzeigen

```bash
node scripts/init-repo.js list-variants
```

Aktuell verfügbar:

- `node`
- `react`
- `nextjs`
- `php`
- `python`
- `wordpress-plugin`

Wichtig:

- `--variant wordpress` funktioniert nicht
- korrekt ist `--variant wordpress-plugin`

### Neues Repo erzeugen

```bash
node scripts/init-repo.js new ../my-app --variant react --project-name my-app --with-ci
```

Optional:

- `--package-manager pnpm|npm|yarn|composer|uv`
- `--stacks <a,b>`
- `--with-mirror-files`
- `--dry-run`
- `--force`

### Bestehendes Repository sicher nachrüsten

Arbeite immer in dieser Reihenfolge:

1. `scan`
2. `retrofit-plan`
3. Plan lesen
4. `retrofit-apply`
5. `refactor-plan`
6. `doctor`

Beispiele:

```bash
node scripts/init-repo.js scan ../legacy-app
node scripts/init-repo.js retrofit-plan ../legacy-app
node scripts/init-repo.js retrofit-apply ../legacy-app
node scripts/init-repo.js refactor-plan ../legacy-app
node scripts/init-repo.js doctor ../legacy-app
```

## 2. Composition Workflow

Das neue Modell besteht aus:

- `profiles/` für Produktziele
- `runtimes/` für Basisskelette
- `modules/` für technische Fähigkeiten
- `policies/` für Querschnittsstandards

### Katalog anzeigen

```bash
node scripts/init-repo.js list-profiles
node scripts/init-repo.js list-runtimes
node scripts/init-repo.js list-modules --runtime python
node scripts/init-repo.js list-policies
```

### Stack validieren und erklären

```bash
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python,playwright-pdf,single-container --with-ci
node scripts/init-repo.js explain-stack --profile desktop-app
```

`validate-stack` ist für Regeln und Maschinenlogik gedacht.

`explain-stack` ist für Menschen gedacht und zeigt die aufgelöste Zielkombination.

### Neues Repo aus einer Komposition erzeugen

SaaS-Beispiel:

```bash
node scripts/init-repo.js new ../saas-app --profile saas-web-app --runtime python --project-name saas-app --modules htmx,mcp-python,playwright-pdf,single-container --policies mirror-instructions --with-ci
```

Desktop/Tauri-Beispiele:

```bash
node scripts/init-repo.js new ../desktop-app --profile desktop-app --project-name desktop-app
node scripts/init-repo.js new ../desktop-svelte --profile desktop-app-svelte --project-name desktop-svelte
node scripts/init-repo.js new ../desktop-sveltekit --profile desktop-app-sveltekit --project-name desktop-sveltekit
```

Frontend-Wahl bei Tauri-Apps:

- `desktop-app` — React (bare SPA, Default)
- `desktop-app-svelte` — Svelte (bare SPA, kein Routing)
- `desktop-app-sveltekit` — SvelteKit + adapter-static (Routing, Prerender)

Hinweise:

- Profile können Default-Module und Pflicht-Policies mitbringen.
- Module können weitere Module implizieren oder harte Anforderungen haben.
- Policies ergänzen Governance, ohne als Framework-Entscheidung modelliert zu werden.

## JSON-Modus

Für CI, Automationen oder Agent-Pipelines:

```bash
node scripts/init-repo.js scan ../legacy-app --json
node scripts/init-repo.js retrofit-plan ../legacy-app --json
node scripts/init-repo.js refactor-plan ../legacy-app --json
node scripts/init-repo.js doctor ../legacy-app --json
node scripts/init-repo.js validate-stack --profile saas-web-app --runtime python --modules htmx,mcp-python --json
node scripts/init-repo.js explain-stack --profile desktop-app --json
```

## Manifest-Validierung

Wenn du Katalog-Dateien pflegst, validiere sie vor Änderungen am Generator:

```bash
node scripts/validate-manifests.js
```

## Typische Fehler und schnelle Lösung

### `Unknown variant: wordpress`

Nutze:

```bash
--variant wordpress-plugin
```

### `Retrofit plan is stale`

Das Repo wurde nach der Planerstellung geändert. Erzeuge den Plan neu:

```bash
node scripts/init-repo.js retrofit-plan ../legacy-app
```

### `validate-stack` meldet Konflikte

Dann passt mindestens ein Modul nicht zur Runtime oder zu anderen Modulen. Nutze:

```bash
node scripts/init-repo.js explain-stack ...
```

und reduziere danach die Kombination auf die tatsächlich gewollten Bausteine.

## Gute Arbeitsweise

- Vor Änderungen eigenen Branch erstellen.
- Bei kritischen Systemen Backup oder Snapshot machen.
- Bei Retrofit-Änderungen zuerst planen, dann anwenden.
- `manualReviewItems` nicht ignorieren.
- Bei Katalog-Arbeit erst Manifeste validieren, dann Generator oder Tests anpassen.

## Grenzen des Tools

Agentum ist ein Struktur-, Governance- und Stack-Kompositionswerkzeug.

Es macht nicht automatisch:

- komplexe Legacy-Migration ohne Review
- blindes Überschreiben bestehender Kern-Dateien
- vollständige App-Implementierung für jede mögliche Stack-Kombination
- rechtsverbindliche Security- oder Compliance-Freigaben

Mehr Kontext:

- `docs/quick-reference.md`
- `docs/composition-model.md`
- `docs/disclaimer-and-safety.md`