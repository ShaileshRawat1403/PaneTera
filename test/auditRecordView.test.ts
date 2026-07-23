// test/auditRecordView.test.ts
//
// Acceptance tests for the typed-audit presentation model. The model is the one
// place the panel derives display from, so these tests hold the line the backend
// drew: attribution is read off the typed record, never inferred from the event
// name, the owner strings in details, or a legacy line, and an unattributed or
// legacy record is never promoted into a human or a system.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  toAuditRecordView,
  filterAuditRecordViews,
  loadAuditRecords,
  AUDIT_ACTOR_KIND_OPTIONS,
  type AuditActorKind,
  type AuditFetch,
  type RawAuditRecord,
} from '../src/components/workbench/auditRecordViewModel';

function typed(overrides: Partial<RawAuditRecord> = {}): RawAuditRecord {
  return {
    recordId: 'audit-1',
    schemaVersion: 2,
    timestamp: '2026-07-23T10:00:00.000Z',
    event: 'rig.invocation.completed',
    actor: { kind: 'connector', id: 'conn-1', label: 'Filesystem' },
    outcome: 'success',
    policyDecision: 'allowed',
    correlation: {},
    details: {},
    ...overrides,
  };
}

describe('every actor kind has an accurate, distinct label', () => {
  const expected: Record<AuditActorKind, string> = {
    human: 'Human operator',
    system: 'PaneTera system',
    'browser-extension': 'Browser Operator',
    'mcp-client': 'MCP client',
    connector: 'Connector',
    agent: 'Unverified agent claim',
    unknown: 'Unknown / unattributed',
  };
  for (const kind of Object.keys(expected) as AuditActorKind[]) {
    it(`labels ${kind} as "${expected[kind]}"`, () => {
      const view = toAuditRecordView(typed({ actor: { kind, id: 'x', label: 'L' } }));
      assert.strictEqual(view.actor.kind, kind);
      assert.strictEqual(view.actor.kindLabel, expected[kind]);
    });
  }

  it('marks only server-attributable kinds authoritative', () => {
    for (const kind of ['human', 'system', 'browser-extension', 'mcp-client', 'connector'] as AuditActorKind[]) {
      assert.strictEqual(toAuditRecordView(typed({ actor: { kind, id: 'x', label: 'L' } })).actor.authoritative, true, kind);
    }
    for (const kind of ['unknown', 'agent'] as AuditActorKind[]) {
      assert.strictEqual(toAuditRecordView(typed({ actor: { kind, id: 'x', label: 'L' } })).actor.authoritative, false, kind);
    }
  });
});

describe('unknown and legacy records are never promoted', () => {
  it('keeps a legacy line unattributed despite a system-like event and an owner string', () => {
    const legacy: RawAuditRecord = {
      timestamp: '2026-07-23T10:00:00.000Z',
      event: 'workspace.enabled',
      details: { ownerId: 'alice', workspaceId: 'w1' },
      // No schemaVersion, no actor: this is a pre-typed line.
    };
    const view = toAuditRecordView(legacy);
    assert.strictEqual(view.isLegacy, true);
    assert.strictEqual(view.actor.kind, 'unknown');
    assert.strictEqual(view.actor.kindLabel, 'Unknown / unattributed');
    assert.strictEqual(view.actor.identity, 'Unattributed legacy record');
    assert.strictEqual(view.actor.authoritative, false);
    assert.notStrictEqual(view.actor.kind, 'human');
    assert.notStrictEqual(view.actor.kind, 'system');
  });

  it('does not infer a system actor from a system-ish event on a typed unknown record', () => {
    const view = toAuditRecordView(typed({
      event: 'rig.connection.connected',
      actor: { kind: 'unknown', id: null, label: 'operator-unattributed' },
      details: { ownerId: 'bob' },
    }));
    assert.strictEqual(view.actor.kind, 'unknown');
    assert.strictEqual(view.actor.identity, 'operator-unattributed');
    assert.strictEqual(view.actor.authoritative, false);
  });

  it('shows a human as the configured label and fingerprint only, never a raw operator id', () => {
    // The wire never carries PORTAL_OPERATOR_ID; the server sends a fingerprint.
    const view = toAuditRecordView(typed({ actor: { kind: 'human', id: 'a1b2c3d4e5f6a7b8', label: 'Local owner' } }));
    assert.strictEqual(view.actor.kind, 'human');
    assert.strictEqual(view.actor.identity, 'Local owner (a1b2c3d4e5f6a7b8)');
    assert.ok(!/local-owner/i.test(view.actor.identity ?? ''), 'no raw operator id echoed');
  });
});

