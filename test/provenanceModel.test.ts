// test/provenanceModel.test.ts
//
// The provenance presentation model, tested as the single place a record is
// validated and interpreted. The rules: closed enums (trust, integrity, source
// class) are exact; open fields (record type, retention) accept any string; an
// unknown record type is shown as its own unfamiliar type, never a known event;
// and trust and integrity are surfaced as two independent facts, never conflated.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isProvenanceRecord, resolveProvenanceView, projectProvenanceRecord } from '../src/components/rig/provenanceModel';
import type { ProvenanceRecord } from '../src/rig/types';

const record = (over: Partial<ProvenanceRecord> = {}): ProvenanceRecord => ({
  recordId: 'rec-1', recordType: 'mcp-invocation', ownerId: 'local-operator',
  sourceIdentity: { kind: 'mcp-connection', id: 'conn-9' }, parentRecordIds: [],
  inputDigest: null, outputDigest: null, createdAt: '2026-01-01T00:00:00.000Z',
  sourceClass: 'local-user-installed', trustLevel: 'untrusted', correlation: {},
  integrity: 'verified', retentionClass: 'session', ...over,
});

describe('isProvenanceRecord validates the canonical shape and closed enums', () => {
  it('accepts a well-formed record', () => {
    assert.strictEqual(isProvenanceRecord(record()), true);
    assert.strictEqual(isProvenanceRecord(record({ recordType: 'some-future-kind', retentionClass: 'permanent' })), true);
  });

  it('rejects malformed shapes and out-of-enum values', () => {
    const bad: unknown[] = [
      null, 'x', 42, [],
      { ...record(), recordId: 5 },
      { ...record(), recordId: '' },              // empty identity
      { ...record(), ownerId: '' },
      { ...record(), sourceClass: 'invented' },
      { ...record(), trustLevel: 'super-trusted' },
      { ...record(), integrity: 'probably-fine' },
      { ...record(), sourceIdentity: { kind: 'x' } },
      { ...record(), sourceIdentity: { kind: '', id: '' } }, // empty identity fields
      { ...record(), parentRecordIds: [1] },
      { ...record(), inputDigest: 5 },
      { ...record(), correlation: [] },
      { ...record(), correlation: { proposalId: 9 } },
    ];
    for (const value of bad) assert.strictEqual(isProvenanceRecord(value), false, `${JSON.stringify(value)} must fail`);
  });

  it('requires the exact server timestamp serialization and rejects normalized impossible dates', () => {
    for (const bad of [
      '', 'not-a-date', '2026', '2026-01-01', 'yesterday', 'Invalid Date',
      '2026-01-01T00:00:00Z',          // no milliseconds: not the server format
      '2026-01-01T00:00:00.000+00:00', // offset form, not the `Z` the server emits
      '2026-01-01T00:00:00.00Z',       // two fractional digits, not three
      '2026-02-30T00:00:00.000Z',      // normalized impossible date (Feb 30 -> March)
      '2026-13-01T00:00:00.000Z',      // impossible month
      '2026-01-40T00:00:00.000Z',      // impossible day
    ]) {
      assert.strictEqual(isProvenanceRecord(record({ createdAt: bad })), false, `createdAt=${bad} must fail`);
    }
    assert.strictEqual(isProvenanceRecord(record({ createdAt: '2026-07-21T08:18:32.000Z' })), true);
  });

  it('requires bounded, non-blank, trimmed identity, type, parent, and correlation fields', () => {
    const long = 'x'.repeat(257);
    const bad: unknown[] = [
      { ...record(), recordType: '' },
      { ...record(), recordType: '   ' },
      { ...record(), recordType: ' mcp-invocation' },   // untrimmed
      { ...record(), recordType: long },                // unbounded
      { ...record(), ownerId: '  ' },
      { ...record(), recordId: 'rec ' },                // trailing space
      { ...record(), retentionClass: '' },
      { ...record(), sourceIdentity: { kind: 'mcp-connection', id: '  ' } },
      { ...record(), parentRecordIds: ['ok', '  '] },   // blank parent id
      { ...record(), parentRecordIds: [long] },
      { ...record(), correlation: { proposalId: '  ' } }, // present-but-blank correlation
      { ...record(), correlation: { proposalId: ' pr-1' } }, // untrimmed correlation
    ];
    for (const value of bad) assert.strictEqual(isProvenanceRecord(value), false, `${JSON.stringify(value)} must fail`);
    // The reproduced good record still passes.
    assert.strictEqual(isProvenanceRecord(record({ parentRecordIds: ['parent-1'], correlation: { proposalId: 'pr-1' } })), true);
  });
});

