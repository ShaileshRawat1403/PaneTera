// src/utils/appObservation.ts
//
// Fetches one bridge observation from the authenticated creative routes.
// Every failure becomes an observation outcome; nothing here assumes the
// application is reachable (ADR-004).

import type { AppObservation } from '../surfaces/appConnection';

const CONNECTIONS = new Set(['connected', 'disconnected', 'error']);

export async function fetchAppObservation(
  path: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AppObservation> {
  let response: Response;
  try {
    response = await fetchImpl(path, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error: unknown) {
    return { connection: 'error', error: `Observation request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    return { connection: 'error', error: `Observation request failed with HTTP ${response.status}.` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { connection: 'error', error: 'Observation response was not JSON.' };
  }
  if (!body || typeof body !== 'object' || !CONNECTIONS.has(String((body as { connection?: unknown }).connection))) {
    return { connection: 'error', error: 'Observation response was malformed.' };
  }

  const { connection, observedAt, data, error } = body as Record<string, unknown>;
  return {
    connection: connection as AppObservation['connection'],
    observedAt: typeof observedAt === 'string' ? observedAt : undefined,
    data,
    error: typeof error === 'string' ? error : undefined,
  };
}