describe('an agent claim is disclosed, never presented as a real principal', () => {
  it('labels agent as an unverified claim, non-authoritative, and cautionary', () => {
    const view = toAuditRecordView(typed({ actor: { kind: 'agent', id: 'a', label: 'bot' } }));
    assert.strictEqual(view.actor.kind, 'agent');
    assert.strictEqual(view.actor.kindLabel, 'Unverified agent claim');
    assert.strictEqual(view.actor.authoritative, false);
    assert.strictEqual(view.actor.tone, 'danger', 'disclosed as a caution, not muted');
  });

  it('offers no agent filter until an authoritative agent identity exists', () => {
    assert.ok(!AUDIT_ACTOR_KIND_OPTIONS.some((o) => o.value === 'agent'), 'no agent filter option');
    // The real kinds are still filterable.
    for (const kind of ['human', 'system', 'browser-extension', 'mcp-client', 'connector', 'unknown'] as AuditActorKind[]) {
      assert.ok(AUDIT_ACTOR_KIND_OPTIONS.some((o) => o.value === kind), `${kind} is filterable`);
    }
  });
});

describe('loading failures are explicit and never look like a current empty trail', () => {
  const okFetch = (records: unknown): AuditFetch => async () => ({
    ok: true, status: 200, json: async () => ({ logs: records }),
  });

  it('returns records on success', async () => {
    const result = await loadAuditRecords(okFetch([{ schemaVersion: 2, event: 'e', actor: { kind: 'system' } }]), 't');
    assert.strictEqual(result.ok, true);
    assert.ok(result.ok && result.records.length === 1);
  });

  it('reports a 401 with its status and carries no records', async () => {
    const result = await loadAuditRecords(async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) }), 't');
    assert.strictEqual(result.ok, false);
    assert.ok(!result.ok && /401/.test(result.reason), 'the status is preserved');
    assert.ok(!result.ok && /Unauthorized/.test(result.reason));
    assert.ok(!('records' in result), 'no records leak on failure');
  });

  it('reports a 500 with its status', async () => {
    const result = await loadAuditRecords(async () => ({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) }), 't');
    assert.ok(!result.ok && /500/.test(result.reason));
  });

  it('reports a network failure without leaking records', async () => {
    const result = await loadAuditRecords(async () => { throw new Error('offline'); }, 't');
    assert.strictEqual(result.ok, false);
    assert.ok(!result.ok && /connection|reach/i.test(result.reason));
  });

  it('accepts an empty array as a legitimately empty trail', async () => {
    const result = await loadAuditRecords(okFetch([]), 't');
    assert.ok(result.ok && result.records.length === 0);
  });

  it('rejects a non-array logs payload as unreadable, never as empty success', async () => {
    for (const bad of ['bad', null, 42, { nested: [] }]) {
      const result = await loadAuditRecords(okFetch(bad), 't');
      assert.strictEqual(result.ok, false, `logs=${JSON.stringify(bad)} is not a valid trail`);
      assert.ok(!result.ok && /format|read/i.test(result.reason));
      assert.ok(!('records' in result), 'no empty records leak from a schema failure');
    }
  });

  it('rejects a body whose json cannot be parsed', async () => {
    const result = await loadAuditRecords(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }), 't');
    assert.strictEqual(result.ok, false);
  });
});

describe('outcome and policy are independent, never collapsed', () => {
  it('renders error outcome with allowed policy without merging them', () => {
    const view = toAuditRecordView(typed({ outcome: 'error', policyDecision: 'allowed' }));
    assert.strictEqual(view.outcome.label, 'Failed');
    assert.strictEqual(view.outcome.tone, 'danger');
    assert.strictEqual(view.policy.label, 'Allowed');
    assert.notStrictEqual(view.outcome.label, view.policy.label);
    assert.notStrictEqual(view.outcome.label, 'Denied', 'error is not denied');
  });

  it('does not collapse approval-required into allowed', () => {
    const view = toAuditRecordView(typed({ outcome: 'pending', policyDecision: 'approval-required' }));
    assert.strictEqual(view.policy.label, 'Approval required');
    assert.strictEqual(view.outcome.label, 'Pending');
    assert.notStrictEqual(view.policy.label, 'Allowed');
    assert.notStrictEqual(view.outcome.label, 'Succeeded', 'pending is not success');
  });

  it('keeps denied policy distinct from a denied outcome', () => {
    const denied = toAuditRecordView(typed({ outcome: 'denied', policyDecision: 'denied' }));
    assert.strictEqual(denied.outcome.label, 'Denied');
    assert.strictEqual(denied.policy.label, 'Denied');
    // Same word, but two independent fields; a change to one must not move the other.
    const mixed = toAuditRecordView(typed({ outcome: 'success', policyDecision: 'denied' }));
    assert.strictEqual(mixed.outcome.label, 'Succeeded');
    assert.strictEqual(mixed.policy.label, 'Denied');
  });
});

