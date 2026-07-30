# Operator Phase 1 Validation Checklist

**Branch:** `feature/full-operator-extension`
**Purpose:** Prove the ungoverned operator capabilities actually work in real
Chrome, since the CDP paths (screenshot, coordinate input, `evaluate`,
diagnostics) are unit-tested for routing and guards but not for live
DevTools-protocol behavior.

Automated validation from the build sandbox is not possible: it cannot install
an unpacked extension and has no local Chromium. So this runs on your machine.
The extension ships a dev harness page, `test-operator.html`, that triggers
every op and shows the JSON result, so each check below is one click. The
harness is excluded from the packaged zip.

## Setup

1. Load the extension: open `chrome://extensions`, enable Developer mode, click
   "Load unpacked", and select
   `MYAIAGENTS/PaneTera-operator/chrome-extension`.
2. Note the extension ID Chrome assigns.
3. Open the harness: navigate to
   `chrome-extension://<EXTENSION_ID>/test-operator.html` in a tab.
4. In a separate tab, open a normal page to operate on, for example
   `https://example.com`. The harness targets the most recently used
   http/https tab, never itself.

Operator ops do not require pairing with the PaneTera app. Pairing is only for
the governed capture flow.

## Governance toggle

- [ ] Harness shows **Mode: governed** (green) on load.
- [ ] With mode governed, click `screenshot`. Expect `ok: false`,
      `blocked: true`, and a message to enable full-operator mode. This proves
      acting ops are refused while governed.
- [ ] Click `list_tabs` while governed. Expect `ok: true` with a tab list, since
      it has no page authority.
- [ ] Click **Toggle governance**. Mode shows **ungoverned** (red).

Run the rest with mode ungoverned.

## Navigation and tabs

- [ ] `list_tabs` returns your open tabs with url and title.
- [ ] `navigate` (URL `https://example.com`) drives the target tab there and
      returns the final url and title.
- [ ] `open_tab` opens a new tab at the URL.
- [ ] Watch for Chrome's "started debugging this browser" banner appearing when
      CDP ops run. This is expected and must not be dismissed by the extension.

## Vision (CDP Input / Page)

- [ ] `screenshot` returns a `dataUrl` and the image renders in the harness.
- [ ] `full-page shot` returns a taller image than the viewport.
- [ ] Set click x,y over a link or button on the target page and click `click`.
      Confirm the click lands where expected on the target tab.

## Scripting (CDP Runtime)

- [ ] `evaluate` with `document.title` returns the target page's title as
      `result.value`.
- [ ] `evaluate` with `1 + 1` returns `2`.
- [ ] `read_page_text` returns the rendered text of the target page.
- [ ] `type` with focus in a text field on the target page inserts the text.

## Diagnostics (CDP Network / Runtime / Log)

- [ ] Click `start`, then reload the target tab, then `get`. Expect `console`
      and `network` arrays with entries from the reload.
- [ ] `stop` returns a final snapshot and detaches (banner clears if no other
      session is active).

## Thin safety floor (applies even ungoverned)

- [ ] Open a sensitive origin in the target tab, for example
      `https://www.paypal.com`.
- [ ] With mode ungoverned, click `click` (or `type`). Expect `ok: false`,
      `blocked: true`, `reason: "sensitive-origin"`, and a message to re-issue
      with `{ confirmed: true }`.
- [ ] Non-acting ops on the same origin (`screenshot`, `list_tabs`) still run.

## What to record

For each failed check, capture the op, the params, and the JSON result. CDP
param mistakes usually surface as an `error` string from the DevTools protocol
(for example an unknown method or an invalid argument), which points directly at
the module and command to fix.

## Optional: reviewer-driven run

Once the extension is loaded, the harness page can also be driven through your
connected Chrome via the browser tooling, so validation can be observed live
rather than only self-reported. Ask for this if you want it.
