const approveButton = document.getElementById('btnApprovePairing');
const dismissButton = document.getElementById('btnDismissPairing');
const status = document.getElementById('status');

function setBusy(busy) {
  approveButton.disabled = busy;
  dismissButton.disabled = busy;
}

function send(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { success: false, error: 'No response from the extension.' });
    });
  });
}

approveButton.addEventListener('click', async () => {
  setBusy(true);
  status.className = '';
  status.textContent = 'Connecting…';
  const response = await send('approve-pending-pairing');
  if (response.success) {
    status.className = 'success';
    status.textContent = 'Connected. You can return to PaneTera.';
    approveButton.textContent = 'Connected';
    setTimeout(() => window.close(), 900);
    return;
  }
  status.className = 'error';
  status.textContent = response.error || 'Connection failed. Start a new request in Rig.';
  setBusy(false);
});

dismissButton.addEventListener('click', async () => {
  setBusy(true);
  await send('dismiss-pending-pairing');
  window.close();
});

send('get-pending-pairing').then((response) => {
  if (!response.pendingPairing) {
    status.className = 'error';
    status.textContent = 'This request is no longer active. Start a new connection from Rig.';
    setBusy(true);
  }
});

// If another approval tab completes or dismisses the same request, close this
// stale copy too. Older PaneTera builds could accidentally open more than one
// tab while polling; leaving those tabs behind made a completed connection
// look as though it still needed attention.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'session' || !changes.pendingPairing) return;
  if (changes.pendingPairing.newValue == null) window.close();
});