describe('correlations render with the correct identifier type', () => {
  it('maps each correlation key to its human type, including parent as provenance', () => {
    const view = toAuditRecordView(typed({
      correlation: {
        runId: 'run-1', proposalId: 'prop-1', approvalId: 'appr-1', grantId: 'grant-1',
        connectionId: 'conn-9', parentRecordId: 'rec-9', captureId: 'cap-1', extractionId: 'ext-1',
      },
    }));
    const byType = Object.fromEntries(view.correlations.map((c) => [c.type, c.value]));
    assert.strictEqual(byType.run, 'run-1');
    assert.strictEqual(byType.proposal, 'prop-1');
    assert.strictEqual(byType.approval, 'appr-1');
    assert.strictEqual(byType.grant, 'grant-1');
    assert.strictEqual(byType.connection, 'conn-9');
    assert.strictEqual(byType.provenance, 'rec-9');
    assert.strictEqual(byType.capture, 'cap-1');
    assert.strictEqual(byType.extraction, 'ext-1');
  });

  it('omits absent correlations rather than inventing them', () => {
    const view = toAuditRecordView(typed({ correlation: { proposalId: 'prop-1' } }));
    assert.strictEqual(view.correlations.length, 1);
    assert.strictEqual(view.correlations[0].type, 'proposal');
  });

  it('surfaces the project from the scrubbed detail as grouping, not attribution', () => {
    const view = toAuditRecordView(typed({ actor: { kind: 'system', id: null, label: 's' }, details: { workspaceId: 'panetera' } }));
    assert.strictEqual(view.project, 'panetera');
    assert.strictEqual(view.actor.kind, 'system', 'project detail never changes the actor');
    assert.strictEqual(toAuditRecordView(typed({ details: {} })).project, null);
  });
});

describe('the redaction boundary is preserved', () => {
  it('passes an already-scrubbed detail through unchanged and reconstructs nothing', () => {
    const details = { authorization: '[redacted]', url: 'https://x.com/?code=redacted', note: 'ok' };
    const view = toAuditRecordView(typed({ details }));
    assert.deepStrictEqual(view.details, details, 'details are shown as-is');
    const serialized = JSON.stringify(view.details);
    assert.ok(serialized.includes('[redacted]'), 'the redaction marker survives');
    assert.ok(!serialized.includes('Bearer '), 'no secret is reconstructed');
  });
});

describe('malformed and partial lines do not crash the model', () => {
  it('degrades every malformed shape to a readable unknown row', () => {
    const inputs: unknown[] = [
      null,
      undefined,
      {},
      { actor: null },
      { schemaVersion: 'two', actor: { kind: 'martian' } },
      { schemaVersion: 2, actor: { kind: 'connector' }, correlation: 'nope', details: 'nope' },
      { raw: 'unparseable original line' },
    ];
    for (const input of inputs) {
      const view = toAuditRecordView(input as RawAuditRecord);
      assert.ok(view, 'a view is always produced');
      assert.strictEqual(typeof view.actor.kind, 'string');
      assert.ok(['unknown', 'connector'].includes(view.actor.kind), 'unknown kind falls back');
      assert.strictEqual(typeof view.outcome.label, 'string');
      assert.strictEqual(typeof view.policy.label, 'string');
      assert.ok(Array.isArray(view.correlations));
    }
  });
});

describe('bounded filters', () => {
  const views = [
    toAuditRecordView(typed({ actor: { kind: 'system', id: null, label: 's' }, outcome: 'success', policyDecision: 'allowed' })),
    toAuditRecordView(typed({ actor: { kind: 'connector', id: 'c', label: 'C' }, outcome: 'error', policyDecision: 'allowed' })),
    toAuditRecordView(typed({ actor: { kind: 'unknown', id: null, label: 'u' }, outcome: 'denied', policyDecision: 'denied' })),
  ];

  it('filters by actor kind, outcome, and policy independently', () => {
    assert.strictEqual(filterAuditRecordViews(views, { actorKind: 'connector' }).length, 1);
    assert.strictEqual(filterAuditRecordViews(views, { outcome: 'denied' }).length, 1);
    assert.strictEqual(filterAuditRecordViews(views, { policyDecision: 'allowed' }).length, 2);
    assert.strictEqual(filterAuditRecordViews(views, { actorKind: 'all', outcome: 'all', policyDecision: 'all' }).length, 3);
  });
});

describe('the panel is wired to the model, not a parallel classifier', () => {
  it('renders rows through AuditRecordRow and the view model', () => {
    const source = readFileSync(new URL('../src/components/workbench/AuditLogsView.tsx', import.meta.url), 'utf8');
    assert.ok(source.includes("from './auditRecordViewModel'"), 'panel imports the model');
    assert.ok(source.includes('toAuditRecordView('), 'panel maps records through the model');
    assert.ok(source.includes('<AuditRecordRow'), 'panel renders the model-driven row');
    // The old name-substring classifier must not return.
    assert.ok(!/event\.toLowerCase\(\)/.test(source), 'no event-name inference remains');
    assert.ok(!/includes\('denied'\)/.test(source), 'no substring outcome inference remains');
  });
});
