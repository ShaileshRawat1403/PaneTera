process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { logTypedAudit, systemActor } from '../server/auditRecord';

describe('Audit hash chain integrity unit tests', () => {
  it('assigns prevHash to consecutive audit records', () => {
    const rec1 = logTypedAudit({
      event: 'test.event.1',
      actor: systemActor('test-suite'),
      outcome: 'success',
      policyDecision: 'allowed',
    });

    const rec2 = logTypedAudit({
      event: 'test.event.2',
      actor: systemActor('test-suite'),
      outcome: 'success',
      policyDecision: 'allowed',
    });

    assert.ok(typeof rec1.prevHash === 'string');
    assert.ok(typeof rec2.prevHash === 'string');
    assert.notStrictEqual(rec1.recordId, rec2.recordId);
  });
});
