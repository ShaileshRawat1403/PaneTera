process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { auditWorkbenchClientEvent, auditWorkbenchProbe } from '../server/workbench/workbenchRoutes';

describe('workbench audit attribution', () => {
  it('attributes the server probe to the system', () => {
    const record = auditWorkbenchProbe({ appId: 'soothsayer', status: 'reachable', safeOrigin: 'http://127.0.0.1:4173' });
    assert.strictEqual(record.actor.kind, 'system');
    assert.strictEqual(record.outcome, 'success');
    assert.strictEqual(record.policyDecision, 'allowed');
  });

  it('records unavailable and invalid probes as system-observed errors', () => {
    for (const status of ['unavailable', 'invalid-configuration'] as const) {
      const record = auditWorkbenchProbe({ appId: `app-${status}`, status });
      assert.strictEqual(record.actor.kind, 'system');
      assert.strictEqual(record.outcome, 'error');
    }
  });

  it('does not promote client-reported UI activity into a human or verified success', () => {
    const record = auditWorkbenchClientEvent({
      event: 'workbench.app.open',
      appId: 'soothsayer',
      operation: 'open',
      resultStatus: 'success',
      transactionId: 'client-asserted',
      safeOrigin: 'http://127.0.0.1:4173',
    });
    assert.strictEqual(record.actor.kind, 'unknown');
    assert.strictEqual(record.actor.label, 'workbench-client-unattributed');
    assert.strictEqual(record.outcome, 'unknown');
    assert.strictEqual(record.policyDecision, 'not-applicable');
    assert.strictEqual(record.correlation.runId, undefined, 'client transaction ids are not authoritative correlation');
    assert.strictEqual(record.details.clientReportedStatus, 'success');
  });

  it('routes both endpoint emissions through the typed helpers', () => {
    const source = readFileSync(new URL('../server/workbench/workbenchRoutes.ts', import.meta.url), 'utf8');
    assert.ok(!source.includes('logAudit('));
    assert.ok(source.includes('auditWorkbenchProbe({'));
    assert.ok(source.includes('auditWorkbenchClientEvent({'));
    assert.ok(!source.includes('req.user'));
  });
});
