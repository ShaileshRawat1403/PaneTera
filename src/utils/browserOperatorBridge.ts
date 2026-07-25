const UI_SOURCE = 'panetera-ui';
const OPERATOR_SOURCE = 'panetera-browser-operator';

export interface BrowserObservationResult {
  captureId: string;
}

export interface BrowserOperatorStatus {
  paired: boolean;
  extensionAvailable: boolean;
}

export interface BrowserLiveFrame {
  sessionId: string;
  title: string;
  url: string;
  screenshotDataUrl: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  capturedAt: string;
}

export interface BrowserInspectedComponent {
  tagName: string;
  id: string;
  classNames: string[];
  role: string;
  text: string;
  attributes: Record<string, string>;
  path: string;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
}

export type BrowserLiveAction = 'snapshot' | 'inspect' | 'focus' | 'close' | 'click' | 'fill' | 'scroll';

const MAX_LIVE_FRAME_DATA_URL_LENGTH = 8_000_000;

function isBoundedString(value: unknown, max: number, allowEmpty = true): value is string {
  return (
    typeof value === 'string' &&
    value.length <= max &&
    (allowEmpty || value.length > 0)
  );
}

function isFiniteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isPublicDisplayUrl(value: unknown): value is string {
  if (!isBoundedString(value, 4_096, false)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isBoundedStringRecord(value: unknown, maxEntries: number, maxValueLength: number): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= maxEntries &&
    entries.every(([key, item]) =>
      isBoundedString(key, 80, false) && isBoundedString(item, maxValueLength)
    )
  );
}

export function isBrowserLiveFrame(value: unknown): value is BrowserLiveFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as Partial<BrowserLiveFrame>;
  return (
    isBoundedString(frame.sessionId, 200, false) &&
    isBoundedString(frame.title, 10_000) &&
    isPublicDisplayUrl(frame.url) &&
    isBoundedString(frame.screenshotDataUrl, MAX_LIVE_FRAME_DATA_URL_LENGTH, false) &&
    /^data:image\/jpeg;base64,/i.test(frame.screenshotDataUrl) &&
    Boolean(frame.viewport) &&
    isFiniteNumber(frame.viewport?.width, 1, 20_000) &&
    isFiniteNumber(frame.viewport?.height, 1, 20_000) &&
    isFiniteNumber(frame.viewport?.devicePixelRatio, 0.1, 20) &&
    isCanonicalTimestamp(frame.capturedAt)
  );
}

export function isBrowserInspectedComponent(value: unknown): value is BrowserInspectedComponent {
  if (!value || typeof value !== 'object') return false;
  const component = value as Partial<BrowserInspectedComponent>;
  const rect = component.rect;
  return (
    isBoundedString(component.tagName, 80, false) &&
    isBoundedString(component.id, 200) &&
    Array.isArray(component.classNames) &&
    component.classNames.length <= 20 &&
    component.classNames.every(item => isBoundedString(item, 200)) &&
    isBoundedString(component.role, 100) &&
    isBoundedString(component.text, 1_000) &&
    isBoundedString(component.path, 1_000) &&
    isBoundedStringRecord(component.attributes, 20, 500) &&
    isBoundedStringRecord(component.styles, 20, 300) &&
    Boolean(rect) &&
    isFiniteNumber(rect?.x, -100_000, 100_000) &&
    isFiniteNumber(rect?.y, -100_000, 100_000) &&
    isFiniteNumber(rect?.width, 0, 100_000) &&
    isFiniteNumber(rect?.height, 0, 100_000)
  );
}

function bridgeRequest<T>({
  requestType,
  responseType,
  payload,
  timeoutMs,
  parse,
}: {
  requestType: string;
  responseType: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
  parse: (message: Record<string, unknown>) => T;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();
    let requested = false;
    const readyTimeout = window.setTimeout(() => {
      finish();
      reject(new Error('Browser Operator is not available on this PaneTera page. Reload PaneTera after reloading the extension.'));
    }, 2_500);
    const timeout = window.setTimeout(() => {
      finish();
      reject(new Error('Browser Operator did not complete the request in time.'));
    }, timeoutMs);

    function finish() {
      window.clearTimeout(readyTimeout);
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data as Record<string, unknown>;
      if (!message || message.source !== OPERATOR_SOURCE || message.nonce !== nonce) return;
      if (message.type === 'RELOAD_REQUIRED') {
        finish();
        reject(new Error('Browser Operator was updated. Reload this PaneTera page once and try again.'));
        return;
      }
      if (message.type === 'READY' && !requested) {
        requested = true;
        window.clearTimeout(readyTimeout);
        window.postMessage({ source: UI_SOURCE, type: requestType, nonce, ...payload }, window.location.origin);
        return;
      }
      if (message.type !== responseType) return;
      finish();
      if (message.success !== true) {
        reject(new Error(typeof message.error === 'string' ? message.error : 'Browser Operator returned an unsuccessful result.'));
        return;
      }
      try {
        resolve(parse(message));
      } catch (error) {
        reject(error);
      }
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ source: UI_SOURCE, type: 'PING', nonce }, window.location.origin);
  });
}

