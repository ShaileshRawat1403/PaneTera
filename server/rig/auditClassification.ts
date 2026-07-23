// server/rig/auditClassification.ts
//
// The Rig audit truth table, in code, as the single source of truth for who
// acted on each lifecycle event. It exists so the classification can be tested
// directly and cannot drift per call site.
//
// The rule the reviewer insisted on: a connectionId in an event does not make
// the connector the actor.
//
//   - operator: a decision taken through the UI. No authoritative human
//     principal exists yet, so it is recorded as unknown / operator-unattributed,
//     never inferred as a human from the portal token.
//   - system: PaneTera's own runtime, transport, or discovery acted.
//   - connector: the connector itself produced I/O (a completed invocation, a
//     resource or prompt read). Only successful connector I/O qualifies; a
//     failure is not attributed to the connector, because the runtime cannot yet
//     distinguish a remote connector error from a transport failure.

import {
  type AuditActor,
  type AuditOutcome,
  type PolicyDecision,
  connectorActor,
  humanActor,
  systemActor,
  unknownActor,
} from '../auditRecord';
import type { OperatorPrincipal } from '../operatorPrincipal';

export type RigActorClass = 'operator' | 'system' | 'connector';

export interface RigAuditClass {
  actorClass: RigActorClass;
  outcome: AuditOutcome;
  policyDecision: PolicyDecision;
}

/**
 * The phase of an invocation, tracked explicitly so failure is classified by
 * where it happened, never by matching error text.
 *
 * `registry-lookup` is a local failure reading PaneTera's own connection state,
 * before the target is even known. `target-invalid` is the pre-claim rejection
 * of a request for a capability that is absent or disabled. `local-finalization`
 * covers everything after a successful connector call, including claim
 * consumption and provenance writes, so a consumption failure is not
 * misattributed to the connector call.
 */
export type InvocationPhase = 'registry-lookup' | 'target-invalid' | 'approval-claim' | 'connector-call' | 'local-finalization';

export const RIG_EVENT_CLASS: Record<string, RigAuditClass> = {
  // Operator governance actions.
  // Request rejections: the operator asked for something absent, disabled, or
  // malformed. Denied, and attributed to the operator, not the connector.
  'rig.resource.denied': { actorClass: 'operator', outcome: 'denied', policyDecision: 'denied' },
  'rig.prompt.denied': { actorClass: 'operator', outcome: 'denied', policyDecision: 'denied' },

  // Operator input validation failure. The operator supplied malformed input, so
  // the request errored before policy was ever consulted. It is not a policy
  // denial: the actor is the unattributed operator, the outcome is an error, and
  // policy remains allowed because nothing denied the action.
  'rig.prompt.invalid': { actorClass: 'operator', outcome: 'error', policyDecision: 'allowed' },
  'rig.connection.proposed': { actorClass: 'operator', outcome: 'success', policyDecision: 'approval-required' },
  'rig.connection.approved': { actorClass: 'operator', outcome: 'success', policyDecision: 'allowed' },
  'rig.connection.stopped': { actorClass: 'operator', outcome: 'success', policyDecision: 'allowed' },
  'rig.connection.removed': { actorClass: 'operator', outcome: 'success', policyDecision: 'allowed' },
  'rig.capability.policy': { actorClass: 'operator', outcome: 'success', policyDecision: 'allowed' },
  'rig.invocation.proposed': { actorClass: 'operator', outcome: 'success', policyDecision: 'approval-required' },
  'rig.invocation.approved': { actorClass: 'operator', outcome: 'success', policyDecision: 'allowed' },

  // System-observed runtime, transport, and discovery events.
  'rig.connection.connected': { actorClass: 'system', outcome: 'success', policyDecision: 'allowed' },
  'rig.connection.failed': { actorClass: 'system', outcome: 'error', policyDecision: 'allowed' },
  'rig.connection.transport-failed': { actorClass: 'system', outcome: 'error', policyDecision: 'allowed' },
  'rig.capabilities.changed': { actorClass: 'system', outcome: 'success', policyDecision: 'allowed' },
  'rig.resource.failed': { actorClass: 'system', outcome: 'error', policyDecision: 'allowed' },
  'rig.prompt.failed': { actorClass: 'system', outcome: 'error', policyDecision: 'allowed' },

  // Connector I/O, success only.
  'rig.invocation.completed': { actorClass: 'connector', outcome: 'success', policyDecision: 'allowed' },
  'rig.resource.read': { actorClass: 'connector', outcome: 'success', policyDecision: 'allowed' },
  'rig.prompt.read': { actorClass: 'connector', outcome: 'success', policyDecision: 'allowed' },
};

/**
 * Classify an invocation failure by the phase it failed in.
 *
 * Only an approval-claim rejection is an operator action, recorded denied. A
 * connector-call or local-finalization failure is a system-observed error: the
 * runtime cannot prove whether the connector responded with an error or the
 * transport failed, and a connector actor would claim more than the code knows.
 */
export function invocationFailureClass(phase: InvocationPhase): RigAuditClass {
  if (phase === 'target-invalid' || phase === 'approval-claim') {
    // The operator's request was refused before any connector work happened.
    return { actorClass: 'operator', outcome: 'denied', policyDecision: 'denied' };
  }
  // registry-lookup, connector-call, and local-finalization are all
  // system-observed errors: PaneTera's own state read failed, or the runtime
  // cannot prove a remote-versus-transport cause, or finalization failed.
  return { actorClass: 'system', outcome: 'error', policyDecision: 'allowed' };
}

/** Build the actor for a class. Only `connector` needs the governed connection. */
export function rigAuditActor(
  actorClass: RigActorClass,
  connection?: { connectionId: string; displayName?: string },
  principal?: OperatorPrincipal,
): AuditActor {
  if (actorClass === 'operator') return principal ? humanActor(principal) : unknownActor('operator-unattributed');
  if (actorClass === 'system') return systemActor();
  if (!connection) throw new Error('A connector actor requires the governed connection.');
  return connectorActor(connection);
}

/** The actor, outcome, and policy for a fixed-classification event. */
export function rigAuditFields(
  event: string,
  connection?: { connectionId: string; displayName?: string },
  principal?: OperatorPrincipal,
) {
  const cls = RIG_EVENT_CLASS[event];
  if (!cls) throw new Error(`No Rig audit classification for event: ${event}`);
  return {
    actor: rigAuditActor(cls.actorClass, connection, principal),
    outcome: cls.outcome,
    policyDecision: cls.policyDecision,
  };
}

/** The actor, outcome, and policy for an invocation failure in a given phase. */
export function rigInvocationFailureFields(phase: InvocationPhase, principal?: OperatorPrincipal) {
  const cls = invocationFailureClass(phase);
  return {
    actor: rigAuditActor(cls.actorClass, undefined, principal),
    outcome: cls.outcome,
    policyDecision: cls.policyDecision,
  };
}
