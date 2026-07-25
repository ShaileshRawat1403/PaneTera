// chrome-extension/background.js
import {
  initializeStorageSecurity,
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  clearTokens,
  getInstallationId,
  getPendingPairing,
  setPendingPairing,
  clearPendingPairing,
} from './storage.js';
import { request } from './transport.js';
import { normalizePublicHttpUrl, validateOrigin } from './shared/validation.js';
import { handleExtensionMessage, performCaptureWithAdapters } from './messageRouting.js';
import {
  closeLiveSessionsForTab,
  commandLiveSession,
  startLiveSession,
} from './liveSession.js';

const pendingWebObservations = new Map();

const adapters = {
  storage: {
    getAccessToken,
    setAccessToken,
    setRefreshToken,
    getInstallationId,
    clearTokens,
    getPendingPairing,
    setPendingPairing,
    clearPendingPairing,
  },
  transport: { request },
  chromeApi: chrome,
  validateOrigin
};

chrome.runtime.onInstalled.addListener(async () => {
  initializeStorageSecurity();

  // Create context menus for selection and page contexts
  chrome.contextMenus.create({
    id: 'capture-selection',
    title: 'Send selection to PaneTera',
    contexts: ['selection'],
    documentUrlPatterns: ['https://*/*', 'http://*/*']
  });

  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Send page to PaneTera',
    contexts: ['page'],
    documentUrlPatterns: ['https://*/*', 'http://*/*']
  });

  // Check if capture shortcut is assigned
  const commands = await chrome.commands.getAll();
  const captureCommand = commands.find(c => c.name === 'capture-context');
  if (captureCommand && !captureCommand.shortcut) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'PaneTera',
      message: 'Capture shortcut is not assigned. Configure it in chrome://extensions/shortcuts.'
    });
  }
});

function isObservePage(sender) {
  return sender?.url?.startsWith(chrome.runtime.getURL('observe.html'));
}

function waitForTabReady(tabId, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    function cleanup() {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timer);
    }
    function succeed(tab) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(tab);
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }
    const timer = setTimeout(() => {
      fail(new Error('The webpage did not finish loading in time.'));
    }, timeoutMs);
    function onUpdated(updatedTabId, changeInfo, tab) {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      succeed(tab);
    }
    function onRemoved(removedTabId) {
      if (removedTabId === tabId) fail(new Error('The temporary webpage was closed before inspection completed.'));
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    // Close the fast-load race between tabs.create resolving and registering
    // onUpdated. The tab may already be complete by this point.
    chrome.tabs.get(tabId).then((tab) => {
      if (tab?.status === 'complete') succeed(tab);
    }).catch(() => fail(new Error('The temporary webpage is no longer available.')));
  });
}

