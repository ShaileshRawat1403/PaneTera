// Narrow bridge between PaneTera's local UI and the Browser Operator.
// It carries only short-lived pairing requests. Tokens never enter the page.
const PANETERA_UI_SOURCE = 'panetera-ui';
const OPERATOR_SOURCE = 'panetera-browser-operator';
const PORT_NAME = 'panetera-local-bridge';
const allowedOrigin = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/;

function reply(type, detail = {}) {
  window.postMessage({ source: OPERATOR_SOURCE, type, ...detail }, window.location.origin);
}

let active = false;
let version = '';
let port = null;
const pending = new Map();
let suspendedForBackForwardCache = false;

function connectPort() {
  if (active && port) return true;
  try {
    version = chrome.runtime.getManifest().version;
    const nextPort = chrome.runtime.connect({ name: PORT_NAME });
    port = nextPort;
    active = true;
    nextPort.onDisconnect.addListener(() => {
      if (port !== nextPort) return;
      // Reading lastError is required in a Chrome callback. Ignoring it leaves
      // an "Unchecked runtime.lastError" on the extension and also discards
      // the only reliable explanation Chrome gives for BFCache suspension.
      let disconnectReason = '';
      try {
        disconnectReason = chrome.runtime.lastError?.message || '';
      } catch {
        // A genuinely reloaded extension can invalidate the old JS context.
      }
      active = false;
      port = null;
      pending.clear();
      // Chrome closes extension ports when their page enters BFCache. That is
      // a normal suspension, not an extension update. `pageshow` reconnects
      // the restored document; announcing RELOAD_REQUIRED here made the bridge
      // permanently unusable after an ordinary tab transition.
      const movedToBackForwardCache = /back\/forward cache/i.test(disconnectReason);
      if (!suspendedForBackForwardCache && !movedToBackForwardCache) reply('RELOAD_REQUIRED');
    });
    nextPort.onMessage.addListener((response) => {
      if (port !== nextPort) return;
      const request = pending.get(response?.requestId);
      if (!request) return;
      pending.delete(response.requestId);
      request(response);
    });
    return true;
  } catch {
    active = false;
    port = null;
    return false;
  }
}

window.addEventListener('pagehide', (event) => {
  suspendedForBackForwardCache = Boolean(event.persisted);
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  suspendedForBackForwardCache = false;
  if (active || !connectPort()) return;
  reply('READY', { version });
});

if (connectPort()) reply('READY', { version });
else reply('RELOAD_REQUIRED');

function requestExtension(message, onResponse) {
  // A transient Chrome port closure is recoverable while the extension context
  // is still valid. An actual extension reload makes connectPort() throw, and
  // still takes the explicit RELOAD_REQUIRED path.
  if ((!active || !port) && !connectPort()) {
    reply('RELOAD_REQUIRED', { nonce: message.requestId });
    return;
  }
  pending.set(message.requestId, onResponse);
  try {
    port.postMessage(message);
  } catch {
    active = false;
    pending.delete(message.requestId);
    reply('RELOAD_REQUIRED', { nonce: message.requestId });
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !allowedOrigin.test(event.origin)) return;
  const message = event.data;
  if (!message || message.source !== PANETERA_UI_SOURCE) return;

  if (message.type === 'PING') {
    if (!active) connectPort();
    if (active) reply('READY', { version, nonce: message.nonce });
    else reply('RELOAD_REQUIRED', { nonce: message.nonce });
    return;
  }

  if (message.type === 'PAIRING_CANCEL') {
    requestExtension({ type: 'dismiss-pending-pairing', requestId: message.nonce }, () => {
      reply('PAIRING_CANCELLED', { nonce: message.nonce });
    });
    return;
  }

  if (message.type === 'OBSERVE_WEB') {
    requestExtension({
      type: 'request-web-observation',
      url: message.url,
      requestId: message.nonce,
    }, (response) => {
      reply('WEB_OBSERVATION_RESULT', {
        success: Boolean(response?.success),
        captureId: response?.captureId,
        error: response?.error,
        nonce: message.nonce,
      });
    });
    return;
  }

  if (message.type === 'STATUS_CHECK') {
    requestExtension({ type: 'check-status', requestId: message.nonce }, (response) => {
      reply('OPERATOR_STATUS', {
        paired: Boolean(response?.paired),
        error: response?.error,
        nonce: message.nonce,
      });
    });
    return;
  }

  if (message.type !== 'PAIRING_OFFER') return;
  requestExtension({ type: 'offer-pairing', code: message.code, requestId: message.nonce }, (response) => {
    reply('PAIRING_OFFER_RESULT', {
      success: Boolean(response?.success),
      nonce: message.nonce,
    });
  });
});
