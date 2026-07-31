// chrome-extension/operator/cdp.js
//
// Thin lifecycle wrapper over chrome.debugger (the Chrome DevTools Protocol).
// Ungoverned operator capabilities that need real input dispatch, full-page
// screenshots, or network/console visibility go through here.
//
// Attaching the debugger shows Chrome's "started debugging this browser"
// banner. That banner is intentional and must not be suppressed: it is the
// user's visible signal that the operator holds CDP authority over a tab.
//
// Attachments are reference-counted per tab so concurrent capabilities share
// one session and the last release detaches cleanly.

const PROTOCOL_VERSION = '1.3';

/** @type {Map<number, { refs: number }>} */
const attached = new Map();

/** @type {Map<number, Set<(method: string, params: unknown) => void>>} */
const eventSubscribers = new Map();

let globalListenerBound = false;

function bindGlobalListeners(chromeApi) {
  if (globalListenerBound) return;
  globalListenerBound = true;
  chromeApi.debugger.onEvent.addListener((source, method, params) => {
    const subs = eventSubscribers.get(source.tabId);
    if (!subs) return;
    for (const fn of subs) {
      try { fn(method, params); } catch { /* subscriber errors must not break dispatch */ }
    }
  });
  chromeApi.debugger.onDetach.addListener((source) => {
    attached.delete(source.tabId);
    eventSubscribers.delete(source.tabId);
  });
}

function promisify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const err = globalThis.chrome?.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(result);
    });
  });
}

/**
 * Ensure the debugger is attached to a tab. Reference-counted.
 * @param {typeof chrome} chromeApi
 * @param {number} tabId
 */
export async function attach(chromeApi, tabId) {
  bindGlobalListeners(chromeApi);
  const entry = attached.get(tabId);
  if (entry) {
    entry.refs += 1;
    return;
  }
  await promisify(chromeApi.debugger.attach.bind(chromeApi.debugger), { tabId }, PROTOCOL_VERSION);
  attached.set(tabId, { refs: 1 });
}

/**
 * Release one reference. Detaches when the last reference is gone.
 * @param {typeof chrome} chromeApi
 * @param {number} tabId
 */
export async function detach(chromeApi, tabId) {
  const entry = attached.get(tabId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  attached.delete(tabId);
  eventSubscribers.delete(tabId);
  try {
    await promisify(chromeApi.debugger.detach.bind(chromeApi.debugger), { tabId });
  } catch {
    // Tab may have closed; detaching a gone tab is not an error worth raising.
  }
}

/**
 * Send a CDP command against a tab. Caller is responsible for attach/detach.
 * @param {typeof chrome} chromeApi
 * @param {number} tabId
 * @param {string} method
 * @param {Record<string, unknown>} [params]
 */
export async function send(chromeApi, tabId, method, params = {}) {
  return promisify(
    chromeApi.debugger.sendCommand.bind(chromeApi.debugger),
    { tabId },
    method,
    params,
  );
}

/**
 * Run a unit of work with the debugger attached, detaching afterward even on
 * error. Use this for one-shot capabilities (screenshot, evaluate).
 * @param {typeof chrome} chromeApi
 * @param {number} tabId
 * @param {(send: (method: string, params?: Record<string, unknown>) => Promise<any>) => Promise<T>} work
 * @returns {Promise<T>}
 * @template T
 */
export async function withSession(chromeApi, tabId, work) {
  await attach(chromeApi, tabId);
  try {
    return await work((method, params) => send(chromeApi, tabId, method, params));
  } finally {
    await detach(chromeApi, tabId);
  }
}

/**
 * Subscribe to CDP events for a tab (used by network/console capture). Returns
 * an unsubscribe function. Caller must hold an attach reference for the tab.
 * @param {number} tabId
 * @param {(method: string, params: unknown) => void} handler
 */
export function subscribe(tabId, handler) {
  let subs = eventSubscribers.get(tabId);
  if (!subs) {
    subs = new Set();
    eventSubscribers.set(tabId, subs);
  }
  subs.add(handler);
  return () => {
    subs.delete(handler);
    if (subs.size === 0) eventSubscribers.delete(tabId);
  };
}

/** Test/introspection helper: is a tab currently attached? */
export function isAttached(tabId) {
  return attached.has(tabId);
}
