# Agentum Repository Instructions

## Purpose

This repository is a **generator**. It produces other repositories: their skeleton,
their `AGENTS.md`, and their governance. Almost nothing here is application code — it
is a catalog of data plus the CLI that assembles it.

The catalog is the source of truth. Prose in `docs/` describes *how* it works; it never
defines *what exists*. When the two disagree, the catalog is right and the prose is a
bug.

## Two Models

| | Use when | Lives in |
| --- | --- | --- |
| **Composition** (current) | Assembling a stack from parts, or anything new | `profiles/`, `runtimes/`, `modules/`, `policies/` |
| **Variants** (legacy) | Classic skeleton or the conservative retrofit flow | `variants/`, `templates/base` |

Add new capability to the composition model. Touch `variants/` only to fix it.

## Finding Things

Never guess what the catalog holds, and never trust a list in a doc. Ask it:

```bash
node scripts/init-repo.js list-profiles
node scripts/init-repo.js list-runtimes
node scripts/init-repo.js list-modules --runtime rust   # --runtime filters by compatibility
node scripts/init-repo.js list-policies
node scripts/init-repo.js explain-stack --profile <name>
node scripts/init-repo.js validate-stack --runtime <rt> --modules <a,b>
```

`docs/catalog.md` is a generated snapshot of the same data — regenerate it with
`npm run docs:catalog`, never hand-edit it.

## Anatomy

- `profiles/<name>/profile.json` — a product goal. Names `recommendedRuntime` **or**
  `runtimes: [...]` for multi-runtime repos, never both. Pulls in `defaultModules`.
- `runtimes/<name>/` — language skeleton. Owns the root manifest (`Cargo.toml`,
  `package.json`, `pyproject.toml`).
- `modules/<category>/<name>/` — one capability. `module.json` + `files/` + `agents.md`.
- `policies/<name>/` — cross-cutting repo defaults, merged into the generated `AGENTS.md`.
- `schemas/*.schema.json` — the manifest contract. `scripts/validate-manifests.js`
  derives its allowed keys from these, so a key no schema declares is an error.
- Each entity's `agents.md` is an overlay: it is copied into the *generated* repo's
  `AGENTS.md`. Write it as instructions to a future agent working in that project, not
  as documentation about agentum.

## Working Rules

- **Data over branching.** New behavior belongs in a manifest, not in an `if` in the
  CLI. If the CLI needs a special case for one module, the model is wrong.
- **Modules are additive.** A module must not require a human to hand-edit a generated
  file afterwards. Dependencies are declared as data — `cargoDependencies` and
  `npmDependencies` — and merged by the generator. A module's `agents.md` that says
  "add the following to your Cargo.toml" is a bug report against this rule.
- **Watch for file ownership.** `applyOperations` writes sequentially and the last
  write wins, silently. Two modules that ship the same path clobber each other in
  module category order. Either exactly one module owns a file, or the modules declare
  `conflictsWith`, or the content is merged as data.
- **Update the manifest and the templates together.** A `requiredFiles` entry with no
  template makes `doctor` fail on every generated repo.
- **Keep generated repos minimal.** Governance plus skeleton, not a finished product.

## Validation

Run all of these after touching the generator, a manifest, or a template:

```bash
npm test                          # includes manifest + schema validation
npm run validate:manifests        # faster, catalog only
```

Generating is not proof. A stack that validates can still fail to build. For a new or
changed module, generate into a temp dir and run the real toolchain — `cargo check`,
`npm run build`, the test command the module declares.
