export type WorkstationGuidance = {
  kind: 'attention' | 'now' | 'next';
  text: string;
};

/**
 * What the client actually knows about the gateway.
 *
 * This began as a single boolean and could not tell the truth with one. Health
 * is read from /api/health, which sits behind the master-token gate, so a
 * false reading conflates three different situations with three different
 * remedies:
 *
 *   signed-out   no token was ever presented, so nothing was asked
 *   rejected     a token was presented and the server refused it
 *   unreachable  the request was made and the gateway did not answer
 *
 * Only the last one is a gateway problem. Reporting the first two as
 * "unavailable" sends a person to restart a server that is running perfectly
 * well -- which is exactly what it did: a stale token from an earlier
 * PORTAL_TOKEN produced a 401, and the workstation announced that its gateway
 * was down.
 *
 * 'unknown' is the state before the first request settles. It is deliberately
 * not an attention state, because a moment of "unavailable" during startup is
 * the same lie told briefly.
 */
export type GatewayState = 'ok' | 'signed-out' | 'rejected' | 'unreachable' | 'unknown';

/**
 * One compact line near the composer answers the most relevant workstation
 * question. Healthy systems stay quiet; attention replaces next-step advice
 * only when a required capability is actually unavailable -- and only when the
 * client has actually established that, rather than merely failed to ask.
 */
export function workstationGuidance(input: {
  gateway: GatewayState;
  loading: boolean;
  hasProject: boolean;
  objective: string;
}): WorkstationGuidance {
  // Checked in order of what the person can act on. Each of these is a
  // different remedy, which is the whole reason they are separate states.
  if (input.gateway === 'signed-out') {
    return { kind: 'attention', text: 'Sign in to PaneTera to reach your workstation.' };
  }
  if (input.gateway === 'rejected') {
    return { kind: 'attention', text: 'PaneTera did not accept your sign-in. Sign in again.' };
  }
  if (input.gateway === 'unreachable') {
    return { kind: 'attention', text: 'PaneTera\u2019s local gateway is unavailable.' };
  }
  // 'ok' and 'unknown' both fall through. Nothing is known to be wrong, and an
  // unsettled request is not a fault to announce.
  if (input.loading) {
    return { kind: 'now', text: 'PaneTera is working on your request.' };
  }
  if (!input.hasProject) {
    return { kind: 'next', text: 'Choose a project above or describe a goal.' };
  }
  if (!input.objective.trim()) {
    return { kind: 'next', text: 'Set the outcome you want to reach.' };
  }
  return { kind: 'next', text: 'Describe the next result you want to see.' };
}
