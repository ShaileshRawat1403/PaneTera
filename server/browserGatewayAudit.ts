import { browserExtensionActor, logTypedAudit, type TypedAuditRecord } from './auditRecord';
import { auditOperatorAction } from './operatorAudit';
import type { OperatorPrincipal } from './operatorPrincipal';

interface BrowserActorSession {
  installationId: string;
  runtimeId?: string;
}

export function auditBrowserPairRequested(principal?: OperatorPrincipal): TypedAuditRecord {
  return auditOperatorAction({
    event: 'browser.pair.requested',
    principal,
    outcome: 'pending',
    policyDecision: 'approval-required',
    details: { capability: 'browser.pair' },
  });
}

export function auditBrowserPortalDisconnect(
  session: BrowserActorSession & { sessionId?: string },
  principal?: OperatorPrincipal,
): TypedAuditRecord {
  return auditOperatorAction({
    event: 'browser.disconnect',
    principal,
    details: { capability: 'browser.disconnect', sessionId: session.sessionId },
  });
}

export function auditBrowserExtensionEvent(
  event: 'browser.pair' | 'browser.disconnect',
  session: BrowserActorSession,
): TypedAuditRecord {
  return logTypedAudit({
    event,
    actor: browserExtensionActor(session),
    outcome: 'success',
    policyDecision: 'allowed',
    details: { capability: event },
  });
}
