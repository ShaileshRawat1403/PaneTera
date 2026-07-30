# Full Operator Contract

**Status:** Feature branch `feature/full-operator-extension`. Not accepted into
the release line.
**Scope:** Extends the PaneTera Browser Operator extension with a Claude-class
capability surface behind an explicit governance toggle.

## Intent

The governed operator (capture, observe, propose/approve action) remains the
default and is unchanged. This branch adds a second lane: a full operator that
can navigate, orchestrate tabs, run in-page JavaScript, drive coordinate mouse
and keyboard input, take screenshots, and read console and network activity.

The two lanes are separated by one persisted switch, not mixed per action.

## Governance toggle

`operator/mode.js` persists a mode in `chrome.storage.local`:

- `governed` (default): only page-authority-free introspection runs directly
  through the operator surface (currently `list_tabs`). Every op that
  navigates, scripts, dispatches input, attaches the debugger, or reads
  diagnostics is refused with a hint to enable full-operator mode. Governed
  action continues through the existing propose/approve pipeline.
- `ungoverned`: every op executes directly with no approval gate.

Safety properties, covered by `test/operator-mode.test.js`:

- a missing, corrupt, or unknown stored value resolves to `governed`;
- a storage read failure resolves to `governed`;
- `setMode` rejects unknown values, so the store can only hold a known-safe
  mode;
- ungoverned authority is never a fallback, only an explicit user choice.

The toggle is exposed in the extension popup. Turning it on shows a standing
warning and the mode hint updates. Chrome's own "started debugging this browser"
banner appears whenever a DevTools-protocol session is active and must not be
suppressed: it is the user's visible signal that the operator holds CDP
authority.

## Capability surface

Driven by sending the background worker `{ type: 'operator', op, params }`.
The response is `{ ok, op, mode, result | error, blocked? }`.

Navigation and tabs (`operator/navigation.js`, no CDP):

- `navigate` `{ tabId?, url, waitForLoad?, timeoutMs? }`
- `open_tab` `{ url?, active?, waitForLoad? }`
- `close_tab` `{ tabId | tabId[] }`
- `activate_tab` `{ tabId }`
- `list_tabs` `{ query? }` — allowed in governed mode
- `resize_window` `{ tabId?, width, height }`

In-page scripting (`operator/script.js`):

- `evaluate` `{ tabId?, expression, awaitPromise? }` — arbitrary JS via CDP
  `Runtime.evaluate`, bypasses page CSP, returns value
- `read_page_text` `{ tabId?, maxChars? }`

Vision and coordinate control (`operator/vision.js`, CDP `Input`/`Page`):

- `screenshot` `{ tabId?, format?, fullPage? }`
- `click` `{ tabId?, x, y, button?, clickCount? }`
- `move_mouse` `{ tabId?, x, y }`
- `scroll` `{ tabId?, x?, y?, deltaX?, deltaY? }`
- `type` `{ tabId?, text }`
- `press_key` `{ tabId?, key, code?, modifiers? }`

Diagnostics (`operator/debugging.js`, CDP `Network`/`Runtime`/`Log`):

- `diagnostics_start` `{ tabId }`
- `diagnostics_get` `{ tabId, kind? }`
- `diagnostics_stop` `{ tabId }`

## Architecture

- `operator/cdp.js` wraps `chrome.debugger` with reference-counted attach,
  promisified `sendCommand`, a `withSession` helper for one-shot capabilities,
  and an event subscription fan-out for diagnostics.
- `operator/dispatch.js` holds the single op registry, consults the mode, blocks
  page-authority ops when governed, and offers every dispatch to an optional
  audit sink so the ungoverned lane stays inspectable. The sink can never block
  or break dispatch.
- All capability modules take an injected `chromeApi`, so mode, dispatch, and
  navigation are unit-tested without a browser
  (`test/operator-mode.test.js`, `test/operator-dispatch.test.js`).

## Risk surface (ungoverned mode)

This lane intentionally removes the guarantees the governed product is built on.
When ungoverned:

- arbitrary JavaScript runs with the page's full authority and bypasses CSP;
- input is dispatched at the OS/DevTools level, indistinguishable from the user;
- console and network metadata that the governed path excludes become readable;
- `<all_urls>` host permission means any site is in scope.

Mitigations present: default-governed, explicit persisted opt-in, a visible
warning, Chrome's debugger banner, scheme guards on navigation
(`javascript:`, `data:`, `file:`, `chrome:` refused), an audit hook on every
dispatch, and a thin safety floor (`operator/guards.js`) that applies even in
ungoverned mode: a page-acting op (`click`, `type`, `press_key`, `evaluate`)
against a money-movement origin requires an explicit `{ confirmed: true }`. The
floor is deliberately broad on host matching and fails open on unresolved URLs;
it stops the obvious "a page told it to pay" case, it is not a substitute for
the governed lane.

## Known follow-ups

- Wire the audit hook to the server audit trail rather than `console.debug`, so
  ungoverned actions land in the same append-only record as governed ones.
- Add an MCP tool surface for these ops if remote drive is wanted; today they
  are reachable only from the extension's own message channel and UI.
- CDP-dependent capabilities (vision, scripting, diagnostics) are covered by
  contract and unit tests for routing and guards; end-to-end coverage needs a
  real Chrome via `test/chrome-acceptance.mjs`.