async function captureApprovedWebUrl(url) {
  const normalized = normalizePublicHttpUrl(url);
  if (!normalized) return { success: false, error: 'Only public HTTP or HTTPS pages can be inspected.' };
  let tab;
  try {
    tab = await chrome.tabs.create({ url: normalized, active: false });
    if (!tab?.id) throw new Error('Chrome did not create the temporary page.');
    const readyTab = tab.status === 'complete' ? tab : await waitForTabReady(tab.id);
    const result = await performCaptureWithAdapters({
      tab: readyTab,
      trigger: 'panetera-web-context',
      capability: 'browser.article.extract',
    }, adapters);
    return {
      success: Boolean(result?.success),
      captureId: result?.observation?.data?.captureId,
      error: result?.error,
    };
  } catch (error) {
    return { success: false, error: error?.message || 'The webpage could not be inspected.' };
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'start-live-web-session') {
    if (!isObservePage(sender)) {
      sendResponse({ success: false, error: 'Live web viewing must start from the Browser Operator approval page.' });
      return false;
    }
    startLiveSession({
      url: message.url,
      consumerTabId: message.consumerTabId,
      permissionWasPreexisting: message.permissionWasPreexisting === true,
    }, { chromeApi: chrome, waitForTabReady }).then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error?.message || 'The live browser view could not be started.' });
    });
    return true;
  }

  if (message?.type === 'capture-web-url') {
    if (!isObservePage(sender)) {
      sendResponse({ success: false, error: 'Web inspection must start from the Browser Operator approval page.' });
      return false;
    }
    captureApprovedWebUrl(message.url).then(sendResponse);
    return true;
  }

  if (message?.type === 'web-observation-complete') {
    if (!isObservePage(sender)) {
      sendResponse({ success: false, error: 'Invalid web inspection completion source.' });
      return false;
    }
    const pending = pendingWebObservations.get(message.requestId);
    if (pending) {
      pendingWebObservations.delete(message.requestId);
      pending(message.result || { success: false, error: 'The inspection returned no result.' });
    }
    sendResponse({ success: true });
    return false;
  }

  handleExtensionMessage(message, adapters, sendResponse, sender);
  return true; // Keep message channel open for async response
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panetera-local-bridge') return;
  port.onMessage.addListener((message) => {
    if (message?.type === 'request-live-web-command') {
      commandLiveSession({
        sessionId: message.sessionId,
        consumerTabId: port.sender?.tab?.id,
        action: message.action,
        point: message.point,
      }, { chromeApi: chrome }).then((result) => {
        port.postMessage({ ...result, requestId: message.requestId });
      }).catch((error) => {
        port.postMessage({
          success: false,
          error: error?.message || 'The Browser Operator live command failed.',
          requestId: message.requestId,
        });
      });
      return;
    }

    if (message?.type === 'request-live-web-session') {
      const normalized = normalizePublicHttpUrl(message.url);
      if (!normalized) {
        port.postMessage({ success: false, error: 'Only public HTTP or HTTPS pages can be viewed.', requestId: message.requestId });
        return;
      }
      request('/api/browser/session').then((sessionResponse) => {
        if (!sessionResponse.ok) {
          port.postMessage({ success: false, error: 'Connect the Browser Operator in Rig first.', requestId: message.requestId });
          return;
        }
        let approvalTabId;
        const onApprovalClosed = (tabId) => {
          if (tabId !== approvalTabId) return;
          settle({ success: false, error: 'Live web viewing was cancelled.' });
        };
        const settle = (result) => {
          chrome.tabs.onRemoved.removeListener(onApprovalClosed);
          pendingWebObservations.delete(message.requestId);
          try { port.postMessage({ ...result, requestId: message.requestId }); } catch {}
        };
        pendingWebObservations.set(message.requestId, settle);
        chrome.tabs.create({
          url: chrome.runtime.getURL(
            `observe.html?mode=live&consumerTabId=${encodeURIComponent(port.sender?.tab?.id ?? '')}` +
            `&requestId=${encodeURIComponent(message.requestId)}&url=${encodeURIComponent(normalized)}`
          ),
          active: true,
        }).then((tab) => {
          approvalTabId = tab.id;
          chrome.tabs.onRemoved.addListener(onApprovalClosed);
        }).catch((error) => settle({ success: false, error: error?.message || 'Could not open live-view approval.' }));
      }).catch(() => {
        try {
          port.postMessage({ success: false, error: 'The local PaneTera server is unreachable.', requestId: message.requestId });
        } catch {}
      });
      return;
    }

    if (message?.type === 'request-web-observation') {
      const normalized = normalizePublicHttpUrl(message.url);
      if (!normalized) {
        port.postMessage({ success: false, error: 'Only public HTTP or HTTPS pages can be inspected.', requestId: message.requestId });
        return;
      }
      // Validate through the authenticated transport instead of reading the
      // volatile access token directly. The transport restores an access
      // token from the persisted refresh token after an extension reload.
      request('/api/browser/session').then((sessionResponse) => {
        if (!sessionResponse.ok) {
          port.postMessage({ success: false, error: 'Connect the Browser Operator in Rig first.', requestId: message.requestId });
          return;
        }
        let approvalTabId;
        const onApprovalClosed = (tabId) => {
          if (tabId !== approvalTabId) return;
          settle({ success: false, error: 'Page inspection was cancelled.' });
        };
        const settle = (result) => {
          chrome.tabs.onRemoved.removeListener(onApprovalClosed);
          pendingWebObservations.delete(message.requestId);
          try { port.postMessage({ ...result, requestId: message.requestId }); } catch {}
        };
        pendingWebObservations.set(message.requestId, settle);
        chrome.tabs.create({
          url: chrome.runtime.getURL(`observe.html?requestId=${encodeURIComponent(message.requestId)}&url=${encodeURIComponent(normalized)}`),
          active: true,
        }).then((tab) => {
          approvalTabId = tab.id;
          chrome.tabs.onRemoved.addListener(onApprovalClosed);
        }).catch((error) => settle({ success: false, error: error?.message || 'Could not open the inspection approval.' }));
      }).catch(() => {
        try {
          port.postMessage({ success: false, error: 'The local PaneTera server is unreachable.', requestId: message.requestId });
        } catch {}
      });
      return;
    }
    handleExtensionMessage(message, adapters, (response) => {
      try {
        port.postMessage({ ...response, requestId: message.requestId });
      } catch {
        // The local page or extension was reloaded before the reply completed.
      }
    }, { url: port.sender?.url || '' });
  });
  port.onDisconnect.addListener(() => {
    for (const [requestId, settle] of pendingWebObservations) {
      settle({ success: false, error: 'PaneTera disconnected before inspection completed.' });
      pendingWebObservations.delete(requestId);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  closeLiveSessionsForTab(tabId, { chromeApi: chrome }).catch(() => {});
});

// Event Listeners: Context Menu and Keyboard Shortcut
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'capture-selection' || info.menuItemId === 'capture-page') {
    const selectionText = info.menuItemId === 'capture-selection' ? info.selectionText : undefined;
    await performCaptureWithAdapters({ tab, trigger: 'context-menu', selectionText }, adapters);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-context') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let activeTab = tabs[0];
    if (activeTab) {
      await performCaptureWithAdapters({ tab: activeTab, trigger: 'shortcut', capability: 'browser.page.observe' }, adapters);
    }
  }
});
