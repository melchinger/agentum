# AGENTS.md

This file is the canonical instruction source for `{{PROJECT_NAME}}`.

## Project Snapshot
- Repository type: `{{VARIANT}}`
- Primary language/runtime: `{{RUNTIME}}`
- Default package manager: `{{PACKAGE_MANAGER}}`
- Selected stack modules: {{SELECTED_STACKS}}
- Goal: produce clean, secure, maintainable software with professional repository hygiene.

## Commands
{{COMMANDS_BLOCK}}

## Stack Commands
{{STACK_COMMANDS_BLOCK}}

## Architecture Boundaries
- Respect a layered structure with clear separation between domain logic, application flow, infrastructure, and presentation or delivery code.
- Do not place business logic in views, templates, pages, or transport adapters.
- Prefer small, focused files and changes. Refactor files before they become large or multi-purpose.
- Keep data validation close to input boundaries and use typed DTOs or schemas when data crosses layers.

## Code Style
- Prefer descriptive names, small functions, and early returns over deeply nested control flow.
- Avoid `any`, untyped dictionaries, and hidden side effects.
- Reuse existing utilities and patterns before introducing a new abstraction.
- Keep tests close to behavior and document non-obvious decisions in the repository docs.

## Security Rules
- Never hard-code secrets, tokens, passwords, or production credentials.
- Commit only placeholders in `.env.example`; real values must stay outside version control.
- Validate all external input on the server or trusted boundary before persistence or privileged actions.
- Use least privilege for infrastructure, APIs, service accounts, and third-party integrations.
- Ask for confirmation before destructive or high-risk operations such as dropping data, resetting history, or changing deployment credentials.

## Accessibility and UX
- Use semantic structure and accessible defaults for interactive elements.
- Ensure loading, empty, and error states are explicit and actionable.
- Avoid color-only status communication and preserve visible focus states.

## Testing and Review Workflow
- Make the smallest meaningful change, then run the most specific validation available.
- Add or update tests when behavior changes and there is an established adjacent test pattern.
- Stop and surface blockers instead of masking them with temporary hacks.
- Keep generated or derived files synchronized with their source templates.

## Operational Boundaries
- Do not invent infrastructure, credentials, or external systems that are not documented in the repository.
- Prefer data-driven configuration over scattered conditional logic.
- Preserve backward compatibility unless the change explicitly introduces a migration plan.

## Anti-Patterns
- Do not mix transport, persistence, and UI concerns in one file.
- Do not bypass validation to “make it work”.
- Do not add hidden global state, silent catch-all error handling, or unreviewed code generation outputs.

## Stack Overlay
{{STACK_OVERLAY}}
