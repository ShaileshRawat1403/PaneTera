import express, { Request, Response } from 'express';
import { localAppRegistry } from './localAppRegistry';
import { localAppProbe, type ProbeResult, type ProbeStatus } from './localAppProbe';
import { logTypedAudit, systemActor, unknownActor, type TypedAuditRecord } from '../auditRecord';
import { requirePortalToken } from '../operatorPrincipal';

export const workbenchRouter = express.Router();

export function auditWorkbenchProbe(input: {
  appId: string;
  status: ProbeStatus;
  safeOrigin?: string;
}): TypedAuditRecord {
  const succeeded = input.status === 'reachable' || input.status === 'framing-likely-blocked';
  return logTypedAudit({
    event: 'workbench.app.probe',
    actor: systemActor('workbench-probe'),
    outcome: succeeded ? 'success' : 'error',
    policyDecision: 'allowed',
    details: { appId: input.appId, status: input.status, safeOrigin: input.safeOrigin },
  });
}

export function auditWorkbenchClientEvent(input: {
  event: string;
  appId?: unknown;
  operation?: unknown;
  resultStatus?: unknown;
  transactionId?: unknown;
  safeOrigin: string;
}): TypedAuditRecord {
  return logTypedAudit({
    event: input.event,
    actor: unknownActor('workbench-client-unattributed'),
    outcome: 'unknown',
    policyDecision: 'not-applicable',
    details: {
      appId: input.appId,
      operation: input.operation,
      clientReportedStatus: input.resultStatus,
      clientTransactionId: input.transactionId,
      safeOrigin: input.safeOrigin,
    },
  });
}

workbenchRouter.get('/apps', async (req: Request, res: Response) => {
  const apps = localAppRegistry.getEnabledApps();
  res.json({ apps });
});

workbenchRouter.get('/apps/:appId/status', async (req: Request, res: Response) => {
  const appId = req.params.appId;

  const appDef = localAppRegistry.getApp(appId);
  if (!appDef || !appDef.enabled) {
    auditWorkbenchProbe({ appId, status: 'invalid-configuration' });
    return res.json({ status: 'invalid-configuration' } as ProbeResult);
  }

  // Preflight logic: resolve redirect chain boundedly
  let currentUrl = appDef.url;
  let finalStatus: ProbeResult | null = null;
  let redirects = 0;
  
  while (redirects < 3) {
    const probeRes = await localAppProbe.probe(currentUrl);
    
    if (probeRes.status === 'redirect' && probeRes.redirectUrl) {
      if (!localAppRegistry.isValidLoopbackUrl(probeRes.redirectUrl)) {
        finalStatus = { status: 'invalid-configuration', url: currentUrl, details: 'Redirects to remote origin' };
        break;
      }
      currentUrl = probeRes.redirectUrl;
      redirects++;
    } else {
      finalStatus = probeRes;
      break;
    }
  }

  if (!finalStatus) {
    finalStatus = { status: 'invalid-configuration', url: currentUrl, details: 'Too many redirects' };
  }

  // The backend uses derived safe origin (appDef.url) for audit, not full URL
  auditWorkbenchProbe({
    appId,
    status: finalStatus.status,
    safeOrigin: new URL(appDef.url).origin
  });

  return res.json(finalStatus);
});

workbenchRouter.post('/audit', requirePortalToken, async (req: Request, res: Response) => {
  const body = req.body || {};

  const { event, appId, operation, resultStatus, transactionId } = body;
  
  const allowedEvents = [
    'workbench.app.open',
    'workbench.app.close',
    'workbench.app.reload',
    'workbench.app.open_external',
    'workbench.layout.change'
  ];

  if (!allowedEvents.includes(event)) {
    return res.status(400).json({ error: 'Invalid event' });
  }

  let safeOrigin = 'unknown';
  if (appId) {
    const appDef = localAppRegistry.getApp(appId);
    if (appDef) {
       safeOrigin = new URL(appDef.url).origin;
    }
  }

  auditWorkbenchClientEvent({
    event,
    appId,
    transactionId,
    safeOrigin,
    operation,
    resultStatus,
  });

  return res.json({ success: true });
});
