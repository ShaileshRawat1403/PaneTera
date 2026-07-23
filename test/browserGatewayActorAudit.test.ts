process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  auditBrowserExtensionEvent,
  auditBrowserPairRequested,
  auditBrowserPortalDisconnect,
} from '../server/browserGatewayAudit';

describe('browser gateway actor attribution', () => {
  it('keeps portal pairing and revocation actions operator-unattributed', () => {
    const requested = auditBrowserPairRequested();
    const revoked = auditBrowserPortalDisconnect({ installationId: 'install-1', sessionId: 'session-1' });
    assert.strictEqual(requested.actor.kind, 'unknown');
    assert.strictEqual(requested.outcome, 'pending');
    assert.strictEqual(requested.policyDecision, 'approval-required');
    assert.strictEqual(revoked.actor.kind, 'unknown');
    assert.strictEqual(revoked.actor.label, 'operator-unattributed');
  });

  it('attributes paired and authenticated extension actions to the extension', () => {
    const paired = auditBrowserExtensionEvent('browser.pair', { installationId: 'install-1', runtimeId: 'runtime-1' });
    const disconnected = auditBrowserExtensionEvent('browser.disconnect', { installationId: 'install-1', runtimeId: 'runtime-1' });
    assert.strictEqual(paired.actor.kind, 'browser-extension');
    assert.strictEqual(disconnected.actor.kind, 'browser-extension');
    assert.strictEqual(paired.actor.id, disconnected.actor.id);
    assert.ok(!JSON.stringify(paired).includes('runtime-1'));
  });

  it('removes all loose browser gateway audit records', () => {
    const source = readFileSync(new URL('../server/browserGateway.ts', import.meta.url), 'utf8');
    assert.ok(!source.includes('logAudit('));
    assert.ok(!source.includes("actor: 'panetera-ui'"));
    assert.ok(!source.includes('actor: `extension:'));
  });
});
