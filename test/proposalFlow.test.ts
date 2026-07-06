import assert from 'assert';
import { parseLocalCommandProposal, buildProposedActionData } from '../server/execution/index';

console.log('Running execution proposal flow smoke tests...');

// 1. Prove that a user prompt like "run npm run verify in flowright" produces a ProposedAction card with:
// - allowed: true
// - isDryRun: true
// - executionMode present
// - riskLevel present
// - command exactly "npm run verify"
const query1 = 'run npm run verify in flowright';
const proposal1 = parseLocalCommandProposal(query1);

assert.ok(proposal1 !== null, 'Should parse query successfully');
assert.strictEqual(proposal1.workspace, 'flowright');
assert.strictEqual(proposal1.command, 'npm run verify');

const card1 = buildProposedActionData(proposal1.workspace, proposal1.command, `Requested via: "${query1}"`);
assert.strictEqual(card1.allowed, true, 'Should be allowed: true');
assert.strictEqual(card1.isDryRun, true, 'Should be isDryRun: true');
assert.ok(card1.executionMode, 'Should have executionMode present');
assert.ok(card1.riskLevel, 'Should have riskLevel present');
assert.strictEqual(card1.command, 'npm run verify', 'Should have command exactly "npm run verify"');

// 2. Prove that a blocked command like "run npm install in flowright" does not create an approvable action:
// - either returns no ProposedAction, or returns ProposedAction with allowed: false
// - no approve path should be available for blocked commands
const query2 = 'run npm install in flowright';
const proposal2 = parseLocalCommandProposal(query2);

if (proposal2) {
  // If parseLocalCommandProposal (or resolveQueryLocally fallback parser) actually matched,
  // we must ensure that the ProposedAction created is allowed: false
  const card2 = buildProposedActionData(proposal2.workspace, proposal2.command, `Requested via: "${query2}"`);
  assert.strictEqual(card2.allowed, false, 'Should be allowed: false');
} else {
  // It returns null / no ProposedAction
  assert.strictEqual(proposal2, null, 'Should return no ProposedAction');
}

console.log('✓ All execution proposal flow smoke tests passed!');
