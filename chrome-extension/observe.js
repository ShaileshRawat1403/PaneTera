import { normalizePublicHttpUrl } from './shared/validation.js';

const inspectButton = document.getElementById('btnInspect');
const cancelButton = document.getElementById('btnCancel');
const target = document.getElementById('target');
const status = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const requestId = params.get('requestId') || '';
const requestedUrl = normalizePublicHttpUrl(params.get('url') || '');

function setBusy(busy) {
  inspectButton.disabled = busy;
  cancelButton.disabled = busy;
}

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { success: false, error: 'No response from the Browser Operator.' });
    });
  });
}

async function finish(result) {
  await send({ type: 'web-observation-complete', requestId, result });
}

if (!requestId || !requestedUrl) {
  target.textContent = 'The requested address is invalid or no longer available.';
  status.className = 'error';
  status.textContent = 'Return to PaneTera and try again.';
  setBusy(true);
} else {
  target.textContent = requestedUrl;
}

inspectButton.addEventListener('click', async () => {
  if (!requestedUrl || !requestId) return;
  setBusy(true);
  status.className = '';
  status.textContent = 'Waiting for site access…';
  const originPattern = `${new URL(requestedUrl).origin}/*`;
  let granted = false;
  let alreadyGranted = false;
  try {
    alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
    granted = await chrome.permissions.request({ origins: [originPattern] });
  } catch {
    granted = false;
  }
  if (!granted) {
    const result = { success: false, error: 'Site access was not granted.' };
    status.className = 'error';
    status.textContent = result.error;
    await finish(result);
    setTimeout(() => window.close(), 1200);
    return;
  }

  status.textContent = 'Opening and inspecting the page…';
  let result;
  try {
    result = await send({ type: 'capture-web-url', requestId, url: requestedUrl });
  } finally {
    // Keep a pre-existing site grant intact, but make one-off approvals truly
    // one-off rather than silently accumulating browser access.
    if (!alreadyGranted) {
      try { await chrome.permissions.remove({ origins: [originPattern] }); } catch {}
    }
  }
  await finish(result);
  if (!result.success) {
    status.className = 'error';
    status.textContent = result.error || 'The page could not be inspected.';
    setTimeout(() => window.close(), 1600);
    return;
  }
  status.className = 'success';
  status.textContent = 'Page inspected. Returning to PaneTera…';
  setTimeout(() => window.close(), 700);
});

cancelButton.addEventListener('click', async () => {
  setBusy(true);
  await finish({ success: false, error: 'Page inspection was cancelled.' });
  window.close();
});
