// chrome-extension/test-operator.js
// Development validation harness. Not part of the shipped surface; excluded
// from packaging. Triggers operator ops against the most recently used normal
// http/https tab and renders the result.

const out = document.getElementById('out');
const shot = document.getElementById('shot');
const modeState = document.getElementById('modeState');

function render(res) {
  shot.style.display = 'none';
  const ok = res && res.ok;
  out.className = ok ? 'ok' : 'bad';
  out.textContent = JSON.stringify(res, null, 2);
  if (ok && res.result && typeof res.result.dataUrl === 'string') {
    shot.src = res.result.dataUrl;
    shot.style.display = 'block';
  }
}

// Pick the most recently accessed normal page to operate on, never the harness
// itself or a chrome:// page.
async function getTargetTabId() {
  const tabs = await chrome.tabs.query({});
  const normal = tabs
    .filter((t) => /^https?:/.test(t.url || ''))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return normal[0] ? normal[0].id : undefined;
}

async function runOp(op, params) {
  out.className = '';
  out.textContent = `Running ${op}…`;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'operator', op, params });
    render(res);
  } catch (err) {
    render({ ok: false, op, error: String(err && err.message ? err.message : err) });
  }
}

async function refreshMode() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'get-operator-mode' });
    const mode = res && res.mode ? res.mode : 'unknown';
    modeState.textContent = mode;
    modeState.className = mode === 'ungoverned' ? 'mode-ungoverned' : 'mode-governed';
  } catch {
    modeState.textContent = 'unreachable';
  }
}

document.getElementById('btnToggle').addEventListener('click', async () => {
  const cur = await chrome.runtime.sendMessage({ type: 'get-operator-mode' });
  const next = cur && cur.mode === 'ungoverned' ? 'governed' : 'ungoverned';
  await chrome.runtime.sendMessage({ type: 'set-operator-mode', mode: next });
  refreshMode();
});

document.querySelectorAll('button[data-op]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const op = btn.dataset.op;
    const params = {};
    const needsTarget = !['list_tabs', 'open_tab'].includes(op);
    if (needsTarget) {
      const t = await getTargetTabId();
      if (t != null) params.tabId = t;
    }
    if (btn.dataset.from) {
      const key = btn.dataset.key || 'url';
      params[key] = document.getElementById(btn.dataset.from).value;
    }
    if (btn.dataset.xy) {
      params.x = Number(document.getElementById('clickX').value);
      params.y = Number(document.getElementById('clickY').value);
    }
    if (btn.dataset.full) params.fullPage = true;
    runOp(op, params);
  });
});

refreshMode();
