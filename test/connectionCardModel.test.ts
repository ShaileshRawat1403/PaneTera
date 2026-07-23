// test/connectionCardModel.test.ts
//
// The Rig connection-card presentation truth table, tested for every state and
// health combination, plus the boundary between connection health and capability
// inventory freshness. The rules it holds: connected is never presented as
// healthy when health is degraded or unknown; inventory freshness is derived from
// discovery, never from health; a truncated snapshot never shows a complete
// count; only backend-supported actions are offered; and inactive states are
// never conflated with failures.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  resolveConnectionCard,
  actionLabel,
  inventoryLabel,
  type ConnectionState,
  type ConnectionHealth,
} from '../src/components/rig/connectionCardModel';

const STATES: ConnectionState[] = [
  'disabled', 'approval-required', 'starting', 'auth-required', 'connected', 'unreachable', 'stopped',
];
const HEALTHS: ConnectionHealth[] = ['current', 'degraded', 'not-measured'];
const view = (
  state: ConnectionState,
  health: ConnectionHealth,
  opts: { capabilityCount?: number; discoveredAt?: string | null; truncated?: boolean } = {},
) => resolveConnectionCard({
  state,
  health,
  capabilityCount: opts.capabilityCount ?? 0,
  discoveredAt: opts.discoveredAt ?? null,
  truncated: opts.truncated ?? false,
});

describe('every state and health combination resolves without gaps', () => {
  for (const state of STATES) {
    for (const health of HEALTHS) {
      it(`${state} / ${health} produces a complete view`, () => {
        const v = view(state, health, { capabilityCount: 2, discoveredAt: '2026-01-01T00:00:00Z' });
        assert.ok(v.statusText.length > 0, 'has status text');
        assert.ok(['current', 'inactive', 'pending', 'attention', 'failure'].includes(v.category));
        assert.ok(['neutral', 'muted', 'attention', 'danger'].includes(v.tone));
        assert.strictEqual(v.needsAttention, v.category === 'attention' || v.category === 'failure');
        assert.ok(v.secondaryActions.includes('inspect') && v.secondaryActions.includes('remove'));
        assert.strictEqual(v.secondaryActions[v.secondaryActions.length - 1], 'remove', 'remove is last');
        assert.ok(['discovered', 'last-discovered', 'not-discovered'].includes(v.inventoryFreshness));
        assert.strictEqual(typeof v.inventoryTruncated, 'boolean');
      });
    }
  }
});

describe('connection health is not capability-inventory freshness', () => {
  it('does not call a connected+current snapshot live or authoritative', () => {
    const discovered = view('connected', 'current', { capabilityCount: 3, discoveredAt: '2026-01-01T00:00:00Z' });
    assert.strictEqual(discovered.inventoryFreshness, 'discovered');
    const label = inventoryLabel(3, discovered.inventoryFreshness, discovered.inventoryTruncated);
    assert.ok(!/live|authoritative/i.test(label), 'inventory is factual, not "live"');
    assert.strictEqual(label, '3 discovered');
  });

  it('current health with NO discovery timestamp is not-discovered, never live', () => {
    // The data-plane can set health to current after an invocation without ever
    // discovering capabilities. Health current must not imply a fresh inventory.
    const v = view('connected', 'current', { capabilityCount: 0, discoveredAt: null });
    assert.strictEqual(v.inventoryFreshness, 'not-discovered');
    assert.strictEqual(inventoryLabel(0, v.inventoryFreshness, v.inventoryTruncated), 'No capabilities · not discovered');
    assert.ok(!/live|authoritative/i.test(inventoryLabel(0, v.inventoryFreshness, v.inventoryTruncated)));
  });

  it('current health with an old snapshot reports discovered, not live', () => {
    const v = view('connected', 'current', { capabilityCount: 5, discoveredAt: '2001-01-01T00:00:00Z' });
    assert.strictEqual(v.inventoryFreshness, 'discovered');
    assert.strictEqual(inventoryLabel(5, v.inventoryFreshness, v.inventoryTruncated), '5 discovered');
  });

  it('the reproduction: connected+current, discoveredAt null, truncated true is never "No capabilities · live"', () => {
    const v = view('connected', 'current', { capabilityCount: 0, discoveredAt: null, truncated: true });
    const label = inventoryLabel(0, v.inventoryFreshness, v.inventoryTruncated);
    assert.ok(!/live/i.test(label), 'no false live claim');
    assert.strictEqual(label, '0 shown · inventory truncated');
  });

  it('a truncated snapshot never shows an exact complete count', () => {
    const v = view('connected', 'current', { capabilityCount: 8, discoveredAt: '2026-01-01T00:00:00Z', truncated: true });
    assert.strictEqual(v.inventoryTruncated, true);
    const label = inventoryLabel(8, v.inventoryFreshness, v.inventoryTruncated);
    assert.strictEqual(label, '8 shown · inventory truncated');
    assert.ok(/shown/.test(label) && /truncated/.test(label), 'incompleteness is disclosed');
    assert.ok(!/^8 discovered$/.test(label), 'not presented as a complete discovered count');
  });

  it('a disconnected connection with a prior snapshot reads last-discovered', () => {
    const v = view('stopped', 'not-measured', { capabilityCount: 4, discoveredAt: '2026-01-01T00:00:00Z' });
    assert.strictEqual(v.inventoryFreshness, 'last-discovered');
    assert.strictEqual(inventoryLabel(4, v.inventoryFreshness, v.inventoryTruncated), '4 last discovered');
  });
});

