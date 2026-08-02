import assert from 'assert';
import { selectAttributionForClaim, type AnswerProvenance } from '../src/utils/claimProvenance';

function findsAttributionByClaimId() {
  const provenance: AnswerProvenance = {
    runId: 'run-1',
    attributions: [
      { claimId: 'claim-a', text: 'A', eventIds: ['evt-1'] },
      { claimId: 'claim-b', text: 'B', eventIds: ['evt-2'] },
    ],
  };

  const found = selectAttributionForClaim(provenance, 'claim-b');
  assert.ok(found, 'the matching attribution is returned');
  assert.strictEqual(found?.text, 'B');
  assert.deepStrictEqual(found?.eventIds, ['evt-2']);
}

function returnsNullWhenClaimIsAbsent() {
  const provenance: AnswerProvenance = {
    runId: 'run-1',
    attributions: [{ claimId: 'claim-a', text: 'A', eventIds: ['evt-1'] }],
  };
  assert.strictEqual(selectAttributionForClaim(provenance, 'claim-missing'), null);
}

// The scaffold currently ships every run with an empty attributions array
// (no model-side claim generation yet), and a run created before this change
// has no provenance field at all. Both must resolve to null, not throw.
function returnsNullForEmptyOrMissingProvenance() {
  const empty: AnswerProvenance = { runId: 'run-1', attributions: [] };
  assert.strictEqual(selectAttributionForClaim(empty, 'claim-a'), null);
  assert.strictEqual(selectAttributionForClaim(null, 'claim-a'), null);
  assert.strictEqual(selectAttributionForClaim(undefined, 'claim-a'), null);
}

function isDefensiveAgainstMalformedInput() {
  const malformed = {
    runId: 'run-1',
    attributions: [null, undefined, { text: 'no claimId' }, { claimId: 'claim-a', text: 'A', eventIds: [] }],
  } as unknown as AnswerProvenance;

  assert.doesNotThrow(() => selectAttributionForClaim(malformed, 'claim-a'));
  const found = selectAttributionForClaim(malformed, 'claim-a');
  assert.ok(found);
  assert.strictEqual(found?.claimId, 'claim-a');

  assert.strictEqual(selectAttributionForClaim(malformed, ''), null, 'an empty claimId never matches');
}

function main() {
  console.log('Running claim provenance selector tests...');
  findsAttributionByClaimId();
  returnsNullWhenClaimIsAbsent();
  returnsNullForEmptyOrMissingProvenance();
  isDefensiveAgainstMalformedInput();
  console.log('Claim provenance selector tests passed.');
}

main();
