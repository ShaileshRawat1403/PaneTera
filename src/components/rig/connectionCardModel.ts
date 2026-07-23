// src/components/rig/connectionCardModel.ts
//
// The presentation truth table for a Rig connection card, in code, as the single
// place connection state and health are interpreted for the UI. It exists so a
// collapsed card can answer four questions at a glance — what is this, what state
// is it in, does it need attention, and what can I do — without scattering state
// interpretation through JSX, and without ever claiming more than the backend
// supports.
//
// Three rules are load-bearing:
//
//   1. Connected does not mean healthy. A connection can be connected while its
//      health is degraded or not yet measured. Those never render as cleanly
//      healthy: degraded is promoted to attention, and not-measured carries an
//      explicit "Health not measured" qualifier.
//
//   2. Health is not inventory freshness. The capability snapshot's freshness is
//      derived only from `discoveredAt` and `truncated`, never from health. The
//      runtime marks health `current` after an invocation, resource read, or
//      prompt read without re-discovering capabilities, so a healthy transport
//      says nothing about the snapshot. Freshness is reported factually
//      (discovered / last discovered / not discovered) and a truncated snapshot
//      is never shown as a complete count. Connector declarations are not treated
//      as trusted application truth.
//
//   3. Only supported actions appear. Review-and-connect exists only for the
//      states the approve route accepts (approval-required, stopped, unreachable);
//      refresh and stop exist only for a connected connection. Auth-required,
//      starting, and disabled have no backend recovery action, so the card offers
//      none — it signals the state honestly and leaves inspect and remove.
//
// Truth table (state × health). Health governs the status qualifier; inventory
// freshness is a separate axis governed by discovery, not shown here:
//
//   disabled            → inactive  / muted     / actions: inspect, remove
//   approval-required   → attention / attention / primary: review-connect
//   starting            → pending   / neutral   / actions: inspect, remove
//   auth-required       → attention / attention / actions: inspect, remove
//   connected+current   → current   / neutral   / actions: refresh, stop, inspect, remove
//   connected+degraded  → attention / attention / actions: refresh, stop, inspect, remove
//   connected+not-meas. → current   / neutral*  / actions: refresh, stop, inspect, remove
//   unreachable         → failure   / danger    / primary: review-connect
//   stopped             → inactive  / muted     / primary: review-connect
//
//   * connected+not-measured stays the 'current' category because it is a live,
//     active connection, but it is never "cleanly healthy": it carries the
//     "Health not measured" qualifier, so it is visibly distinct from
//     connected+current.

import type { ConnectionState, ConnectionHealth } from '../../rig/types';

export type { ConnectionState, ConnectionHealth };

export type RigStateCategory = 'current' | 'inactive' | 'pending' | 'attention' | 'failure';
export type RigCardTone = 'neutral' | 'muted' | 'attention' | 'danger';
export type RigCardAction = 'review-connect' | 'refresh' | 'stop' | 'inspect' | 'remove';

/**
 * The freshness of the capability snapshot, derived from when it was discovered,
 * never from connection health.
 *
 * This is deliberately separate from health. The runtime marks a connection's
 * health `current` after a successful invocation, resource read, or prompt read
 * without re-discovering capabilities, so health can be current while the
 * snapshot is old or was never taken. Calling connector-declared capabilities
 * "live" or "authoritative" would treat a connector's own declaration as trusted
 * application truth, which it is not. The labels here are factual: a snapshot was
 * discovered, was last discovered before the connection dropped, or was never
 * discovered.
 */
export type RigInventoryFreshness = 'discovered' | 'last-discovered' | 'not-discovered';

export interface ConnectionCardView {
  /** Human-readable state, e.g. "Connected", "Approval required". */
  statusText: string;
  /** A health qualifier shown only while connected, or null. */
  healthText: string | null;
  category: RigStateCategory;
  tone: RigCardTone;
  /** True for attention and failure categories: the card should stand out. */
  needsAttention: boolean;
  /** The single most important supported action, or null when none is supported. */
  primaryAction: RigCardAction | null;
  /** Supported secondary actions, in display order, with remove always last. */
  secondaryActions: RigCardAction[];
  /** Whether the capability snapshot was discovered, and how recently. */
  inventoryFreshness: RigInventoryFreshness;
  /** Whether the snapshot is known to be incomplete. A truncated inventory must
   *  never be presented with an exact complete count. */
  inventoryTruncated: boolean;
}

