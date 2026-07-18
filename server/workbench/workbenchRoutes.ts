import express, { Request, Response } from 'express';
import { localAppRegistry } from './localAppRegistry';
import { localAppProbe, ProbeResult } from './localAppProbe';
import { logAudit } from '../audit';

export const workbenchRouter = express.Router();

// Middleware placeholder for extracting user/actor if needed
const getActor = (req: Request) => {
  // @ts-ignore
  return req.user?.id || 'unknown';
};

workbenchRouter.get('/apps', async (req: Request, res: Response) => {
  const apps = localAppRegistry.getEnabledApps();
  res.json({ apps });
});

workbenchRouter.get('/apps/:appId/status', async (req: Request, res: Response) => {
  const appId = req.params.appId;
  const actor = getActor(req);

  const appDef = localAppRegistry.getApp(appId);
  if (!appDef || !appDef.enabled) {
    logAudit('workbench.app.probe', { appId, actor, status: 'invalid-configuration' });
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
  logAudit('workbench.app.probe', { 
    appId, 
    actor, 
    status: finalStatus.status,
    safeOrigin: new URL(appDef.url).origin
  });

  return res.json(finalStatus);
});

workbenchRouter.post('/audit', async (req: Request, res: Response) => {
  const actor = getActor(req);
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

  logAudit(event, {
    appId,
    actor,
    transactionId,
    safeOrigin,
    operation,
    status: resultStatus
  });

  return res.json({ success: true });
});
