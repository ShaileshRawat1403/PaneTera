// chrome-extension/operator/script.js
//
// In-page JavaScript execution. This is the largest power jump and the largest
// governance hole: in ungoverned mode it runs arbitrary code with the page's
// full authority and bypasses page CSP via the DevTools protocol. It is only
// reachable when the operator mode toggle is set to ungoverned.
//
// Two mechanisms:
//   - evaluate(): arbitrary expression via CDP Runtime.evaluate, returns value.
//   - executeFunc(): structured chrome.scripting injection of a named function.

import { withSession } from './cdp.js';

/**
 * Evaluate an arbitrary JavaScript expression in the page's main world and
 * return the result by value. Awaits promises by default.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, expression: string, awaitPromise?: boolean, timeoutMs?: number }} params
 */
export async function evaluate(chromeApi, params) {
  if (typeof params.expression !== 'string' || params.expression.length === 0) {
    throw new Error('evaluate requires a non-empty expression string');
  }
  const tabId = await resolveTabId(chromeApi, params.tabId);
  return withSession(chromeApi, tabId, async (send) => {
    await send('Runtime.enable');
    const result = await send('Runtime.evaluate', {
      expression: params.expression,
      returnByValue: true,
      awaitPromise: params.awaitPromise !== false,
      userGesture: true,
      timeout: params.timeoutMs ?? 15_000,
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || 'Evaluation threw';
      throw new Error(text);
    }
    return { tabId, value: result.result?.value ?? null, type: result.result?.type ?? null };
  });
}

/**
 * Inject a named function via chrome.scripting. Safer than evaluate() because
 * the source is a real function reference rather than a string, but still
 * ungoverned. world defaults to MAIN so the function sees the page's globals.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, func: Function, args?: unknown[], world?: 'MAIN'|'ISOLATED' }} params
 */
export async function executeFunc(chromeApi, params) {
  if (typeof params.func !== 'function') {
    throw new Error('executeFunc requires a function');
  }
  const tabId = await resolveTabId(chromeApi, params.tabId);
  const injection = await chromeApi.scripting.executeScript({
    target: { tabId },
    world: params.world ?? 'MAIN',
    func: params.func,
    args: params.args ?? [],
  });
  return { tabId, results: injection.map((r) => r.result) };
}

/**
 * Read the rendered text of the page. Convenience over evaluate().
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, maxChars?: number }} [params]
 */
export async function readPageText(chromeApi, params = {}) {
  const max = params.maxChars ?? 200_000;
  const out = await evaluate(chromeApi, {
    tabId: params.tabId,
    expression: `(() => { const t = document.body ? document.body.innerText : ''; return t.slice(0, ${max}); })()`,
  });
  return { tabId: out.tabId, text: out.value ?? '', truncated: (out.value?.length ?? 0) >= max };
}

async function resolveTabId(chromeApi, tabId) {
  if (typeof tabId === 'number') return tabId;
  const [active] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  if (!active) throw new Error('No active tab for script execution');
  return active.id;
}
