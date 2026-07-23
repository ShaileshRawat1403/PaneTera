// server/mcp/mcpAudit.ts
//
// The single attribution point for the MCP browser façade.
//
// Every façade audit line goes through here, so the choice of actor is made in
// exactly one place and can be tested by calling this function with a real
// principal rather than by reading the handlers' source. The choice is the
// whole point of the slice:
//
//   - an authenticated MCP client is a `mcp-client`, never a `browser-extension`,
//     because the principal is not bound to any paired browser installation;
//   - a call that failed authentication has no principal, so it is `unknown`,
//     not attributed to a client the server could not verify.

import {
  type AuditOutcome,
  type PolicyDecision,
  logTypedAudit,
  mcpClientActor,
  unknownActor,
} from '../auditRecord';
import type { McpClientPrincipal } from './browserMcpAuth';

export interface McpFacadeAuditInput {
  /** The authenticated principal, or null when authentication failed. */
  principal: McpClientPrincipal | null;
  event: string;
  outcome: AuditOutcome;
  policyDecision: PolicyDecision;
  transactionId?: string;
  capability?: string;
  resource?: string;
  detail?: string;
}

export function emitMcpFacadeAudit(input: McpFacadeAuditInput) {
  const actor = input.principal
    ? mcpClientActor(input.principal)
    : unknownActor('mcp-unauthenticated');

  return logTypedAudit({
    event: input.event,
    actor,
    outcome: input.outcome,
    policyDecision: input.policyDecision,
    correlation: {},
    details: {
      transactionId: input.transactionId,
      capability: input.capability,
      resource: input.resource,
      note: input.detail,
    },
  });
}