interface StateBase {
  statusText: string;
  category: RigStateCategory;
  tone: RigCardTone;
  /** Whether the approve (review-and-connect) route accepts this state. */
  recoverable: boolean;
}

const STATE_BASE: Record<ConnectionState, StateBase> = {
  disabled: { statusText: 'Disabled', category: 'inactive', tone: 'muted', recoverable: false },
  'approval-required': { statusText: 'Approval required', category: 'attention', tone: 'attention', recoverable: true },
  starting: { statusText: 'Starting…', category: 'pending', tone: 'neutral', recoverable: false },
  'auth-required': { statusText: 'Authentication required', category: 'attention', tone: 'attention', recoverable: false },
  connected: { statusText: 'Connected', category: 'current', tone: 'neutral', recoverable: false },
  unreachable: { statusText: 'Unreachable', category: 'failure', tone: 'danger', recoverable: true },
  stopped: { statusText: 'Stopped', category: 'inactive', tone: 'muted', recoverable: true },
};

const CATEGORY_NEEDS_ATTENTION: Record<RigStateCategory, boolean> = {
  current: false,
  inactive: false,
  pending: false,
  attention: true,
  failure: true,
};

/**
 * Interpret one connection into a card view.
 *
 * Two dimensions are kept strictly separate. Health governs the status
 * qualifier: a connected connection whose health is degraded is promoted to
 * attention, and one whose health is not measured stays live but qualified.
 * Inventory freshness governs the capability snapshot and is derived only from
 * `discoveredAt` and `truncated`, never from health, so a connection cannot claim
 * a fresh inventory merely because its transport is healthy.
 */
export function resolveConnectionCard(input: {
  state: ConnectionState;
  health: ConnectionHealth;
  capabilityCount: number;
  discoveredAt: string | null;
  truncated: boolean;
}): ConnectionCardView {
  const base = STATE_BASE[input.state];
  const connected = input.state === 'connected';

  let category = base.category;
  let tone = base.tone;
  let healthText: string | null = null;

  if (connected) {
    if (input.health === 'degraded') {
      // Connected but degraded is a concern, not a clean state.
      category = 'attention';
      tone = 'attention';
      healthText = 'Health degraded';
    } else if (input.health === 'not-measured') {
      // Live but unverified: qualified so it never reads as cleanly healthy.
      healthText = 'Health not measured';
    }
  }

  // Inventory freshness comes from discovery, not health. A snapshot exists only
  // if it was discovered; while disconnected it is at best last-known.
  let inventoryFreshness: RigInventoryFreshness;
  if (input.discoveredAt === null) {
    inventoryFreshness = 'not-discovered';
  } else {
    inventoryFreshness = connected ? 'discovered' : 'last-discovered';
  }

  const secondaryActions: RigCardAction[] = [];
  if (connected) {
    secondaryActions.push('refresh', 'stop');
  }
  // Inspect and remove are always available; remove is always last so it reads
  // as subordinate to recovery and inspection.
  secondaryActions.push('inspect', 'remove');

  return {
    statusText: base.statusText,
    healthText,
    category,
    tone,
    needsAttention: CATEGORY_NEEDS_ATTENTION[category],
    primaryAction: base.recoverable ? 'review-connect' : null,
    secondaryActions,
    inventoryFreshness,
    inventoryTruncated: input.truncated,
  };
}

const FRESHNESS_WORD: Record<RigInventoryFreshness, string> = {
  discovered: 'discovered',
  'last-discovered': 'last discovered',
  'not-discovered': 'not discovered',
};

/**
 * The factual inventory line for a card.
 *
 * A truncated snapshot is reported as "N shown · inventory truncated" and never
 * as an exact complete count, because the connector told us the list is
 * incomplete. Otherwise the count is paired with how recently it was discovered.
 */
export function inventoryLabel(count: number, freshness: RigInventoryFreshness, truncated: boolean): string {
  if (truncated) return `${count} shown · inventory truncated`;
  const word = FRESHNESS_WORD[freshness];
  return count === 0 ? `No capabilities · ${word}` : `${count} ${word}`;
}

/** The label for an action button. Review-and-connect reads as reconnect when re-establishing. */
export function actionLabel(action: RigCardAction, state: ConnectionState): string {
  switch (action) {
    case 'review-connect':
      return state === 'approval-required' ? 'Review and connect' : 'Review and reconnect';
    case 'refresh':
      return 'Refresh';
    case 'stop':
      return 'Stop';
    case 'inspect':
      return 'Inspect';
    case 'remove':
      return 'Remove';
  }
}
