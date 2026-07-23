// chrome-extension/messageRouting.js
import { redactText, sanitizeUrl } from './shared/redactor.js';

const LOCAL_PANETERA_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/;

async function clearPairingAttention(storage, chromeApi) {
  await storage.clearPendingPairing?.();
  await chromeApi.action?.setBadgeText?.({ text: '' });
  await chromeApi.notifications?.clear?.('panetera-pairing-request');
}

async function pairWithCode(code, storage, transport, chromeApi) {
  const installationId = await storage.getInstallationId();
  const runtimeId = chromeApi.runtime.id;
  const resp = await transport.request('/api/browser/pairing/exchange', {
    method: 'POST',
    body: JSON.stringify({ code, runtimeId, installationId })
  });

  if (!resp.ok) {
    let errMessage = 'Failed to exchange pairing code';
    try {
      const err = await resp.json();
      errMessage = err.error || errMessage;
    } catch (e) {}
    return { success: false, error: errMessage };
  }

  const data = await resp.json();
  await storage.setAccessToken(data.accessToken);
  await storage.setRefreshToken(data.refreshToken);
  await clearPairingAttention(storage, chromeApi);
  return { success: true };
}

export async function handleExtensionMessage(message, adapters, sendResponse, sender = {}) {
  const { storage, transport, chromeApi } = adapters;

  try {
    switch (message.type) {
      case 'pair': {
        sendResponse(await pairWithCode(message.code, storage, transport, chromeApi));
        break;
      }

      case 'offer-pairing': {
        let senderOrigin = '';
        try { senderOrigin = new URL(sender.url || '').origin; } catch {}
        const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
        if (!LOCAL_PANETERA_ORIGIN.test(senderOrigin) || !/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) {
          sendResponse({ success: false, error: 'Invalid local pairing offer.' });
          break;
        }
        await storage.setPendingPairing({
          code,
          requestedAt: Date.now(),
          origin: senderOrigin,
        });
        await chromeApi.action?.setBadgeBackgroundColor?.({ color: '#B88A44' });
        await chromeApi.action?.setBadgeText?.({ text: '1' });
        await chromeApi.tabs.create({
          url: chromeApi.runtime.getURL('pairing.html'),
          active: true,
        });
        sendResponse({ success: true, pending: true, approvalOpened: true });
        break;
      }

      case 'get-pending-pairing': {
        sendResponse({ pendingPairing: await storage.getPendingPairing?.() || null });
        break;
      }

      case 'approve-pending-pairing': {
        const pending = await storage.getPendingPairing?.();
        if (!pending) {
          sendResponse({ success: false, error: 'The pairing request expired. Start again in Rig.' });
          break;
        }
        sendResponse(await pairWithCode(pending.code, storage, transport, chromeApi));
        break;
      }

      case 'dismiss-pending-pairing': {
        await clearPairingAttention(storage, chromeApi);
        sendResponse({ success: true });
        break;
      }

      case 'check-status': {
        try {
          // Always go through the transport. After an extension reload the
          // session-scoped access token is intentionally gone, while the
          // local refresh token remains. The transport can restore the access
          // token on the initial 401 and retry this request once.
          const resp = await transport.request('/api/browser/session');
          if (resp.ok) {
            const data = await resp.json();
            sendResponse({ paired: true, session: data });
          } else {
            await storage.clearTokens();
            sendResponse({ paired: false, pendingPairing: await storage.getPendingPairing?.() || null });
          }
        } catch (e) {
          sendResponse({ paired: false, error: 'Local server unreachable' });
        }
        break;
      }

      case 'capture': {
        const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
        let activeTab = tabs[0];

        if (activeTab && activeTab.url && activeTab.url.startsWith('chrome-extension://')) {
          const allTabs = await chromeApi.tabs.query({ currentWindow: true });
          activeTab = allTabs.slice().reverse().find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
        }

        const capability = message.capability || 'browser.page.observe';
        const result = await performCaptureWithAdapters({ tab: activeTab, trigger: 'popup', capability }, adapters);
        sendResponse(result);
        break;
      }

      case 'disconnect': {
        try {
          await transport.request('/api/browser/session', { method: 'DELETE' });
        } catch (e) {
          console.warn('Network revocation call failed:', e);
        }
        await storage.clearTokens();
        await clearPairingAttention(storage, chromeApi);
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message || 'Background execution error' });
  }
}

