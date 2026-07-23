// test/rigAudit.test.ts
//
// The Rig audit classification, tested as the single source of truth the routes
// delegate to. The reviewer's rule is the spine of these tests: a connectionId
// in an event does not make the connector the actor. Operator governance is
// unknown / operator-unattributed, PaneTera's runtime and discovery are system,
// and only successful connector I/O is connector. Failures, including a rejected
// approval versus a runtime failure, are classified by phase, never by matching
// error text.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  RIG_EVENT_CLASS,
  invocationFailureClass,
  rigAuditActor,
  rigAuditFields,
  rigInvocationFailureFields,
} from '../server/rig/auditClassification';

const OPERATOR_EVENTS = [
  'rig.resource.denied',
  'rig.prompt.denied',
  'rig.connection.proposed',
  'rig.connection.approved',
  'rig.connection.stopped',
  'rig.connection.removed',
  'rig.capability.policy',
  'rig.invocation.proposed',
  'rig.invocation.approved',
];
const SYSTEM_EVENTS = [
  'rig.connection.connected',
  'rig.connection.failed',
  'rig.connection.transport-failed',
  'rig.capabilities.changed',
  'rig.resource.failed',
  'rig.prompt.failed',
];
const CONNECTOR_EVENTS = ['rig.invocation.completed', 'rig.resource.read', 'rig.prompt.read'];

describe('operator governance is unattributed, not the connector', () => {
  for (const event of OPERATOR_EVENTS) {
    it(`${event} is operator / unknown, never connector`, () => {
      assert.strictEqual(RIG_EVENT_CLASS[event].actorClass, 'operator', `${event} must be operator`);
      const fields = rigAuditFields(event);
      assert.strictEqual(fields.actor.kind, 'unknown', 'no authoritative human principal exists');
      assert.strictEqual(fields.actor.label, 'operator-unattributed');
    });
  }

  it('records proposals as approval-required and settled actions as allowed', () => {
    assert.strictEqual(rigAuditFields('rig.connection.proposed').policyDecision, 'approval-required');
    assert.strictEqual(rigAuditFields('rig.invocation.proposed').policyDecision, 'approval-required');
    assert.strictEqual(rigAuditFields('rig.connection.approved').policyDecision, 'allowed');
    assert.strictEqual(rigAuditFields('rig.connection.removed').policyDecision, 'allowed');
  });
});

describe('input validation is an operator error, not a policy denial', () => {
  it('classifies malformed prompt arguments as operator / error / allowed', () => {
    const fields = rigAuditFields('rig.prompt.invalid');
    assert.strictEqual(RIG_EVENT_CLASS['rig.prompt.invalid'].actorClass, 'operator');
    assert.strictEqual(fields.actor.kind, 'unknown', 'the operator is unattributed');
    assert.strictEqual(fields.actor.label, 'operator-unattributed');
    assert.strictEqual(fields.outcome, 'error', 'a validation error, not a denial');
    assert.strictEqual(fields.policyDecision, 'allowed', 'policy was never consulted, so it did not deny');
  });
});

describe('runtime and discovery are system', () => {
  for (const event of SYSTEM_EVENTS) {
    it(`${event} is system`, () => {
      assert.strictEqual(RIG_EVENT_CLASS[event].actorClass, 'system');
      assert.strictEqual(rigAuditFields(event).actor.kind, 'system');
    });
  }

  it('records system failures as allowed / error, not denied', () => {
    for (const event of ['rig.connection.failed', 'rig.connection.transport-failed', 'rig.resource.failed', 'rig.prompt.failed']) {
      const fields = rigAuditFields(event);
      assert.strictEqual(fields.outcome, 'error', `${event} is an error`);
      assert.strictEqual(fields.policyDecision, 'allowed', `${event} is not a policy denial`);
    }
  });
});

