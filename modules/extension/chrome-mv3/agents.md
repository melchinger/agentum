### Module: Chrome MV3 Extension

- Manifest V3 runs the background as a **service worker** without a DOM. For APIs that need DOM (e.g. `navigator.clipboard.write`, audio, or document parsing), use an **offscreen document** (`chrome.offscreen`) and message it from the service worker. Only one offscreen document per profile — guard creation with `chrome.runtime.getContexts()`.
- Content scripts cannot be injected on `chrome://`, the Chrome Web Store, or `about:` pages. Handle that failure explicitly rather than letting the extension appear broken.
- Prefer **optional** `host_permissions` with `chrome.permissions.request()` at runtime over declaring broad origins up front. Users and the Web Store reviewers trust least-privilege extensions.
- Pass ephemeral large payloads (screenshots, captured DOM, etc.) via `chrome.storage.session` or a Blob + URL instead of stuffing them into messages. `chrome.storage.session` has a ~10 MB per-profile cap.
- The service worker is non-persistent. Never rely on module-scope variables surviving — persist state in `chrome.storage.*` and re-hydrate on `onStartup` / `onInstalled`.
- Keep popup, options page, content scripts, and background code in **separate Vite entry points**. `@crxjs/vite-plugin` wires the manifest into the build; do not hand-craft dist paths.
- Respect CSP: `content_security_policy.extension_pages` must exclude `unsafe-eval` and remote script sources. No CDN imports at runtime.
- Load the built extension via `chrome://extensions` → Developer Mode → **Load unpacked** pointing at `dist/`.
