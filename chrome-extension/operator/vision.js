// chrome-extension/operator/vision.js
//
// Vision and coordinate control via the DevTools protocol Input and Page
// domains. Screenshots plus real mouse/keyboard dispatch at pixel coordinates,
// for pages that resist structured selectors. Ungoverned-mode only.

import { withSession } from './cdp.js';

const MOUSE_BUTTONS = { left: 1, right: 2, middle: 4, none: 0 };

/**
 * Capture a screenshot of the tab. Returns a base64 data URL.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, format?: 'png'|'jpeg', quality?: number, fullPage?: boolean }} params
 */
export async function screenshot(chromeApi, params = {}) {
  const tabId = await resolveTabId(chromeApi, params.tabId);
  const format = params.format ?? 'png';
  return withSession(chromeApi, tabId, async (send) => {
    await send('Page.enable');
    const options = { format, captureBeyondViewport: !!params.fullPage };
    if (format === 'jpeg') options.quality = params.quality ?? 80;
    if (params.fullPage) {
      const metrics = await send('Page.getLayoutMetrics');
      const size = metrics.cssContentSize || metrics.contentSize;
      if (size) {
        options.clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
      }
    }
    const shot = await send('Page.captureScreenshot', options);
    return { tabId, format, dataUrl: `data:image/${format};base64,${shot.data}` };
  });
}

/**
 * Click at page coordinates.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, x: number, y: number, button?: 'left'|'right'|'middle', clickCount?: number }} params
 */
export async function click(chromeApi, params) {
  requireCoords(params);
  const tabId = await resolveTabId(chromeApi, params.tabId);
  const button = params.button ?? 'left';
  const clickCount = params.clickCount ?? 1;
  return withSession(chromeApi, tabId, async (send) => {
    const base = { x: params.x, y: params.y, button, buttons: MOUSE_BUTTONS[button] ?? 1, clickCount };
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: params.x, y: params.y, button: 'none', buttons: 0 });
    await send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
    await send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
    return { tabId, x: params.x, y: params.y, button, clickCount };
  });
}

/**
 * Move the mouse without clicking.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, x: number, y: number }} params
 */
export async function moveMouse(chromeApi, params) {
  requireCoords(params);
  const tabId = await resolveTabId(chromeApi, params.tabId);
  return withSession(chromeApi, tabId, async (send) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: params.x, y: params.y, button: 'none', buttons: 0 });
    return { tabId, x: params.x, y: params.y };
  });
}

/**
 * Scroll via a synthesized wheel event at a point.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, x?: number, y?: number, deltaX?: number, deltaY?: number }} params
 */
export async function scroll(chromeApi, params = {}) {
  const tabId = await resolveTabId(chromeApi, params.tabId);
  const x = params.x ?? 0;
  const y = params.y ?? 0;
  return withSession(chromeApi, tabId, async (send) => {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x, y, button: 'none', buttons: 0,
      deltaX: params.deltaX ?? 0, deltaY: params.deltaY ?? 0,
    });
    return { tabId, deltaX: params.deltaX ?? 0, deltaY: params.deltaY ?? 0 };
  });
}

/**
 * Type text using CDP insertText (fires input events on the focused element).
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, text: string }} params
 */
export async function typeText(chromeApi, params) {
  if (typeof params.text !== 'string') throw new Error('typeText requires text');
  const tabId = await resolveTabId(chromeApi, params.tabId);
  return withSession(chromeApi, tabId, async (send) => {
    await send('Input.insertText', { text: params.text });
    return { tabId, length: params.text.length };
  });
}

/**
 * Press a named key (Enter, Tab, Escape, ArrowDown, etc.) with optional
 * modifiers. Sends keyDown then keyUp.
 * @param {typeof chrome} chromeApi
 * @param {{ tabId?: number, key: string, code?: string, modifiers?: number }} params
 */
export async function pressKey(chromeApi, params) {
  if (typeof params.key !== 'string') throw new Error('pressKey requires a key');
  const tabId = await resolveTabId(chromeApi, params.tabId);
  return withSession(chromeApi, tabId, async (send) => {
    const evt = { key: params.key, code: params.code ?? params.key, modifiers: params.modifiers ?? 0 };
    await send('Input.dispatchKeyEvent', { ...evt, type: 'keyDown' });
    await send('Input.dispatchKeyEvent', { ...evt, type: 'keyUp' });
    return { tabId, key: params.key };
  });
}

function requireCoords(params) {
  if (typeof params?.x !== 'number' || typeof params?.y !== 'number') {
    throw new Error('x and y coordinates are required');
  }
}

async function resolveTabId(chromeApi, tabId) {
  if (typeof tabId === 'number') return tabId;
  const [active] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  if (!active) throw new Error('No active tab for vision capability');
  return active.id;
}