describe('connected is not the same as healthy', () => {
  it('is cleanly healthy only when connected and current', () => {
    const healthy = view('connected', 'current', { capabilityCount: 3, discoveredAt: '2026-01-01T00:00:00Z' });
    assert.strictEqual(healthy.statusText, 'Connected');
    assert.strictEqual(healthy.healthText, null, 'no qualifier when current');
    assert.strictEqual(healthy.category, 'current');
    assert.strictEqual(healthy.needsAttention, false);
  });

  it('degraded health is attention and visibly qualified', () => {
    const v = view('connected', 'degraded', { capabilityCount: 3, discoveredAt: '2026-01-01T00:00:00Z' });
    assert.strictEqual(v.category, 'attention');
    assert.strictEqual(v.tone, 'attention');
    assert.strictEqual(v.needsAttention, true);
    assert.ok(v.healthText && /degraded/i.test(v.healthText));
  });

  it('not-measured health stays live but is never cleanly healthy', () => {
    const v = view('connected', 'not-measured', { capabilityCount: 3, discoveredAt: '2026-01-01T00:00:00Z' });
    assert.notStrictEqual(v.healthText, null);
    assert.ok(/not measured/i.test(v.healthText ?? ''));
  });

  it('degraded and unknown health never match the cleanly-healthy health qualifier', () => {
    const healthy = view('connected', 'current', { discoveredAt: '2026-01-01T00:00:00Z' });
    for (const health of ['degraded', 'not-measured'] as ConnectionHealth[]) {
      const v = view('connected', health, { discoveredAt: '2026-01-01T00:00:00Z' });
      assert.notStrictEqual(v.healthText, healthy.healthText, `${health} carries a qualifier`);
    }
  });
});

describe('only supported actions are offered', () => {
  it('offers review-connect only for approval-required, stopped, and unreachable', () => {
    for (const state of STATES) {
      const v = view(state, 'not-measured');
      const expected = ['approval-required', 'stopped', 'unreachable'].includes(state);
      assert.strictEqual(v.primaryAction === 'review-connect', expected, `${state} review-connect support`);
    }
  });

  it('offers refresh and stop only for a connected connection', () => {
    for (const state of STATES) {
      const v = view(state, 'current');
      const hasLive = v.secondaryActions.includes('refresh') || v.secondaryActions.includes('stop');
      assert.strictEqual(hasLive, state === 'connected', `${state} refresh/stop support`);
    }
  });

  it('never offers a recovery action for auth-required, starting, or disabled', () => {
    for (const state of ['auth-required', 'starting', 'disabled'] as ConnectionState[]) {
      const v = view(state, 'not-measured', { capabilityCount: 1 });
      assert.strictEqual(v.primaryAction, null, `${state} has no invented recovery`);
      assert.deepStrictEqual(v.secondaryActions, ['inspect', 'remove'], `${state} offers only inspect and remove`);
    }
  });

  it('labels review-connect as connect for a new proposal and reconnect otherwise', () => {
    assert.strictEqual(actionLabel('review-connect', 'approval-required'), 'Review and connect');
    assert.strictEqual(actionLabel('review-connect', 'stopped'), 'Review and reconnect');
    assert.strictEqual(actionLabel('review-connect', 'unreachable'), 'Review and reconnect');
  });
});

describe('inactive and failed states are distinct', () => {
  it('separates stopped and disabled (inactive) from unreachable (failure)', () => {
    const stopped = view('stopped', 'not-measured');
    const disabled = view('disabled', 'not-measured');
    const unreachable = view('unreachable', 'not-measured');
    for (const inactive of [stopped, disabled]) {
      assert.strictEqual(inactive.category, 'inactive');
      assert.strictEqual(inactive.tone, 'muted');
      assert.strictEqual(inactive.needsAttention, false);
    }
    assert.strictEqual(unreachable.category, 'failure');
    assert.strictEqual(unreachable.tone, 'danger');
    assert.strictEqual(unreachable.needsAttention, true);
    assert.notStrictEqual(stopped.category, unreachable.category);
  });

  it('treats starting as pending, not attention or failure', () => {
    const v = view('starting', 'not-measured');
    assert.strictEqual(v.category, 'pending');
    assert.strictEqual(v.needsAttention, false);
  });
});
