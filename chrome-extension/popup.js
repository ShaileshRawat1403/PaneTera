// chrome-extension/popup.js

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const setupPanel = document.getElementById('setupPanel');
  const actionPanel = document.getElementById('actionPanel');
  const pairingCodeInput = document.getElementById('pairingCode');
  const btnConnect = document.getElementById('btnConnect');
  const btnCapture = document.getElementById('btnCapture');
  const btnDisconnect = document.getElementById('btnDisconnect');
  const errorMsg = document.getElementById('errorMsg');
  const pendingPanel = document.getElementById('pendingPanel');
  const btnApprovePairing = document.getElementById('btnApprovePairing');
  const btnDismissPairing = document.getElementById('btnDismissPairing');

  // Format code input automatic dash (XXXX-XXXX)
  pairingCodeInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (val.length > 4) {
      val = val.substring(0, 4) + '-' + val.substring(4, 8);
    }
    e.target.value = val;
  });

  async function updateUI() {
    chrome.runtime.sendMessage({ type: 'check-status' }, (response) => {
      if (chrome.runtime.lastError) {
        statusBadge.textContent = 'Gateway Offline';
        statusBadge.className = 'status-badge status-disconnected';
        setupPanel.style.display = 'block';
        actionPanel.style.display = 'none';
        return;
      }

      if (response && response.paired) {
        statusBadge.textContent = 'Online / Gov Sandbox';
        statusBadge.className = 'status-badge status-connected';
        setupPanel.style.display = 'none';
        pendingPanel.style.display = 'none';
        actionPanel.style.display = 'block';
      } else {
        statusBadge.textContent = 'Disconnected';
        statusBadge.className = 'status-badge status-disconnected';
        const hasPending = Boolean(response && response.pendingPairing);
        pendingPanel.style.display = hasPending ? 'block' : 'none';
        setupPanel.style.display = hasPending ? 'none' : 'block';
        actionPanel.style.display = 'none';
      }
    });
  }

  btnConnect.addEventListener('click', () => {
    const rawCode = pairingCodeInput.value.replace(/-/g, '');
    if (rawCode.length !== 8) {
      showError('Please enter a valid 8-character code.');
      return;
    }

    errorMsg.style.display = 'none';
    btnConnect.disabled = true;
    btnConnect.textContent = 'Connecting...';

    chrome.runtime.sendMessage({ type: 'pair', code: rawCode }, (response) => {
      btnConnect.disabled = false;
      btnConnect.textContent = 'Connect Operator';

      if (response && response.success) {
        updateUI();
      } else {
        showError(response ? response.error : 'Connection timeout');
      }
    });
  });

  btnApprovePairing.addEventListener('click', () => {
    btnApprovePairing.disabled = true;
    btnApprovePairing.textContent = 'Connecting…';
    chrome.runtime.sendMessage({ type: 'approve-pending-pairing' }, (response) => {
      btnApprovePairing.disabled = false;
      btnApprovePairing.textContent = 'Allow connection';
      if (response?.success) updateUI();
      else showError(response?.error || 'Connection failed');
    });
  });

  btnDismissPairing.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'dismiss-pending-pairing' }, updateUI);
  });

  btnCapture.addEventListener('click', () => {
    btnCapture.disabled = true;
    btnCapture.textContent = 'Capturing context...';

    const capabilitySelect = document.getElementById('capabilitySelect');
    const capability = capabilitySelect ? capabilitySelect.value : 'browser.page.observe';

    chrome.runtime.sendMessage({ type: 'capture', capability }, (response) => {
      btnCapture.disabled = false;
      btnCapture.textContent = 'Execute Action';

      if (response && response.success) {
        // Show temporary success feedback
        const originalText = statusBadge.textContent;
        statusBadge.textContent = 'Context Captured!';
        statusBadge.style.background = 'rgba(127, 85, 240, 0.2)';
        statusBadge.style.color = '#a78bfa';
        setTimeout(() => {
          statusBadge.textContent = originalText;
          statusBadge.style.background = '';
          statusBadge.style.color = '';
        }, 1500);
      } else {
        alert(response ? response.error : 'Capture failed');
      }
    });
  });

  btnDisconnect.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
      updateUI();
    });
  });

  const btnOpenSidePanel = document.getElementById('btnOpenSidePanel');
  if (btnOpenSidePanel) {
    btnOpenSidePanel.addEventListener('click', () => {
      chrome.windows.getCurrent({ populate: false }, (window) => {
        chrome.sidePanel.open({ windowId: window.id });
      });
    });
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  updateUI();
});
