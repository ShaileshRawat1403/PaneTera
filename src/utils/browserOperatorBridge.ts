const UI_SOURCE = 'panetera-ui';
const OPERATOR_SOURCE = 'panetera-browser-operator';

export interface BrowserObservationResult {
  captureId: string;
}

export interface BrowserOperatorStatus {
  paired: boolean;
  extensionAvailable: boolean;
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
