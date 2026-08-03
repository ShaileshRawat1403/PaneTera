import assert from 'assert';
import { cockpitStatusMeta, gaugeWidthPercent } from '../src/components/workstation/CockpitStatusBar';

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

// The gauge clamps to 0..100 and defends against NaN and out-of-range input.
function gaugeClampsAndDefends() {
  assert.strictEqual(gaugeWidthPercent(0), 0);
  assert.strictEqual(gaugeWidthPercent(0.5), 50);
  assert.strictEqual(gaugeWidthPercent(1), 100);
  assert.strictEqual(gaugeWidthPercent(1.8), 100, 'over-range clamps to full');
  assert.strictEqual(gaugeWidthPercent(-2), 0, 'negative clamps to empty');
  assert.strictEqual(gaugeWidthPercent(Number.NaN), 0, 'NaN is treated as empty');
}

function main() {
  console.log('Running cockpit status bar tests...');
  statusMetaMapsEveryState();
  statusMetaDefaultsToIdle();
  gaugeClampsAndDefends();
  console.log('Cockpit status bar tests passed.');
}

main();
