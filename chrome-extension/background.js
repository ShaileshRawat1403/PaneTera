// chrome-extension/background.js
import { initializeStorageSecurity, setAccessToken, setRefreshToken, getAccessToken, clearTokens, getInstallationId } from './storage.js';
import { request } from './transport.js';
import { validateOrigin } from './shared/validation.js';

chrome.runtime.onInstalled.addListener(async () => {
  initializeStorageSecurity();

  // Create context menus for selection and page contexts
  chrome.contextMenus.create({
    id: 'capture-selection',
    title: 'Send selection to Tessera',
    contexts: ['selection'],
    documentUrlPatterns: ['https://*/*', 'http://*/*']
  });

  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Send page to Tessera',
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
      title: 'Tessera',
      message: 'Capture shortcut is not assigned. Configure it in chrome://extensions/shortcuts.'
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sendResponse) {
  try {
    switch (message.type) {
      case 'pair': {
        const installationId = await getInstallationId();
        const runtimeId = chrome.runtime.id;
        const resp = await request('/api/browser/pairing/exchange', {
          method: 'POST',
          body: JSON.stringify({
            code: message.code,
            runtimeId,
            installationId
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          await setAccessToken(data.accessToken);
          await setRefreshToken(data.refreshToken);
          sendResponse({ success: true });
        } else {
          const err = await resp.json();
          sendResponse({ success: false, error: err.error || 'Failed to exchange pairing code' });
        }
        break;
      }

      case 'check-status': {
        const token = await getAccessToken();
        if (!token) {
          sendResponse({ paired: false });
          return;
        }

        try {
          const resp = await request('/api/browser/session');
          if (resp.ok) {
            const data = await resp.json();
            sendResponse({ paired: true, session: data });
          } else {
            // Token invalid
            await clearTokens();
            sendResponse({ paired: false });
          }
        } catch (e) {
          sendResponse({ paired: false, error: 'Local server unreachable' });
        }
        break;
      }

      case 'capture': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        let activeTab = tabs[0];
        
        // Handle full-tab popup testing mode
        if (activeTab && activeTab.url && activeTab.url.startsWith('chrome-extension://')) {
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          activeTab = allTabs.slice().reverse().find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
        }

        const result = await performCapture({ tab: activeTab, trigger: 'popup' });
        sendResponse(result);
        break;
      }

      case 'disconnect': {
        try {
          await request('/api/browser/session', { method: 'DELETE' });
        } catch (e) {
          console.warn('Network revocation call failed:', e);
        }
        await clearTokens();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (err) {
    console.error('Error handling background execution:', err);
    sendResponse({ success: false, error: err.message || 'Background execution error' });
  }
}

// -----------------------------------------------------------------------------
// EVENT LISTENERS: Context Menu and Keyboard Shortcut
// -----------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'capture-selection' || info.menuItemId === 'capture-page') {
    const selectionText = info.menuItemId === 'capture-selection' ? info.selectionText : undefined;
    await performCapture({ tab, trigger: 'context-menu', selectionText });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-context') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let activeTab = tabs[0];
    if (activeTab) {
      await performCapture({ tab: activeTab, trigger: 'shortcut' });
    }
  }
});

// -----------------------------------------------------------------------------
// SHARED CAPTURE LOGIC
// -----------------------------------------------------------------------------

async function performCapture({ tab, trigger, selectionText }) {
  try {
    if (!tab) {
      throw new Error('No active tab found');
    }

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('This Chrome page cannot be captured. Open a normal HTTP or HTTPS page.');
    }

    let captureData = { title: tab.title, url: tab.url, origin: new URL(tab.url).origin, selectedText: selectionText };

    // For shortcut or popup (where selectionText is undefined), we need to inject script to get selection
    if (trigger === 'shortcut' || trigger === 'popup') {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['capture.js']
        });
        if (results && results.length > 0) {
          captureData = results[0].result; // capture.js returns { url, title, origin, selectedText }
        } else {
          throw new Error('Failed to extract DOM elements');
        }
      } catch (e) {
        throw new Error('Script injection blocked. Please grant site permissions.');
      }
    }

    // Always revalidate the current tab origin immediately before dispatch
    const freshTab = await chrome.tabs.get(tab.id);
    const actualUrl = freshTab.url || '';
    const expectedOrigin = captureData.origin;
    if (!validateOrigin(expectedOrigin, actualUrl)) {
      throw new Error('Origin verification mismatch: Target navigated');
    }

    const transactionId = 'tx-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    const idempotencyKey = 'idem-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    
    const payload = {
      protocolVersion: "1.0",
      capabilityVersion: "1.0",
      transactionId,
      idempotencyKey,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      capability: captureData.selectedText ? "browser.selection.observe" : "browser.page.observe",
      riskLevel: "inspect",
      target: {
        tabId: tab.id,
        frameId: 0,
        expectedOrigin
      },
      approval: { required: false, status: "not-required", grantId: null },
      constraints: { maxElements: 1, maxOutputBytes: 10000, timeoutMs: 5000 },
      payload: {
        title: captureData.title,
        url: captureData.url,
        selectedText: captureData.selectedText
      }
    };

    const resp = await request('/api/browser/observations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const observation = await resp.json();
      if (trigger !== 'popup') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Tessera',
          message: 'Context sent successfully'
        });
      }
      return { success: true, observation };
    } else {
      const err = await resp.json();
      const errorMessage = err.error || 'Failed to submit observation';
      if (trigger !== 'popup') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Tessera capture failed',
          message: errorMessage
        });
      }
      return { success: false, error: errorMessage };
    }
  } catch (e) {
    if (trigger !== 'popup') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Tessera capture failed',
        message: e.message || 'Unknown error'
      });
    }
    return { success: false, error: e.message || 'Unknown error' };
  }
