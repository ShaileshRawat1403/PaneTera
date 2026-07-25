import { redactText, sanitizeUrl } from './shared/redactor.js';
import { normalizePublicHttpUrl } from './shared/validation.js';

const MAX_SESSIONS = 3;
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

function bounded(value, max = 500) {
  return redactText(String(value ?? '').slice(0, max)).redactedText;
}

function safeUrl(value) {
  return sanitizeUrl(String(value ?? ''));
}

function publicIdentity(url) {
  const normalized = normalizePublicHttpUrl(url);
  if (!normalized) throw new Error('Only public HTTP or HTTPS pages can be viewed.');
  return { normalized, origin: new URL(normalized).origin };
}

async function currentTab(session, chromeApi) {
  const tab = await chromeApi.tabs.get(session.tabId);
  if (!tab?.id || !tab.url) throw new Error('The managed Chrome tab is no longer available.');
  const current = publicIdentity(tab.url);
  if (current.origin !== session.approvedOrigin) {
    throw new Error('The managed page navigated outside the approved website. Start a new live view to continue.');
  }
  session.lastActivityAt = Date.now();
  return tab;
}

async function snapshot(session, chromeApi) {
  const tab = await currentTab(session, chromeApi);
  const identityResults = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] },
    func: () => ({
      title: document.title || '',
      url: window.location.href,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    }),
  });
  const identity = identityResults?.[0]?.result;
  if (!identity) throw new Error('The managed page did not return its viewport identity.');
  const screenshotDataUrl = await chromeApi.tabs.captureVisibleTab(session.windowId, {
    format: 'jpeg',
    quality: 72,
  });
  if (typeof screenshotDataUrl !== 'string' || !screenshotDataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new Error('Chrome did not return a readable live-view frame.');
  }
  return {
    sessionId: session.sessionId,
    title: bounded(identity.title, 10_000),
    url: safeUrl(identity.url),
    screenshotDataUrl,
    viewport: {
      width: Number(identity.width) || 1,
      height: Number(identity.height) || 1,
      devicePixelRatio: Number(identity.devicePixelRatio) || 1,
    },
    capturedAt: new Date().toISOString(),
  };
}

async function inspectPoint(session, chromeApi, point) {
  const tab = await currentTab(session, chromeApi);
  const xRatio = Math.min(1, Math.max(0, Number(point?.xRatio)));
  const yRatio = Math.min(1, Math.max(0, Number(point?.yRatio)));
  if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio)) throw new Error('Inspection coordinates are invalid.');
  const results = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] },
    func: ({ xRatio: x, yRatio: y }) => {
      const px = Math.max(0, Math.min(window.innerWidth - 1, x * window.innerWidth));
      const py = Math.max(0, Math.min(window.innerHeight - 1, y * window.innerHeight));
      const element = document.elementFromPoint(px, py);
      if (!(element instanceof Element)) return null;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const allowedAttributes = ['role', 'aria-label', 'aria-labelledby', 'name', 'type', 'title', 'alt', 'href'];
      const attributes = {};
      for (const name of allowedAttributes) {
        const value = element.getAttribute(name);
        if (value) attributes[name] = value;
      }
      const path = [];
      let current = element;
      while (current && path.length < 7) {
        let part = current.tagName.toLowerCase();
        if (current.id) part += `#${current.id}`;
        else if (current.classList.length) part += `.${Array.from(current.classList).slice(0, 2).join('.')}`;
        path.unshift(part);
        current = current.parentElement;
      }
      return {
        tagName: element.tagName.toLowerCase(),
        id: element.id || '',
        classNames: Array.from(element.classList).slice(0, 20),
        role: element.getAttribute('role') || '',
        text: (element.innerText || element.textContent || '').trim().slice(0, 1_000),
        attributes,
        path: path.join(' > '),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: {
          display: style.display,
          position: style.position,
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
        },
      };
    },
    args: [{ xRatio, yRatio }],
  });
  const raw = results?.[0]?.result;
  if (!raw) throw new Error('No inspectable element was found at that point.');
  const attributes = {};
  for (const [key, value] of Object.entries(raw.attributes ?? {})) {
    attributes[bounded(key, 80)] = key === 'href' ? safeUrl(value) : bounded(value, 500);
  }
  return {
    tagName: bounded(raw.tagName, 80),
    id: bounded(raw.id, 200),
    classNames: Array.isArray(raw.classNames) ? raw.classNames.map(value => bounded(value, 200)).slice(0, 20) : [],
    role: bounded(raw.role, 100),
    text: bounded(raw.text, 1_000),
    attributes,
    path: bounded(raw.path, 1_000),
    rect: raw.rect,
    styles: Object.fromEntries(
      Object.entries(raw.styles ?? {}).map(([key, value]) => [bounded(key, 80), bounded(value, 300)])
    ),
  };
}

