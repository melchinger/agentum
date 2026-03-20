# Agentum Repository Instructions

## Purpose
- This repository is the source of truth for repository templates, generator logic, and agent instruction variants.
- Keep the structure modular: shared behavior in `templates/base`, stack-specific additions in `variants/<name>`, implementation code in `scripts/`, and verification in `tests/`.

## Working Rules
- Update manifests and templates together when adding or changing a variant.
- Preserve `AGENTS.md` as the canonical instruction source; mirrored tool files must stay derived artifacts.
- Prefer data-driven behavior via `templates/manifest.json` and `variants/*/variant.json` over hard-coded branching in the CLI.
- Keep generated repositories minimal: governance plus skeleton, not full product scaffolding.
- Do not duplicate shared rules across variants; add only stack-specific overlays.

## Validation
- Run `npm test` after generator or template changes.
- Verify command output with `node scripts/init-repo.js list-variants` when variant definitions change.