describe('only successful connector I/O is the connector', () => {
  for (const event of CONNECTOR_EVENTS) {
    it(`${event} is connector, attributed to the governed connection`, () => {
      assert.strictEqual(RIG_EVENT_CLASS[event].actorClass, 'connector');
      const fields = rigAuditFields(event, { connectionId: 'conn-1', displayName: 'FS' });
      assert.strictEqual(fields.actor.kind, 'connector');
      assert.strictEqual(fields.actor.id, 'conn-1');
      assert.strictEqual(fields.outcome, 'success');
    });
  }

  it('refuses to build a connector actor without a connection', () => {
    assert.throws(() => rigAuditActor('connector'), /requires the governed connection/);
  });

  it('classifies no failure event as connector', () => {
    for (const [event, cls] of Object.entries(RIG_EVENT_CLASS)) {
      if (cls.outcome === 'error') {
        assert.notStrictEqual(cls.actorClass, 'connector', `${event} must not claim the connector on failure`);
      }
    }
  });
});

describe('invocation failure is classified by phase, not error text', () => {
  it('attributes a pre-call rejection to the operator, denied', () => {
    // Both an invalid target and a rejected approval are refused before any
    // connector work, so both are operator denials, not connector or system.
    for (const phase of ['target-invalid', 'approval-claim'] as const) {
      const cls = invocationFailureClass(phase);
      assert.strictEqual(cls.actorClass, 'operator', `${phase} is the operator`);
      assert.strictEqual(cls.outcome, 'denied');
      assert.strictEqual(cls.policyDecision, 'denied');

      const fields = rigInvocationFailureFields(phase);
      assert.strictEqual(fields.actor.kind, 'unknown');
      assert.strictEqual(fields.actor.label, 'operator-unattributed');
    }
  });

  it('attributes a registry-lookup, connector-call, or finalization failure to the system, allowed error', () => {
    for (const phase of ['registry-lookup', 'connector-call', 'local-finalization'] as const) {
      const cls = invocationFailureClass(phase);
      assert.strictEqual(cls.actorClass, 'system', `${phase} is system-observed`);
      assert.strictEqual(cls.outcome, 'error');
      assert.strictEqual(cls.policyDecision, 'allowed');

      const fields = rigInvocationFailureFields(phase);
      assert.strictEqual(fields.actor.kind, 'system');
    }
  });

  it('never attributes a connector-call failure to the connector', () => {
    // The runtime cannot yet prove remote-versus-transport, so a call failure is
    // not the connector's claim.
    assert.notStrictEqual(invocationFailureClass('connector-call').actorClass, 'connector');
  });
});

describe('actor resolution', () => {
  it('maps each class to the intended factory', () => {
    assert.strictEqual(rigAuditActor('operator').kind, 'unknown');
    assert.strictEqual(rigAuditActor('operator').label, 'operator-unattributed');
    assert.strictEqual(rigAuditActor('system').kind, 'system');
    assert.strictEqual(rigAuditActor('connector', { connectionId: 'c9' }).kind, 'connector');
  });

  it('throws on an unclassified event rather than guessing', () => {
    assert.throws(() => rigAuditFields('rig.nonexistent.event'), /No Rig audit classification/);
  });
});

describe('the routes delegate to the classification', () => {
  it('emit no raw actor factory and route every rig audit through the table', () => {
    // Secondary to the behavioural tests above: a tripwire so a future edit
    // cannot reintroduce an inline actor decision that bypasses the truth table.
    const source = readFileSync(new URL('../server/rig/routes.ts', import.meta.url), 'utf8');
    assert.ok(!/actor:\s*(connectorActor|humanActor|systemActor|unknownActor)\(/.test(source), 'no inline actor factory in routes');
    assert.ok(source.includes('rigAuditFields('), 'routes use the classification table');
    assert.ok(
      source.includes('rigInvocationFailureFields(phase, principal)'),
      'invocation failure uses both its phase and authenticated principal',
    );
  });
});