/** Open an approval-gated real Chrome tab and return its first canvas frame. */
export function requestBrowserLiveView(url: string, timeoutMs = 120_000): Promise<BrowserLiveFrame> {
  return bridgeRequest({
    requestType: 'OPEN_WEB_LIVE',
    responseType: 'WEB_LIVE_RESULT',
    payload: { url },
    timeoutMs,
    parse: (message) => {
      if (!isBrowserLiveFrame(message)) throw new Error('Browser Operator returned an invalid live-view frame.');
      return message;
    },
  });
}

/** Refresh, inspect, focus, scroll, click, fill, or close one managed Chrome live-view session. */
export function requestBrowserLiveCommand(
  sessionId: string,
  action: BrowserLiveAction,
  params?: {
    xRatio?: number;
    yRatio?: number;
    cssSelector?: string;
    textValue?: string;
    direction?: 'up' | 'down';
  },
  timeoutMs = 15_000,
): Promise<BrowserLiveFrame | BrowserInspectedComponent | null> {
  return bridgeRequest({
    requestType: 'WEB_LIVE_COMMAND',
    responseType: 'WEB_LIVE_COMMAND_RESULT',
    payload: {
      sessionId,
      action,
      ...(params?.xRatio !== undefined && params?.yRatio !== undefined ? { point: { xRatio: params.xRatio, yRatio: params.yRatio } } : {}),
      ...(params?.cssSelector ? { cssSelector: params.cssSelector } : {}),
      ...(params?.textValue ? { textValue: params.textValue } : {}),
      ...(params?.direction ? { direction: params.direction } : {}),
    },
    timeoutMs,
    parse: (message) => {
      if (action === 'snapshot' || action === 'click' || action === 'fill' || action === 'scroll') {
        if (isBrowserLiveFrame(message)) return message;
        if (isBrowserLiveFrame(message?.frame)) return message.frame;
      }
      if (action === 'inspect') {
        if (!isBrowserInspectedComponent(message.component)) {
          throw new Error('Browser Operator returned invalid component metadata.');
        }
        return message.component;
      }
      return null;
    },
  });
}

/**
 * Ask the extension itself whether it has a usable authenticated session.
 * The server's session list alone can be stale after an extension reload.
 */
export function requestBrowserOperatorStatus(timeoutMs = 3_000): Promise<BrowserOperatorStatus> {
  return new Promise((resolve) => {
    const nonce = crypto.randomUUID();
    let statusRequested = false;
    const timeout = window.setTimeout(() => finish({ paired: false, extensionAvailable: false }), timeoutMs);

    function finish(result: BrowserOperatorStatus) {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(result);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.source !== OPERATOR_SOURCE || message.nonce !== nonce) return;
      if (message.type === 'RELOAD_REQUIRED') {
        finish({ paired: false, extensionAvailable: false });
        return;
      }
      if (message.type === 'READY' && !statusRequested) {
        statusRequested = true;
        window.postMessage({ source: UI_SOURCE, type: 'STATUS_CHECK', nonce }, window.location.origin);
        return;
      }
      if (message.type === 'OPERATOR_STATUS') {
        finish({ paired: message.paired === true, extensionAvailable: true });
      }
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ source: UI_SOURCE, type: 'PING', nonce }, window.location.origin);
  });
}

/**
 * Ask the paired Browser Operator to inspect one explicitly attached public
 * webpage. The extension owns permission approval; PaneTera never receives an
 * extension credential or silently widens browser access.
 */
export function requestWebObservation(url: string, timeoutMs = 120_000): Promise<BrowserObservationResult> {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();
    let inspectionRequested = false;
    const readyTimeout = window.setTimeout(() => {
      finish();
      reject(new Error('Browser Operator is not available on this PaneTera page. Reload PaneTera after reloading the extension.'));
    }, 2_500);
    const timeout = window.setTimeout(() => {
      finish();
      reject(new Error('Browser inspection timed out. Return to PaneTera and try again.'));
    }, timeoutMs);

    function finish() {
      window.clearTimeout(readyTimeout);
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.source !== OPERATOR_SOURCE || message.nonce !== nonce) return;
      if (message.type === 'RELOAD_REQUIRED') {
        finish();
        reject(new Error('Browser Operator was updated. Reload this PaneTera page once and try again.'));
        return;
      }
      if (message.type === 'READY' && !inspectionRequested) {
        inspectionRequested = true;
        window.clearTimeout(readyTimeout);
        window.postMessage({ source: UI_SOURCE, type: 'OBSERVE_WEB', url, nonce }, window.location.origin);
        return;
      }
      if (message.type !== 'WEB_OBSERVATION_RESULT') return;
      finish();
      if (!message.success || typeof message.captureId !== 'string' || !message.captureId) {
        reject(new Error(message.error || 'The Browser Operator did not return readable page evidence.'));
        return;
      }
      resolve({ captureId: message.captureId });
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ source: UI_SOURCE, type: 'PING', nonce }, window.location.origin);
  });
}
