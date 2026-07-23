import {
  fingerprint,
  logTypedAudit,
  systemActor,
  unknownActor,
  type AuditOutcome,
  type PolicyDecision,
  type TypedAuditRecord,
} from '../auditRecord';

interface ResearchAuditInput {
  event: string;
  outcome: AuditOutcome;
  policyDecision?: PolicyDecision;
  sessionId?: string;
  ownerId?: string;
  details?: Record<string, unknown>;
}

function researchDetails(input: ResearchAuditInput): Record<string, unknown> {
  return {
    sessionId: input.sessionId,
    ownerFingerprint: input.ownerId ? fingerprint(input.ownerId) : undefined,
    ...(input.details ?? {}),
  };
}

/** A research request whose authenticated human principal is not known. */
export function auditResearchOperator(input: ResearchAuditInput): TypedAuditRecord {
  return logTypedAudit({
    event: input.event,
    actor: unknownActor('research-caller-unattributed'),
    outcome: input.outcome,
    policyDecision: input.policyDecision ?? 'allowed',
    details: researchDetails(input),
  });
}

/** PaneTera's research store, validator, or pipeline performing work. */
export function auditResearchSystem(input: ResearchAuditInput): TypedAuditRecord {
  return logTypedAudit({
    event: input.event,
    actor: systemActor('research-pipeline'),
    outcome: input.outcome,
    policyDecision: input.policyDecision ?? 'allowed',
    details: researchDetails(input),
  });
}