async function removePermissionWhenUnused(session, chromeApi) {
  if (!session.removeGrantOnClose) return;
  const stillUsed = [...sessions.values()].some(candidate =>
    candidate.sessionId !== session.sessionId && candidate.grantPattern === session.grantPattern
  );
  if (!stillUsed) {
    try { await chromeApi.permissions.remove({ origins: [session.grantPattern] }); } catch {}
  }
}

export async function startLiveSession({
  url,
  consumerTabId,
  permissionWasPreexisting,
}, {
  chromeApi,
  waitForTabReady,
  randomUUID = () => crypto.randomUUID(),
}) {
  if (!Number.isInteger(consumerTabId)) throw new Error('The PaneTera tab identity is unavailable.');
  if (sessions.size >= MAX_SESSIONS) throw new Error('Close an existing Browser Operator live view before opening another.');
  const { normalized, origin } = publicIdentity(url);
  const created = await chromeApi.windows.create({
    url: normalized,
    type: 'popup',
    focused: false,
    width: 1280,
    height: 900,
  });
  const tab = created?.tabs?.[0];
  if (!created?.id || !tab?.id) throw new Error('Chrome did not create the managed browser window.');
  let liveSessionId = '';
  try {
    const readyTab = tab.status === 'complete' ? tab : await waitForTabReady(tab.id);
    const session = {
      sessionId: `live-${randomUUID()}`,
      consumerTabId,
      tabId: readyTab.id,
      windowId: created.id,
      approvedOrigin: origin,
      grantPattern: `${origin}/*`,
      removeGrantOnClose: !permissionWasPreexisting,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    liveSessionId = session.sessionId;
    sessions.set(session.sessionId, session);
    const frame = await snapshot(session, chromeApi);
    return { success: true, ...frame };
  } catch (error) {
    if (liveSessionId) sessions.delete(liveSessionId);
    try { await chromeApi.windows.remove(created.id); } catch {}
    throw error;
  }
}

export async function commandLiveSession({
  sessionId,
  consumerTabId,
  action,
  point,
}, { chromeApi }) {
  const session = sessions.get(sessionId);
  if (!session || session.consumerTabId !== consumerTabId) {
    throw new Error('This Browser Operator live session is unavailable.');
  }
  if (Date.now() - session.lastActivityAt > SESSION_TTL_MS) {
    await closeLiveSession({ sessionId, consumerTabId }, { chromeApi });
    throw new Error('The Browser Operator live session expired.');
  }
  if (action === 'snapshot') return { success: true, ...(await snapshot(session, chromeApi)) };
  if (action === 'inspect') return { success: true, component: await inspectPoint(session, chromeApi, point) };
  if (action === 'focus') {
    await currentTab(session, chromeApi);
    await chromeApi.windows.update(session.windowId, { focused: true });
    return { success: true };
  }
  if (action === 'close') return closeLiveSession({ sessionId, consumerTabId }, { chromeApi });
  throw new Error('Unsupported live-session command.');
}

export async function closeLiveSession({ sessionId, consumerTabId }, { chromeApi }) {
  const session = sessions.get(sessionId);
  if (!session || session.consumerTabId !== consumerTabId) return { success: true };
  sessions.delete(sessionId);
  try { await chromeApi.windows.remove(session.windowId); } catch {}
  await removePermissionWhenUnused(session, chromeApi);
  return { success: true };
}

export async function closeLiveSessionsForTab(tabId, { chromeApi }) {
  const owned = [...sessions.values()].filter(session => session.consumerTabId === tabId || session.tabId === tabId);
  for (const session of owned) {
    sessions.delete(session.sessionId);
    if (session.tabId !== tabId) {
      try { await chromeApi.windows.remove(session.windowId); } catch {}
    }
    await removePermissionWhenUnused(session, chromeApi);
  }
}

export function resetLiveSessionsForTest() {
  sessions.clear();
}