describe('records are canonically projected, dropping arbitrary input fields', () => {
  it('projectProvenanceRecord keeps only canonical fields and correlation keys', () => {
    const dirty = {
      ...record({ correlation: { proposalId: 'pr-1', connectionId: 'c1' } }),
      extensionToken: 'https://example.test/?token=SECRETVALUE',
      sourceIdentity: { kind: 'mcp-connection', id: 'conn-9', secret: 'leak' },
      correlation: { proposalId: 'pr-1', connectionId: 'c1', smuggled: 'SECRET' },
    } as unknown as ProvenanceRecord;
    const projected = projectProvenanceRecord(dirty);
    assert.ok(!('extensionToken' in projected), 'extra top-level fields are dropped');
    assert.ok(!('secret' in projected.sourceIdentity), 'extra source-identity keys are dropped');
    assert.ok(!('smuggled' in projected.correlation), 'unknown correlation keys are dropped');
    assert.strictEqual(projected.correlation.proposalId, 'pr-1', 'known correlation keys are kept');
  });

  it('resolveProvenanceView exposes no secret-bearing field in raw', () => {
    const dirty = {
      ...record(),
      extensionToken: 'https://example.test/?token=SECRETVALUE',
    } as unknown as ProvenanceRecord;
    const view = resolveProvenanceView(dirty);
    assert.ok(!('extensionToken' in view.raw), 'raw carries no arbitrary input field');
    assert.ok(!JSON.stringify(view.raw).includes('SECRETVALUE'), 'the secret never survives into raw');
  });
});

describe('resolveProvenanceView interprets without inferring', () => {
  it('labels known record types and marks unknown types as unknown', () => {
    assert.deepStrictEqual(
      [resolveProvenanceView(record({ recordType: 'mcp-invocation' })).typeLabel,
       resolveProvenanceView(record({ recordType: 'mcp-resource-read' })).typeLabel,
       resolveProvenanceView(record({ recordType: 'mcp-prompt-read' })).typeLabel],
      ['Tool invocation', 'Resource read', 'Prompt read'],
    );
    const unknown = resolveProvenanceView(record({ recordType: 'mcp-future-thing' }));
    assert.strictEqual(unknown.isKnownType, false);
    assert.strictEqual(unknown.typeLabel, 'mcp-future-thing', 'the raw type is shown, not a familiar event');
  });

  it('surfaces integrity and trust as independent, verbatim fields', () => {
    const v = resolveProvenanceView(record({ integrity: 'broken', trustLevel: 'authoritative' }));
    assert.strictEqual(v.integrity.value, 'broken');
    assert.strictEqual(v.integrity.label, 'Integrity broken');
    assert.strictEqual(v.integrity.tone, 'danger');
    assert.strictEqual(v.trust.value, 'authoritative');
    assert.strictEqual(v.trust.label, 'Authoritative');
    // Independent: the trust label never leaks into the integrity label.
    assert.ok(!/Authoritative/.test(v.integrity.label));
  });

  it('tones integrity by its value only', () => {
    assert.strictEqual(resolveProvenanceView(record({ integrity: 'verified' })).integrity.tone, 'neutral');
    assert.strictEqual(resolveProvenanceView(record({ integrity: 'unverified' })).integrity.tone, 'attention');
    assert.strictEqual(resolveProvenanceView(record({ integrity: 'broken' })).integrity.tone, 'danger');
  });

  it('carries source identity and correlations with accurate labels', () => {
    const v = resolveProvenanceView(record({
      sourceIdentity: { kind: 'mcp-connection', id: 'conn-42' },
      correlation: { proposalId: 'pr-1', approvalId: 'ap-1', connectionId: 'conn-42', envelopeId: 'env-1' },
    }));
    assert.strictEqual(v.sourceKind, 'mcp-connection');
    assert.strictEqual(v.sourceId, 'conn-42');
    const byType = Object.fromEntries(v.correlations.map((c) => [c.type, `${c.label}:${c.value}`]));
    assert.strictEqual(byType.proposal, 'Proposal:pr-1');
    assert.strictEqual(byType.approval, 'Approval:ap-1');
    assert.strictEqual(byType.connection, 'Connection:conn-42');
    assert.strictEqual(byType.envelope, 'Envelope:env-1');
  });

  it('exposes the canonical record for disclosure', () => {
    const r = record();
    const raw = resolveProvenanceView(r).raw;
    assert.notStrictEqual(raw, r, 'raw is a projection, not the input object');
    assert.deepStrictEqual(raw, projectProvenanceRecord(r), 'raw is the canonical projection');
  });
});
