import {
  logTypedAudit,
  humanActor,
  unknownActor,
  type AuditCorrelation,
  type AuditOutcome,
  type PolicyDecision,
  type TypedAuditRecord,
} from './auditRecord';
import type { OperatorPrincipal } from './operatorPrincipal';

/**
 * Record an operator-triggered action when PaneTera has no authenticated human
 * principal. The portal token authorises the request but does not identify a
 * person, so these events remain explicitly unattributed.
 */
export function auditOperatorAction(input: {
  event: string;
  principal?: OperatorPrincipal;
  outcome?: AuditOutcome;
  policyDecision?: PolicyDecision;
  correlation?: AuditCorrelation;
  details?: Record<string, unknown>;
}): TypedAuditRecord {
  return logTypedAudit({
    event: input.event,
    actor: input.principal ? humanActor(input.principal) : unknownActor('operator-unattributed'),
    outcome: input.outcome ?? 'success',
    policyDecision: input.policyDecision ?? 'allowed',
    correlation: input.correlation,
    details: input.details,
  });
}
