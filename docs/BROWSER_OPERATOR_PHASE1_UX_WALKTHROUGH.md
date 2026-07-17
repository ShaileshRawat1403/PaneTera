# Tessera Browser Operator Phase 1 UX Walkthrough

This document outlines the final manual acceptance pass for the Tessera Browser Operator extension's UX interaction model.

## Preparation
1. **Reload Unpacked Extension:** Open `chrome://extensions/`, enable Developer Mode, and click the refresh icon on the Tessera extension card.
2. **Pair Extension:** Start the local Tessera Portal (`npm run dev`), open the Testing Cockpit, generate a pairing code, click the extension icon, and connect the operator.
3. **Verify Side Panel:** Click "Open Tessera Side Panel" from the popup. Confirm it opens correctly, says "Tessera Browser Operator", and shows Governed Read-Only connected state.

## Manual Test Execution

### A. Popup Capture
1. Open the popup.
2. Confirm the UI shows the green `status-connected` badge.
3. Click "Capture Web Context".
4. **Verification:** The context is captured successfully. Open the Tessera Workbench Intelligence Feed and confirm the observation (URL, Title, and selected text if any) is visible.
5. **Orchestrator Grounding:** Confirm the backend log output displays the correctly formed observation request without cross-origin pollution.

### B. Selection Context Menu
1. Select text on any normal HTTP/HTTPS web page (e.g., a Wikipedia article).
2. Right-click the selection.
3. Choose "Send selection to Tessera".
4. **Verification:** A native Chrome notification appears with Title "Tessera" and message "Context sent successfully".
5. **Capability:** Backend confirms receipt of `browser.selection.observe` containing the `selectedText`.

### C. Page Context Menu
1. Right-click on a blank area of the page (no text selected).
2. Choose "Send page to Tessera".
3. **Verification:** Notification confirms success.
4. **Capability:** Backend confirms receipt of `browser.page.observe` and `selectedText` is explicitly omitted/absent from the payload.

### D. Keyboard Shortcut
1. Press `Command+Shift+K` (macOS) or `Ctrl+Shift+K` (Windows/Linux).
2. **Verification:** Capture triggers silently in the background, confirmed by the success notification.
3. Open `chrome://extensions/shortcuts` and confirm the shortcut can be customized.
4. (To test unassigned): Clear the shortcut mapping and reload the extension. A notification will appear: "Capture shortcut is not assigned. Configure it in chrome://extensions/shortcuts."

### E. Restricted Pages
1. Open a new tab (`chrome://newtab/`) or `chrome://extensions/`.
2. Press the keyboard shortcut.
3. **Verification:** A native error notification appears: "Tessera capture failed: This Chrome page cannot be captured. Open a normal HTTP or HTTPS page."
4. The backend receives no requests.

### F. Side Panel Persistence
1. Close and reopen the Side Panel.
2. Leave the browser idle to allow the service worker to sleep.
3. Re-open the side panel.
4. **Verification:** The side panel correctly wakes the service worker and restores the connected state instantly without requiring a new pairing code.

### G. Disconnected State
1. Click "Disconnect" in the Side Panel or Popup.
2. **Verification:** Tokens are purged.
3. Attempt to use the context menu or shortcut.
4. **Verification:** A native error notification appears explaining that the session is invalid or the gateway is unavailable. No silent queueing occurs.

## Privacy Validation
- **System Notifications:** Notifications only display structural status ("Context sent successfully" or a clean error message). They NEVER contain selected text, URLs, page titles, or tokens.
- **Console Logs:** Background script logs are completely sanitized and do not leak cryptographic portal tokens, access tokens, or refresh tokens.

## End of Phase 1
The Phase 1 interaction model is strictly enforced:
- **Popup:** Deliberate full-page capture
- **Right-click:** Precise content/page capture
- **Shortcut:** Fast reflex capture
- **Side panel:** Persistent browser companion
- **Workbench:** Central intelligence, orchestration, and audit log

Phase 1 is complete. No scraping, arbitrary navigation, or Phase 2 capabilities have been introduced.
