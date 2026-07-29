// chrome-extension/operator/dispatch.js
//
// Central dispatch for the full-operator surface. One registry maps op names to
// handlers, and the governance toggle decides whether an op may run.
//
// Toggle semantics (matches the user's "governance vs non" switch):
//   - governed mode:  only page-authority-free introspection is allowed
//                     (listing tabs). Every op that navigates, scripts,
//                     dispatches input, or attaches the debugger is refused
//                     with a hint to enable full-operator mode. The existing
//                     propose/approve pipeline remains the governed way to act.
//   - ungoverned mode: every op executes directly, no approval gate.
//
// Even in ungoverned mode every dispatch is offered to an optional audit sink,
// so the ungoverned lane stays inspectable. The sink never blocks execution.

import { getMode, UNGOVERNED } from './mode.js';
import * as navigation from './navigation.js';
import * as script from './script.js';
import * as vision from './vision.js';
import * as debugging from './debugging.js';

/**
 * op -> { fn, governedAllowed, needsChromeApi }
 * governedAllowed=true means the op has no page authority and may run in either
 * mode. Everything else requires the ungoverned toggle.
 */
const REGISTRY = {
  // Navigation and tabs
  'navigate':      { fn: (api, p) => navigation.navigate(api, p) },
  'open_tab':      { fn: (api, p) => navigation.openTab(api, p) },
  'close_tab':     { fn: (api, p) => navigation.closeTab(api, p) },
  'activate_tab':  { fn: (api, p) => navigation.activateTab(api, p) },
  'list_tabs':     { fn: (api, p) => navigation.listTabs(api, p), governedAllowed: true },
  'resize_window': { fn: (api, p) => navigation.resizeWindow(api, p) },

  // In-page scripting
  'evaluate':       { fn: (api, p) => script.evaluate(api, p) },
  'read_page_text': { fn: (api, p) => script.readPageText(api, p) },

  // Vision and coordinate control
  'screenshot': { fn: (api, p) => vision.screenshot(api, p) },
  'click':      { fn: (api, p) => vision.click(api, p) },
  'move_mouse': { fn: (api, p) => vision.moveMouse(api, p) },
  'scroll':     { fn: (api, p) => vision.scroll(api, p) },
  'type':       { fn: (api, p) => vision.typeText(api, p) },
  'press_key':  { fn: (api, p) => vision.pressKey(api, p) },

  // Diagnostics
  'diagnostics_start': { fn: (api, p) => debugging.startDiagnostics(api, p) },
  'diagnostics_get':   { fn: (_api, p) => debugging.getDiagnostics(p) },
  'diagnostics_stop':  { fn: (api, p) => debugging.stopDiagnostics(api, p) },
};

export function knownOps() {
  return Object.keys(REGISTRY);
}

/**
 * Dispatch one operator op.
 * @param {typeof chrome} chromeApi
 * @param {{ op: string, params?: object }} message
 * @param {{ onAudit?: (event: object) => void }} [adapters]
 * @returns {Promise<{ ok: boolean, op: string, mode: string, result?: any, error?: string, blocked?: boolean }>}
 */
export async function dispatchOperator(chromeApi, message, adapters = {}) {
  const op = message?.op;
  const params = message?.params ?? {};
  const entry = REGISTRY[op];
  const mode = await getMode(chromeApi);
  const audit = (event) => { try { adapters.onAudit?.(event); } catch { /* audit must never break dispatch */ } };

  if (!entry) {
    audit({ op, mode, ok: false, reason: 'unknown-op', ts: Date.now() });
    return { ok: false, op, mode, error: `Unknown operator op: ${String(op)}` };
  }

  const ungoverned = mode === UNGOVERNED;
  if (!ungoverned && !entry.governedAllowed) {
    audit({ op, mode, ok: false, reason: 'blocked-governed', ts: Date.now() });
    return {
      ok: false,
      op,
      mode,
      blocked: true,
      error: `"${op}" needs full-operator mode. Toggle governance off to run it directly, or use the governed propose/approve path.`,
    };
  }

  try {
    const result = await entry.fn(chromeApi, params);
    audit({ op, mode, ok: true, ts: Date.now() });
    return { ok: true, op, mode, result };
  } catch (err) {
    audit({ op, mode, ok: false, reason: 'threw', message: String(err?.message ?? err), ts: Date.now() });
    return { ok: false, op, mode, error: String(err?.message ?? err) };
  }
}
