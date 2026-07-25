import { normalizePublicHttpUrl } from './shared/validation.js';

const inspectButton = document.getElementById('btnInspect');
const cancelButton = document.getElementById('btnCancel');
const target = document.getElementById('target');
const status = document.getElementById('status');
const title = document.getElementById('title');
const description = document.getElementById('description');
const params = new URLSearchParams(window.location.search);
const requestId = params.get('requestId') || '';
const requestedUrl = normalizePublicHttpUrl(params.get('url') || '');
const mode = params.get('mode') === 'live' ? 'live' : 'evidence';
const consumerTabId = Number(params.get('consumerTabId'));

if (mode === 'live') {
  title.textContent = 'Open a live Chrome view?';
  description.textContent =
    'PaneTera will open the real page in a managed Chrome window and mirror its pixels into the canvas. ' +
    'Inspect mode can read bounded element metadata, but never form values or page scripts.';
  inspectButton.textContent = 'Open live view';
}

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
    // With broad host access declared in the manifest, the origin is already
    // granted, so there is nothing to request and no per-site prompt. Only fall
    // back to an explicit optional request when access is not already present.
    alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
    granted = alreadyGranted ? true : await chrome.permissions.request({ origins: [originPattern] });
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

  status.textContent = mode === 'live' ? 'Opening the managed Chrome view…' : 'Opening and inspecting the page…';
  let result;
  try {
    result = mode === 'live'
      ? await send({
          type: 'start-live-web-session',
          requestId,
          url: requestedUrl,
          consumerTabId,
          permissionWasPreexisting: alreadyGranted,
        })
      : await send({ type: 'capture-web-url', requestId, url: requestedUrl });
  } finally {
    // Keep a pre-existing site grant intact, but make one-off approvals truly
    // one-off rather than silently accumulating browser access.
    // A live session retains its one-site grant until that session closes.
    if (mode !== 'live' && !alreadyGranted) {
      try { await chrome.permissions.remove({ origins: [originPattern] }); } catch {}
    }
  }
  if (mode === 'live' && !result.success && !alreadyGranted) {
    try { await chrome.permissions.remove({ origins: [originPattern] }); } catch {}
  }
  await finish(result);
  if (!result.success) {
    status.className = 'error';
    status.textContent = result.error || 'The page could not be inspected.';
    setTimeout(() => window.close(), 1600);
    return;
  }
  status.className = 'success';
  status.textContent = mode === 'live'
    ? 'Live Chrome view opened. Returning to PaneTera…'
    : 'Page inspected. Returning to PaneTera…';
  setTimeout(() => window.close(), 700);
});

cancelButton.addEventListener('click', async () => {
  setBusy(true);
  await finish({ success: false, error: 'Page inspection was cancelled.' });
  window.close();
});
