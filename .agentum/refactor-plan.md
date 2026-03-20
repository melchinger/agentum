# Refactor Plan

- Variant: `nextjs`
- Project style: `generic`
- Confidence: 0.35

## Target Architecture

- Align source code with the selected stack's layered structure.
- src/app
- src/components
- src/lib
- tests

## Hotspots

- scripts/init-repo.js (large-file:358)
- scripts/lib/repo-generator.js (large-file:278)
- scripts/lib/retrofit-engine.js (large-file:837)

## Extraction Candidates

- scripts/init-repo.js: Split data access, orchestration, and presentation into separate files.
- scripts/lib/repo-generator.js: Split data access, orchestration, and presentation into separate files.
- scripts/lib/retrofit-engine.js: Split data access, orchestration, and presentation into separate files.

## Prioritized Steps

- Stabilize missing governance files first.
- Introduce target structure for `nextjs`: src/app, src/components, src/lib.
- Refactor scripts/init-repo.js: Split data access, orchestration, and presentation into separate files.
- Refactor scripts/lib/repo-generator.js: Split data access, orchestration, and presentation into separate files.
- Refactor scripts/lib/retrofit-engine.js: Split data access, orchestration, and presentation into separate files.
- Resolve manual-review items before changing existing CI or instruction files.
- Finish with `init-repo doctor` and project-specific tests/build commands.

## Do Not Change Yet

- AGENTS.md

## Validation

- Regenerate or review retrofit plan if governance files changed.
- Refactor one hotspot at a time and run the most specific project validation after each step.
- Run `init-repo doctor <target-dir>` after structural changes.
