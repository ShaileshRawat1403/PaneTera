process.env.NODE_ENV = 'test';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fingerprint } from '../server/auditRecord';
import { auditResearchOperator, auditResearchSystem } from '../server/research/researchAudit';

describe('research audit attribution', () => {
  it('keeps operator requests unattributed and fingerprints the supplied owner id', () => {
    const record = auditResearchOperator({
      event: 'research.session.create', outcome: 'success', sessionId: 'session-1', ownerId: 'person@example.test',
    });
    assert.strictEqual(record.actor.kind, 'unknown');
    assert.strictEqual(record.actor.label, 'research-caller-unattributed');
    assert.strictEqual(record.details.ownerFingerprint, fingerprint('person@example.test'));
    assert.ok(!JSON.stringify(record).includes('person@example.test'));
  });

  it('attributes store, validation, and pipeline work to PaneTera', () => {
    const record = auditResearchSystem({
      event: 'research.analysis.provider.invoke', outcome: 'success', sessionId: 'session-1',
      details: { providerId: 'provider-1' },
    });
    assert.strictEqual(record.actor.kind, 'system');
    assert.strictEqual(record.actor.label, 'research-pipeline');
    assert.strictEqual(record.details.providerId, 'provider-1');
  });

  it('does not label provider output as an authenticated agent', () => {
    const record = auditResearchSystem({
      event: 'research.analysis.provider.invoke', outcome: 'error', details: { providerId: 'model' },
    });
    assert.notStrictEqual(record.actor.kind, 'agent');
    assert.notStrictEqual(record.actor.kind, 'connector');
  });

  it('contains no legacy audit calls in the research boundary', () => {
    const files = [
      'researchSessionService.ts',
      'researchSessionStore.ts',
      'researchAnalysisStore.ts',
      'provenanceValidationService.ts',
      'analysisValidationService.ts',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(`../server/research/${file}`, import.meta.url), 'utf8');
      assert.ok(!source.includes('logAudit('), `${file} still uses the legacy emitter`);
    }
  });
});
