import assert from 'node:assert';
import fs from 'node:fs';

console.log('Running local pairing bridge contract tests...');

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const bridgeSource = fs.readFileSync(new URL('../paneteraBridge.js', import.meta.url), 'utf8');
const popupSource = fs.readFileSync(new URL('../popup.html', import.meta.url), 'utf8');
const pairingSource = fs.readFileSync(new URL('../pairing.html', import.meta.url), 'utf8');
const pairingScript = fs.readFileSync(new URL('../pairing.js', import.meta.url), 'utf8');
const observeSource = fs.readFileSync(new URL('../observe.html', import.meta.url), 'utf8');
const observeScript = fs.readFileSync(new URL('../observe.js', import.meta.url), 'utf8');
const backgroundSource = fs.readFileSync(new URL('../background.js', import.meta.url), 'utf8');
const routingSource = fs.readFileSync(new URL('../messageRouting.js', import.meta.url), 'utf8');

assert.deepStrictEqual(
  manifest.content_scripts?.[0]?.matches,
  ['http://127.0.0.1/*', 'http://localhost/*'],
  'the pairing bridge must run only on local PaneTera origins',
);
assert.ok(!manifest.content_scripts[0].matches.some((match) => match.includes('https://') || match.includes('*://')));
assert.ok(bridgeSource.includes("event.source !== window"), 'bridge messages must originate in the same page');
assert.ok(bridgeSource.includes("message.source !== PANETERA_UI_SOURCE"), 'bridge messages must carry the PaneTera source marker');
assert.ok(!bridgeSource.includes('accessToken') && !bridgeSource.includes('refreshToken'), 'the page bridge must never handle credentials');
assert.ok(bridgeSource.includes("reply('RELOAD_REQUIRED'"), 'an invalidated extension context must request page recovery');
assert.ok(bridgeSource.includes("runtime.connect({ name: PORT_NAME })"), 'the bridge must use one stable runtime port');
assert.ok(bridgeSource.includes('.onDisconnect.addListener'), 'extension reload must become a normal disconnect state');
assert.ok(bridgeSource.includes('runtime.lastError'), 'Chrome disconnect errors must be consumed and classified');
assert.ok(popupSource.includes('btnApprovePairing'), 'the extension must require explicit approval');
assert.ok(popupSource.includes('btnDismissPairing'), 'the extension must let the user decline');
assert.ok(pairingSource.includes('btnApprovePairing'), 'the dedicated approval page must require explicit approval');
assert.ok(pairingSource.includes('btnDismissPairing'), 'the dedicated approval page must let the user decline');
assert.ok(pairingScript.includes("approve-pending-pairing"), 'the approval page must use the governed exchange');
assert.ok(pairingScript.includes('storage.onChanged.addListener'), 'duplicate approval tabs must close when one resolves the request');
assert.ok(routingSource.includes("getURL('pairing.html')"), 'a pairing offer must open the approval page automatically');
assert.ok(routingSource.includes('tabs.create'), 'approval must use a stable extension-owned tab');
assert.ok(!backgroundSource.includes('panetera-pairing-request'), 'pairing must not depend on OS notifications');
assert.ok(backgroundSource.includes("runtime.onConnect.addListener"), 'the service worker must accept the stable local bridge port');
assert.ok(bridgeSource.includes("message.type === 'OBSERVE_WEB'"), 'submitted web context must reach the Browser Operator');
assert.ok(bridgeSource.includes("message.type === 'STATUS_CHECK'"), 'PaneTera must query the extension, not infer connection from stale server state');
assert.ok(backgroundSource.includes("request('/api/browser/session')"), 'web inspection must use the refresh-capable authenticated transport');
assert.ok(!backgroundSource.includes('getAccessToken().then'), 'web inspection must not bypass refresh by reading the volatile token directly');
assert.ok(observeSource.includes('Inspect this webpage?'), 'web inspection must have an extension-owned approval surface');
assert.ok(observeScript.includes('chrome.permissions.request'), 'site permission must be requested from the explicit user gesture');
assert.ok(observeScript.includes('chrome.permissions.remove'), 'one-off site access must be removed after capture');
assert.ok(observeScript.includes("type: 'capture-web-url'"), 'approval must invoke the governed capture path');
assert.ok(backgroundSource.includes("capability: 'browser.article.extract'"), 'approved pages must produce readable article evidence');
assert.ok(backgroundSource.includes("chrome.tabs.remove(tab.id)"), 'the temporary inspection tab must be closed');

console.log('✅ local pairing bridge contract tests passed.');
