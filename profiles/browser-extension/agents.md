## Profile: Browser Extension

- Treat the extension as a **local-first application**. No outbound telemetry, no CDN scripts, no remote fonts. Everything that runs must be bundled into the extension package.
- Keep a hard separation between extension contexts: service worker, popup, options page, content scripts, and offscreen document each have different capabilities and lifecycles. Route all cross-context traffic through the typed message schemas in `src/shared/messages.ts`.
- Ship with the **least permissions** that work. Start from `activeTab` + `storage` and add capabilities through `optional_host_permissions` that you request with `chrome.permissions.request()` when the user opts into a feature.
- Data stays on the user's machine. If a feature pushes data to a remote server, that integration must be opt-in, fully disclosed in the UI, and explicit about which origin receives the payload.
- Declare keyboard shortcuts through `commands` in `manifest.json` and document them in the popup/options UI. Chrome surfaces overrides at `chrome://extensions/shortcuts`.
- Align the extension UI with the WebExtensions design guidelines (accessible focus ring, respects `prefers-color-scheme`, keyboard-reachable). The popup should be usable at 280–320 px width.
