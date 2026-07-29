// chrome-extension/operator/navigation.js
//
// Navigation and multi-tab orchestration. Pure chrome.tabs / chrome.windows,
// no CDP required. chromeApi is injected for testability.

const NAVIGABLE_SCHEMES = new Set(['http:', 'https:', 'about:']);

function assertNavigable(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${String(url)}`);
  }
  if (!NAVIGABLE_SCHEMES.has(parsed.protocol)) {
    // Block javascript:, data:, file:, chrome: and extension schemes from the
    // navigation surface. In-page scripting has its own explicit capability.
    throw new Error(`Refusing to navigate to unsupported scheme: ${parsed.protocol}`);
  }
  return parsed.href;
}

function waitForComplete(chromeApi, tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      chromeApi.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      fn(arg);
    };
    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        finish(resolve, tabId);
      }
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`Navigation timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    chromeApi.tabs.onUpdated.addListener(onUpdated);
    // Guard against a page that is already complete before the listener bound.
    chromeApi.tabs.get(tabId).then((tab) => {
      if (tab && tab.status === 'complete') finish(resolve, tabId);
    }).catch(() => { /* tab.get may reject if the id is stale; the timer covers it */ });
  });
}

/**
 * Navigate a tab to a URL and optionally wait for load.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, url: string, waitForLoad?: boolean, timeoutMs?: number }} params
 */
export async function navigate(chromeApi, params) {
  const href = assertNavigable(params.url);
  let tabId = params.tabId;
  if (typeof tabId !== 'number') {
    const [active] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (!active) throw new Error('No active tab to navigate');
    tabId = active.id;
  }
  await chromeApi.tabs.update(tabId, { url: href });
  if (params.waitForLoad !== false) {
    await waitForComplete(chromeApi, tabId, params.timeoutMs);
  }
  const tab = await chromeApi.tabs.get(tabId);
  return { tabId, url: tab?.url ?? href, title: tab?.title ?? null, status: tab?.status ?? null };
}

/**
 * Open a new tab.
 * @param {typeof chrome} chromeApi
 * @param {{ url?: string, active?: boolean, waitForLoad?: boolean, timeoutMs?: number }} params
 */
export async function openTab(chromeApi, params = {}) {
  const url = params.url ? assertNavigable(params.url) : undefined;
  const tab = await chromeApi.tabs.create({ url, active: params.active !== false });
  if (url && params.waitForLoad !== false) {
    await waitForComplete(chromeApi, tab.id, params.timeoutMs);
  }
  const fresh = await chromeApi.tabs.get(tab.id);
  return { tabId: tab.id, url: fresh?.url ?? url ?? null, title: fresh?.title ?? null };
}

/**
 * Close one or more tabs.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId: number | number[] }} params
 */
export async function closeTab(chromeApi, params) {
  const ids = Array.isArray(params.tabId) ? params.tabId : [params.tabId];
  await chromeApi.tabs.remove(ids);
  return { closed: ids };
}

/**
 * Focus/activate a tab (and its window).
 * @param {typeof chrome} chromeApi
 * @param {{ tabId: number }} params
 */
export async function activateTab(chromeApi, params) {
  const tab = await chromeApi.tabs.update(params.tabId, { active: true });
  if (tab?.windowId != null && chromeApi.windows?.update) {
    await chromeApi.windows.update(tab.windowId, { focused: true });
  }
  return { tabId: params.tabId, active: true };
}

/**
 * List open tabs, optionally filtered by a query (e.g. { currentWindow: true }).
 * Returns a compact, non-sensitive projection.
 * @param {typeof chrome} chromeApi
 * @param {{ query?: object }} [params]
 */
export async function listTabs(chromeApi, params = {}) {
  const tabs = await chromeApi.tabs.query(params.query ?? {});
  return {
    tabs: tabs.map((t) => ({
      tabId: t.id,
      url: t.url ?? null,
      title: t.title ?? null,
      active: !!t.active,
      windowId: t.windowId ?? null,
      status: t.status ?? null,
    })),
  };
}

/**
 * Resize the tab's window.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, width: number, height: number }} params
 */
export async function resizeWindow(chromeApi, params) {
  let windowId;
  if (typeof params.tabId === 'number') {
    const tab = await chromeApi.tabs.get(params.tabId);
    windowId = tab?.windowId;
  } else {
    const [active] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    windowId = active?.windowId;
  }
  if (windowId == null) throw new Error('No window to resize');
  await chromeApi.windows.update(windowId, { width: params.width, height: params.height, state: 'normal' });
  return { windowId, width: params.width, height: params.height };
}