export async function performCaptureWithAdapters({ tab, trigger, selectionText, capability = 'browser.page.observe' }, adapters) {
  const { chromeApi, transport, validateOrigin } = adapters;

  if (!tab) {
    throw new Error('No active tab found');
  }

  let tabProtocol = '';
  try { tabProtocol = new URL(tab.url).protocol; } catch {}
  if (!tab.url || (tabProtocol !== 'http:' && tabProtocol !== 'https:')) {
    throw new Error('This Chrome page cannot be captured. Open a normal HTTP or HTTPS page.');
  }

  // 1. Inject dist/capture.bundle.js into explicit frameIds: [0]
  const injectionResults = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] },
    files: ['dist/capture.bundle.js']
  });

  const targetFrameId = (injectionResults && injectionResults[0]) ? (injectionResults[0].frameId || 0) : 0;
  const initialDocumentId = (injectionResults && injectionResults[0]) ? injectionResults[0].documentId : null;

  // Capture raw document identity only for an in-memory equality check. It is
  // never copied into the payload, logs, notifications, or error messages.
  const identityResults = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [targetFrameId] },
    func: () => ({
      origin: window.location.origin,
      url: window.location.href,
      readyState: document.readyState
    })
  });
  if (!identityResults || identityResults.length === 0 || !identityResults[0].result) {
    throw new Error('Initial document identity unavailable');
  }
  const initialIdentity = identityResults[0].result;
  const identityDocumentId = identityResults[0].documentId;

  // 2. Execute extractor capability inside frame 0
  const results = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [targetFrameId] },
    func: (cap) => {
      if (window.PaneTeraExtractors && window.PaneTeraExtractors[cap]) {
        return window.PaneTeraExtractors[cap]();
      }
      throw new Error(`Capability ${cap} not found in PaneTeraExtractors bundle`);
    },
    args: [capability]
  });

  if (!results || results.length === 0 || !results[0].result) {
    throw new Error('Failed to extract DOM elements or structured evidence');
  }

  const extractorDocumentId = results[0].documentId;
  const captureData = results[0].result;
  const expectedOrigin = initialIdentity.origin;

  // 3. Immediately before dispatch: Re-execute check in frameIds: [0]
  const revalResults = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [targetFrameId] },
    func: () => ({
      origin: window.location.origin,
      url: window.location.href,
      readyState: document.readyState
    })
  });

  if (!revalResults || revalResults.length === 0 || !revalResults[0].result) {
    throw new Error('Pre-dispatch revalidation failed: frame unreachable');
  }

  const reval = revalResults[0].result;
  const revalDocumentId = revalResults[0].documentId;

  // Compare Chrome documentIds (Initial, Extractor, Revalidation)
  const observedDocumentIds = [initialDocumentId, identityDocumentId, extractorDocumentId, revalDocumentId].filter(Boolean);
  if (observedDocumentIds.length !== 4 || new Set(observedDocumentIds).size !== 1) {
    throw new Error('Document identity mismatch: Document navigated during bundle extraction');
  }

  // Exact raw URL identity is compared in memory. Redaction must not collapse
  // distinct URLs before the navigation check.
  if (initialIdentity.url !== reval.url) {
    throw new Error('Exact URL mismatch policy breach: target navigated before dispatch');
  }

  // Revalidate readyState
  if (reval.readyState !== 'complete' && reval.readyState !== 'interactive') {
    throw new Error(`Document in invalid readyState: ${reval.readyState}`);
  }

  // Revalidate origin
  if (!validateOrigin(expectedOrigin, reval.url)) {
    throw new Error('Origin verification mismatch: Target navigated prior to dispatch');
  }

  const transactionId = 'tx-' + crypto.randomUUID();
  const idempotencyKey = 'idem-' + crypto.randomUUID();

  let payload;
  if (capability !== 'browser.page.observe' && capability !== 'browser.selection.observe') {
    payload = {
      protocolVersion: "1.0",
      capabilityVersion: "1.0",
      transactionId,
      idempotencyKey,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      capability: capability,
      riskLevel: "inspect",
      target: { tabId: tab.id, frameId: targetFrameId, expectedOrigin },
      approval: { required: false, status: "not-required", grantId: null },
      constraints: { maxElements: 5000, maxOutputBytes: 2000000, timeoutMs: 5000 },
      payload: captureData
    };
  } else {
    // Redact selectionText, title, URL for Phase 1 observations
    const cleanSelectionText = selectionText ? redactText(selectionText).redactedText : (captureData.selectedText ? redactText(captureData.selectedText).redactedText : '');
    const cleanTitle = redactText(captureData.title || '').redactedText;
    const cleanUrl = sanitizeUrl(captureData.url || tab.url);

    if (selectionText || captureData.selectedText) {
      capability = 'browser.selection.observe';
    }

    payload = {
      protocolVersion: "1.0",
      capabilityVersion: "1.0",
      transactionId,
      idempotencyKey,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      capability: capability,
      riskLevel: "inspect",
      target: { tabId: tab.id, frameId: targetFrameId, expectedOrigin },
      approval: { required: false, status: "not-required", grantId: null },
      constraints: { maxElements: 1, maxOutputBytes: 10000, timeoutMs: 5000 },
      payload: {
        title: cleanTitle,
        url: cleanUrl,
        selectedText: cleanSelectionText
      }
    };
  }

  // Double-check serialized payload size against min(declaredMaxOutputBytes, 2MB)
  const serialized = JSON.stringify(payload);
  const payloadBytes = new Blob([serialized]).size;
  const declaredMaxBytes = payload.constraints?.maxOutputBytes || 2000000;
  const effectiveMaxBytes = Math.min(declaredMaxBytes, 2000000);

  if (payloadBytes > effectiveMaxBytes) {
    throw new Error(`Serialized payload size (${payloadBytes} bytes) breaches effective limit (${effectiveMaxBytes} bytes)`);
  }

  const resp = await transport.request('/api/browser/observations', {
    method: 'POST',
    body: serialized
  });

  if (resp.ok) {
    const observation = await resp.json();
    if (trigger !== 'popup') {
      chromeApi.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'PaneTera',
        message: 'Context sent successfully'
      });
    }
    return { success: true, observation };
  } else {
    let errorMessage = 'Failed to submit observation';
    try {
      const err = await resp.json();
      errorMessage = err.error || errorMessage;
    } catch (e) {}
    if (trigger !== 'popup') {
      chromeApi.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'PaneTera capture failed',
        message: errorMessage
      });
    }
    return { success: false, error: errorMessage };
  }
}
