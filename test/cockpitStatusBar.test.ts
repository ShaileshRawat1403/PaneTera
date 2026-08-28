import assert from 'assert';
import { cockpitStatusMeta, headroomReadout } from '../src/components/workstation/CockpitStatusBar';
import { countApprovalsWaiting, isRunAwaitingApproval } from '../src/components/workstation/approvalsWaiting';

// Every run status maps to a stable label; colour follows the contract (idle is
// neutral, working violet, waiting brass, success green, failure danger). We
// assert the labels and that distinct states never collapse to one colour.
function statusMetaMapsEveryState() {
  assert.strictEqual(cockpitStatusMeta('idle').label, 'Idle');
  assert.strictEqual(cockpitStatusMeta('working').label, 'Working');
  assert.strictEqual(cockpitStatusMeta('awaiting-approval').label, 'Awaiting approval');
  assert.strictEqual(cockpitStatusMeta('succeeded').label, 'Done');
  assert.strictEqual(cockpitStatusMeta('failed').label, 'Failed');

  const colors = new Set([
    cockpitStatusMeta('idle').color,
    cockpitStatusMeta('working').color,
    cockpitStatusMeta('awaiting-approval').color,
    cockpitStatusMeta('succeeded').color,
    cockpitStatusMeta('failed').color,
  ]);
  assert.strictEqual(colors.size, 5, 'each status has its own colour');
}

// An unknown status is treated as idle rather than throwing, so a stray value
// from the run pipeline can never blank the strip.
function statusMetaDefaultsToIdle() {
  assert.strictEqual(cockpitStatusMeta('mystery' as never).label, 'Idle');
}

// Headroom reports a defined quantity or nothing at all. With no capsule in
// play there is no fact to report, so the slot renders as absence rather than
// as a zeroed instrument -- the distinction the old percentage gauge lost.
function headroomReportsFactsOrNothing() {
  assert.strictEqual(
    headroomReadout({ headroomActive: false, headroomOpenQuestions: 0 }),
    null,
    'no capsule renders nothing, not an empty gauge',
  );
  assert.strictEqual(
    headroomReadout({ headroomActive: false, headroomOpenQuestions: 5 }),
    null,
    'questions without an active capsule are not reported',
  );
  assert.strictEqual(
    headroomReadout({ headroomActive: true, headroomOpenQuestions: 0 }),
    'Headroom · active',
    'an active capsule with nothing open says so plainly',
  );
  assert.strictEqual(
    headroomReadout({ headroomActive: true, headroomOpenQuestions: 4 }),
    'Headroom · 4 open',
  );
  // No ceiling: a large count is reported as itself. The old gauge pinned
  // anything above eight items at full and could never move again.
  assert.strictEqual(
    headroomReadout({ headroomActive: true, headroomOpenQuestions: 23 }),
    'Headroom · 23 open',
    'the count has no invented ceiling',
  );
  assert.strictEqual(
    headroomReadout({ headroomActive: true, headroomOpenQuestions: Number.NaN }),
    'Headroom · active',
    'NaN degrades to the active label, never to a number',
  );
  assert.strictEqual(
    headroomReadout({ headroomActive: true, headroomOpenQuestions: -3 }),
    'Headroom · active',
    'a negative count is not rendered',
  );
}

// Approvals are counted, not inferred. The old code reported
// `waiting-approval ? 1 : 0`, so two pending decisions displayed as one.
function approvalsAreCountedNotInferred() {
  const proposed = { type: 'ProposedAction' };
  const other = { type: 'CodePreview' };

  assert.strictEqual(countApprovalsWaiting([], null), 0);
  assert.strictEqual(countApprovalsWaiting(null, null), 0, 'a missing feed is zero, not a throw');
  assert.strictEqual(countApprovalsWaiting(undefined, undefined), 0);
  assert.strictEqual(countApprovalsWaiting([other, other], null), 0, 'unrelated items do not count');
  assert.strictEqual(countApprovalsWaiting([proposed], null), 1);

  // The case the old flag could not express.
  assert.strictEqual(
    countApprovalsWaiting([proposed, other, proposed, proposed], null),
    3,
    'three pending approvals report as three',
  );

  // The active run is a separate slot from the feed, so the two sources add
  // rather than double-count.
  const waitingRun = { type: 'AgentRun', data: { status: 'waiting-approval' } };
  assert.strictEqual(countApprovalsWaiting([], waitingRun), 1);
  assert.strictEqual(countApprovalsWaiting([proposed, proposed], waitingRun), 3);

  // A run in any other state is not an approval.
  assert.strictEqual(countApprovalsWaiting([], { type: 'AgentRun', data: { status: 'running' } }), 0);
  assert.strictEqual(countApprovalsWaiting([], { type: 'AgentRun', data: {} }), 0);
  assert.strictEqual(countApprovalsWaiting([], { type: 'AgentRun' }), 0, 'a run with no data is not waiting');
  assert.strictEqual(countApprovalsWaiting([], { type: 'BrowserObservation', data: { status: 'waiting-approval' } }), 0,
    'only an AgentRun can be awaiting approval');
}

// The run status and the approvals count read the same predicate, so the strip
// can never say "Awaiting approval" beside a count of zero.
function runStatusAndCountAgree() {
  const waitingRun = { type: 'AgentRun', data: { status: 'waiting-approval' } };
  assert.strictEqual(isRunAwaitingApproval(waitingRun), true);
  assert.strictEqual(isRunAwaitingApproval({ type: 'AgentRun', data: { status: 'running' } }), false);
  assert.strictEqual(isRunAwaitingApproval(null), false);
  assert.strictEqual(isRunAwaitingApproval(undefined), false);

  assert.ok(
    countApprovalsWaiting([], waitingRun) > 0,
    'if the strip says awaiting approval, the count must be non-zero',
  );
}

function main() {
  console.log('Running cockpit status bar tests...');
  statusMetaMapsEveryState();
  statusMetaDefaultsToIdle();
  headroomReportsFactsOrNothing();
  approvalsAreCountedNotInferred();
  runStatusAndCountAgree();
  console.log('Cockpit status bar tests passed.');
}

main();
