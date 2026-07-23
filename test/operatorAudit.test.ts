process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { auditOperatorAction } from '../server/operatorAudit';

describe('unattributed operator audit', () => {
  it('does not infer a human from a portal-authorised action', () => {
    const record = auditOperatorAction({
      event: 'workspace.enabled',
      details: { workspaceId: 'project' },
    });
    assert.strictEqual(record.actor.kind, 'unknown');
    assert.strictEqual(record.actor.label, 'operator-unattributed');
    assert.strictEqual(record.outcome, 'success');
    assert.strictEqual(record.policyDecision, 'allowed');
  });

  it('preserves authoritative grant correlation', () => {
    const record = auditOperatorAction({
      event: 'local_context_revoked',
      correlation: { grantId: 'grant-1' },
    });
    assert.strictEqual(record.correlation.grantId, 'grant-1');
  });

  it('migrates Headroom and index governance without legacy actor guesses', () => {
    const headroom = readFileSync(new URL('../server/headroom/routes.ts', import.meta.url), 'utf8');
    const index = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
    assert.ok(!headroom.includes('logAudit('));
    assert.ok(!index.includes('logAudit('));
    assert.ok(headroom.includes('auditOperatorAction('));
    assert.ok(index.includes('auditOperatorAction('));
    assert.ok(index.includes("event: 'workspace.registered'"), 'registration is not mislabeled as enablement');
  });

  it('does not copy selected absolute paths into typed audit details', () => {
    const index = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
    assert.ok(index.includes('scopeFingerprint: fingerprint(grant.path)'));
    assert.ok(!/details:\s*\{[^}]*path:\s*grant\.path/s.test(index));
  });
});
