### Module: TypeScript Library (Vite, library mode)

A standalone, framework-free package under `packages/lib/`, built as ESM + CJS with
type declarations. Use it for an embeddable SDK or player that ships on its own
release cycle, separate from any app that consumes it.

Rules:

- `src/index.ts` is the contract. Anything not re-exported from it is internal and may
  change without notice. Keep the surface deliberately small.
- A library must not bundle its consumers' dependencies. Every runtime dependency
  belongs in `rollupOptions.external` *and* in `peerDependencies` — otherwise the
  consuming app ends up with two copies.
- Keep `sideEffects: false` honest. Module-level code that touches `window`, registers
  globals, or mutates prototypes breaks tree-shaking for every consumer.
- Do not reach into a sibling package's source. Consume its public entry point, or the
  packages are not actually separate.
- The declaration build (`tsconfig.build.json`) covers `src` only. Tests must never
  reach `dist/`.
