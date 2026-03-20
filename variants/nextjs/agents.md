### Next.js Overlay
- Default to Server Components and use Client Components only where interactivity requires them.
- Prefer Server Actions for trusted mutations; add route handlers only for external consumers or protocol needs.
- Keep server-only code out of client bundles and isolate side effects in server boundaries.
- Use framework loading and error conventions rather than custom ad-hoc page state handling where possible.
