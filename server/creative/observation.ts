// server/creative/observation.ts
//
// Shapes a bridge response into an observation the workstation can rely on
// (ADR-004). observedAt is stamped only when the bridge actually returned
// state. A refused socket means the application or its bridge is not
// running, which is a normal disconnected state, not a PaneTera failure.

export type ObservationConnection = 'connected' | 'disconnected' | 'error';

export interface BridgeObservationResponse {
  connection: ObservationConnection;
  observedAt?: string;
  data?: unknown;
  error?: string;
}

const NOT_RUNNING = /^Could not connect to /;

export function toObservationResponse(
  result: { success: boolean; data?: unknown; error?: string },
  now: Date = new Date(),
): BridgeObservationResponse {
  if (result.success && result.data !== undefined && result.data !== null) {
    return { connection: 'connected', observedAt: now.toISOString(), data: result.data };
  }
  const error = result.error
    || (result.success ? 'The bridge responded without state.' : 'The bridge reported a failure without detail.');
  return { connection: NOT_RUNNING.test(error) ? 'disconnected' : 'error', error };
}
