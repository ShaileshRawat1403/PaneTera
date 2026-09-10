// src/surfaces/appConnection.ts
//
// Connection state for integrated local applications (Blender, REAPER).
//
// Invariant (ADR-004): a runtime fact comes only from runtime evidence.
// Connection state is observed, never assumed, and presence is 'live' only
// while an observation is current.

import type { SurfacePresence } from './types';

export type AppConnectionState = 'unknown' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** One observation outcome, as returned by the authenticated creative routes. */
export interface AppObservation {
  connection: 'connected' | 'disconnected' | 'error';
  /** Set only when the bridge actually returned state. */
  observedAt?: string;
  data?: unknown;
  error?: string;
}

/**
 * - connected with an observation   → 'live'
 * - an earlier observation retained → 'snapshot'
 * - disconnected, never observed    → 'disconnected'
 * - anything else                   → 'unavailable'
 */
export function presenceForAppConnection(connection: AppConnectionState, hasObservation: boolean): SurfacePresence {
  if (connection === 'connected' && hasObservation) return 'live';
  if (hasObservation) return 'snapshot';
  if (connection === 'disconnected') return 'disconnected';
  return 'unavailable';
}

const CONNECTION_LABELS: Record<AppConnectionState, string> = {
  unknown: 'Connection state unknown',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Not connected',
  error: 'Connection error',
};

export function describeAppConnection(connection: AppConnectionState, observedAt?: string): string {
  const label = CONNECTION_LABELS[connection];
  return observedAt && connection !== 'connected' ? `${label} · last observed ${observedAt}` : label;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
