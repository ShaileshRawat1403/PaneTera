// chrome-extension/operator/debugging.js
//
// Diagnostics surface: console messages and network requests captured via the
// DevTools protocol. This reads data PaneTera's governed path deliberately
// excludes (request/response metadata, console output), so it is ungoverned-
// mode only and runs as an explicit start -> collect -> stop session.

import { attach, detach, send, subscribe } from './cdp.js';

const MAX_ENTRIES = 500;

/**
 * @type {Map<number, { console: any[], network: any[], unsubscribe: () => void }>}
 */
const sessions = new Map();

function push(list, entry) {
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.shift();
}

/**
 * Begin capturing console + network for a tab.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId: number }} params
 */
export async function startDiagnostics(chromeApi, params) {
  const tabId = params.tabId;
  if (typeof tabId !== 'number') throw new Error('startDiagnostics requires a tabId');
  if (sessions.has(tabId)) return { tabId, already: true };

  await attach(chromeApi, tabId);
  const store = { console: [], network: [], unsubscribe: () => {} };

  store.unsubscribe = subscribe(tabId, (method, p) => {
    switch (method) {
      case 'Runtime.consoleAPICalled':
        push(store.console, {
          level: p.type,
          text: (p.args || []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? '').join(' '),
          ts: p.timestamp,
        });
        break;
      case 'Log.entryAdded':
        push(store.console, { level: p.entry.level, text: p.entry.text, url: p.entry.url, ts: p.entry.timestamp });
        break;
      case 'Network.requestWillBeSent':
        push(store.network, {
          requestId: p.requestId, phase: 'request',
          method: p.request?.method, url: p.request?.url, ts: p.timestamp,
        });
        break;
      case 'Network.responseReceived':
        push(store.network, {
          requestId: p.requestId, phase: 'response',
          status: p.response?.status, mimeType: p.response?.mimeType, url: p.response?.url, ts: p.timestamp,
        });
        break;
      case 'Network.loadingFailed':
        push(store.network, { requestId: p.requestId, phase: 'failed', error: p.errorText, ts: p.timestamp });
        break;
      default:
        break;
    }
  });

  sessions.set(tabId, store);
  await send(chromeApi, tabId, 'Runtime.enable');
  await send(chromeApi, tabId, 'Log.enable');
  await send(chromeApi, tabId, 'Network.enable');
  return { tabId, started: true };
}

/**
 * Read what has been captured so far without stopping.
 * @param {{ tabId: number, kind?: 'console'|'network'|'all' }} params
 */
export function getDiagnostics(params) {
  const store = sessions.get(params.tabId);
  if (!store) throw new Error(`No diagnostics session for tab ${params.tabId}. Call startDiagnostics first.`);
  const kind = params.kind ?? 'all';
  return {
    tabId: params.tabId,
    console: kind === 'network' ? [] : store.console.slice(),
    network: kind === 'console' ? [] : store.network.slice(),
  };
}

/**
 * Stop capture, return the final buffer, and detach.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId: number }} params
 */
export async function stopDiagnostics(chromeApi, params) {
  const store = sessions.get(params.tabId);
  if (!store) return { tabId: params.tabId, stopped: false };
  const snapshot = { console: store.console.slice(), network: store.network.slice() };
  store.unsubscribe();
  sessions.delete(params.tabId);
  try {
    await send(chromeApi, params.tabId, 'Network.disable');
    await send(chromeApi, params.tabId, 'Log.disable');
  } catch { /* tab may be gone */ }
  await detach(chromeApi, params.tabId);
  return { tabId: params.tabId, stopped: true, ...snapshot };
}

/** Test helper. */
export function activeSessionCount() {
  return sessions.size;
}
