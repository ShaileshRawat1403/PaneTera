// chrome-extension/background.js
import { initializeStorageSecurity, setAccessToken, setRefreshToken, getAccessToken, clearTokens, getInstallationId } from './storage.js';
import { request } from './transport.js';
import { validateOrigin } from './shared/validation.js';

chrome.runtime.onInstalled.addListener(() => {
  initializeStorageSecurity();
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
        // 1. Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        const activeTab = tabs[0];
        if (!activeTab.url || activeTab.url.startsWith('chrome://')) {
          sendResponse({ success: false, error: 'Cannot capture context on restricted system pages' });
          return;
        }

        // 2. Inject scripting capture
        let results;
        try {
          results = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['capture.js']
          });
        } catch (e) {
          sendResponse({ success: false, error: 'Script injection blocked. Please grant site permissions.' });
          return;
        }

        if (!results || results.length === 0) {
          sendResponse({ success: false, error: 'Failed to extract DOM elements' });
          return;
        }

        const captureData = results[0].result;

        // 3. Verify actual tab origin against derived script origin to prevent spoofing
        const actualUrl = activeTab.url;
        const expectedOrigin = captureData.origin;
        if (!validateOrigin(expectedOrigin, actualUrl)) {
          sendResponse({ success: false, error: 'Origin verification failed' });
          return;
        }

        // 4. Send the observation request envelope
        const transactionId = 'tx-' + Math.random().toString(36).substring(2) + '-' + Date.now();
        const idempotencyKey = 'idem-' + Math.random().toString(36).substring(2) + '-' + Date.now();
        
        const payload = {
          protocolVersion: "1.0",
          capabilityVersion: "1.0",
          transactionId,
          idempotencyKey,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30000).toISOString(),
          capability: "browser.page.observe",
          riskLevel: "inspect",
          target: {
            tabId: activeTab.id,
            frameId: 0,
            expectedOrigin
          },
          approval: {
            required: false,
            status: "not-required",
            grantId: null
          },
          constraints: {
            maxElements: 1,
            maxOutputBytes: 10000,
            timeoutMs: 5000
          },
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
          const resultData = await resp.json();
          sendResponse({ success: true, observation: resultData });
        } else {
          const err = await resp.json();
          sendResponse({ success: false, error: err.error || 'Failed to submit observation' });
        }
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
