// server/browserGateway.ts
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { browserExtensionActor, logTypedAudit } from './auditRecord';
import { auditBrowserExtensionEvent, auditBrowserPairRequested, auditBrowserPortalDisconnect } from './browserGatewayAudit';
import { authenticatePortalRequest, operatorPrincipalForRequest } from './operatorPrincipal';

export const browserRouter = Router();

export interface BrowserSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  runtimeId: string;
  installationId: string;
  pairedAt?: Date;
}

import {
  EvidenceOwnership, 
  BrowserTrust, 
  ObservationItem, 
  EvidenceItem, 
  ExtractionResult 
} from './evidence/evidenceTypes';

export type {
  EvidenceOwnership, 
  BrowserTrust, 
  ObservationItem, 
  EvidenceItem, 
  ExtractionResult 
};

import { browserEvidenceStore } from './browserEvidenceStore';
import { buildPhase1ObservationPayload, buildStoredExtraction, validateBrowserEnvelope } from './browserGatewayValidation';

let activePairingCode: string | null = null;
let pairingCodeExpires: Date | null = null;
let failedAttempts = 0;

const sessions = new Map<string, BrowserSession>();
const refreshTokens = new Map<string, BrowserSession>();
const processedIdempotencyKeys = new Set<string>();

const ALLOWED_READONLY_CAPABILITIES = new Set([
  'browser.page.observe',
  'browser.selection.observe',
  'browser.article.extract',
  'browser.outline.extract',
  'browser.table.extract',
  'browser.links.extract',
  'browser.codeBlocks.extract',
  'browser.metadata.extract',
  'browser.structuredData.extract'
]);

function sanitizeText(text: any): string {
  if (typeof text !== 'string') return '';
  return text.trim();
}

export function requireExtensionToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization?.split(' ')[1];
  if (!authHeader || !sessions.has(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing extension session token' });
  }
  (req as any).browserSession = sessions.get(authHeader);
  next();
}

export function checkLoopbackBinding(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLoopback = ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost') || ip === '::ffff:127.0.0.1';
  if (!isLoopback) {
    return res.status(403).json({ error: 'Forbidden: Browser Operator Gateway binds to local loopback interface only' });
  }
  next();
}

browserRouter.use(checkLoopbackBinding);

function requirePortalToken(req: Request, res: Response, next: NextFunction) {
  const portalToken = process.env.PORTAL_TOKEN || '';
  if (!authenticatePortalRequest(req, portalToken)) {
    return res.status(401).json({ error: 'PaneTera authorization required' });
  }
  next();
}

// POST /api/browser/pairing/start -> Initiated by authenticated portal workspace UI
browserRouter.post('/pairing/start', requirePortalToken, (req: Request, res: Response) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let generated = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) generated += '-';
    const randIndex = crypto.randomInt(0, chars.length);
    generated += chars[randIndex];
  }

  activePairingCode = generated;
  pairingCodeExpires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry
  failedAttempts = 0;

  auditBrowserPairRequested(operatorPrincipalForRequest(req));

  res.json({ code: generated, expiresAt: pairingCodeExpires.toISOString() });
});

// Portal-facing connection summary. Tokens and refresh credentials never
// cross this boundary; Rig only receives identity, time, and health metadata.
browserRouter.get('/pairing/status', requirePortalToken, (_req: Request, res: Response) => {
  const unique = new Map<string, BrowserSession>();
  for (const session of sessions.values()) unique.set(session.sessionId, session);
  res.json({
    gateway: 'current',
    pending: Boolean(activePairingCode && pairingCodeExpires && pairingCodeExpires > new Date()),
    sessions: Array.from(unique.values()).map((session) => ({
      sessionId: session.sessionId,
      runtimeId: session.runtimeId,
      installationId: session.installationId,
      pairedAt: session.pairedAt?.toISOString() ?? null,
    })),
  });
});

browserRouter.delete('/pairing/pending', requirePortalToken, (_req: Request, res: Response) => {
  activePairingCode = null;
  pairingCodeExpires = null;
  failedAttempts = 0;
  return res.json({ success: true });
});

browserRouter.delete('/pairing/sessions/:sessionId', requirePortalToken, (req: Request, res: Response) => {
  const session = Array.from(sessions.values()).find((candidate) => candidate.sessionId === req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Browser connection not found' });
  sessions.delete(session.accessToken);
  refreshTokens.delete(session.refreshToken);
  auditBrowserPortalDisconnect(session, operatorPrincipalForRequest(req));
  return res.json({ success: true });
});

// POST /api/browser/pairing/exchange -> Extension exchanges code for session tokens
browserRouter.post('/pairing/exchange', (req: Request, res: Response) => {
  const { code, runtimeId, installationId } = req.body;

  if (
    typeof code !== 'string' || code.length > 16 ||
    typeof runtimeId !== 'string' || runtimeId.length < 1 || runtimeId.length > 100 ||
    typeof installationId !== 'string' || installationId.length < 1 || installationId.length > 100
  ) {
    return res.status(400).json({ error: 'Invalid pairing parameters' });
  }

  if (failedAttempts >= 5) {
    return res.status(429).json({ error: 'Too many failed attempts. Start a new connection from Rig.' });
  }

  if (!activePairingCode || !pairingCodeExpires || new Date() > pairingCodeExpires) {
    return res.status(400).json({ error: 'Pairing code expired or not initialized' });
  }

  const formattedCode = sanitizeText(code).replace(/-/g, '').toUpperCase();
  const targetCode = activePairingCode.replace(/-/g, '').toUpperCase();

  const codeBuf = Buffer.from(formattedCode);
  const targetBuf = Buffer.from(targetCode);

  if (codeBuf.length !== targetBuf.length || !crypto.timingSafeEqual(codeBuf, targetBuf)) {
    failedAttempts++;
    return res.status(400).json({ error: 'Invalid pairing code' });
  }

  const sessionId = 'sess-' + crypto.randomUUID();
  const accessToken = 'tok_' + crypto.randomBytes(32).toString('base64url');
  const refreshToken = 'ref_' + crypto.randomBytes(32).toString('base64url');

  const newSession: BrowserSession = {
    sessionId,
    accessToken,
    refreshToken,
    runtimeId: sanitizeText(runtimeId),
    installationId: sanitizeText(installationId),
    pairedAt: new Date()
  };

  sessions.set(accessToken, newSession);
  refreshTokens.set(refreshToken, newSession);

  activePairingCode = null;
  pairingCodeExpires = null;

  auditBrowserExtensionEvent('browser.pair', newSession);

  res.json({ accessToken, refreshToken });
});

// POST /api/browser/token/refresh
browserRouter.post('/token/refresh', (req: Request, res: Response) => {
  const { refreshToken, installationId } = req.body;
  if (
    typeof refreshToken !== 'string' || refreshToken.length < 1 || refreshToken.length > 200 ||
    typeof installationId !== 'string' || installationId.length < 1 || installationId.length > 100
  ) {
    return res.status(400).json({ error: 'Invalid refresh parameters' });
  }

  const session = refreshTokens.get(refreshToken);
  if (!session || session.installationId !== installationId) {
    return res.status(401).json({ error: 'Invalid refresh token or installation mismatch' });
  }

  const newAccessToken = 'tok_' + crypto.randomBytes(32).toString('base64url');
  sessions.delete(session.accessToken);
  session.accessToken = newAccessToken;
  sessions.set(newAccessToken, session);

  res.json({ accessToken: newAccessToken });
});

// GET /api/browser/health
browserRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// GET /api/browser/session
browserRouter.get('/session', requireExtensionToken, (req: Request, res: Response) => {
  const session = (req as any).browserSession as BrowserSession;
  res.json({
    paired: true,
    runtimeId: session.runtimeId,
    installationId: session.installationId,
    pairedAt: session.pairedAt
  });
});

// DELETE /api/browser/session
browserRouter.delete('/session', requireExtensionToken, (req: Request, res: Response) => {
  const session = (req as any).browserSession as BrowserSession;
  sessions.delete(session.accessToken);
  refreshTokens.delete(session.refreshToken);

  auditBrowserExtensionEvent('browser.disconnect', session);

  res.json({ success: true });
});

// POST /api/browser/observations -> Adds captured DOM info to feed
browserRouter.post('/observations', requireExtensionToken, (req: Request, res: Response) => {
  const validated = validateBrowserEnvelope(req.body, ALLOWED_READONLY_CAPABILITIES);
  if (!validated.ok) return res.status(400).json({ error: validated.error });
  const envelope = validated.value;
  const { idempotencyKey } = envelope;
  if (processedIdempotencyKeys.has(idempotencyKey)) return res.status(409).json({ error: 'Duplicate transaction key' });

  const session = (req as any).browserSession as BrowserSession;
  
  const ownership: EvidenceOwnership = {
    ownerId: session.installationId,
    createdBy: {
      type: "browser-extension",
      actorId: session.runtimeId
    },
    sourceSessionId: session.sessionId
  };
  
  const trust: BrowserTrust = {
    sourceType: "browser-dom",
    trustLevel: "untrusted",
    instructionAuthority: "none"
  };

  browserEvidenceStore.applyRetentionPolicy();
  const captureId = 'capture-' + crypto.randomUUID();
  let elementsMatched = 0;

  if (envelope.isPhase1) {
    const phase1 = buildPhase1ObservationPayload(envelope);
    if (!phase1.ok) return res.status(400).json({ error: phase1.error });
    const newObs: ObservationItem = {
      captureId,
      ownership,
      trust,
      captureType: "page-selection",
      title: phase1.value.title,
      url: phase1.value.url,
      origin: phase1.value.origin,
      selectedText: phase1.value.selectedText,
      capturedAt: new Date().toISOString()
    };

    browserEvidenceStore.storeObservation(newObs);

    logTypedAudit({
      event: 'browser.observe',
      // Server-derived from the authenticated session, not from the request
      // body. The id is a fingerprint of the durable installation, so the
      // session bearer never becomes an actor identity.
      actor: browserExtensionActor(session),
      outcome: 'success',
      policyDecision: 'allowed',
      correlation: { captureId },
      details: {
        capability: envelope.capability,
        targetUrl: newObs.url,
        note: `Observed context: "${newObs.title}"`,
      },
    });
  } else {
    const extraction = buildStoredExtraction(envelope, ownership, trust, captureId);
    if (!extraction.ok) return res.status(400).json({ error: extraction.error });
    const extractionPayload = extraction.value;
    browserEvidenceStore.storeExtraction(extractionPayload);
    elementsMatched = extractionPayload.evidence.elementsMatched;

    logTypedAudit({
      event: 'browser.extract',
      actor: browserExtensionActor(session),
      outcome: 'success',
      policyDecision: 'allowed',
      correlation: { extractionId: extractionPayload.extractionId, captureId },
      details: {
        capability: envelope.capability,
        targetUrl: extractionPayload.source.url,
        note: `Extracted ${envelope.capability} from "${extractionPayload.source.title}"`,
      },
    });
  }

  processedIdempotencyKeys.add(idempotencyKey);
  if (processedIdempotencyKeys.size > 1000) {
    const first = processedIdempotencyKeys.values().next().value;
    if (first) processedIdempotencyKeys.delete(first);
  }

  res.json({
    transactionId: envelope.transactionId,
    status: "completed",
    policyDecision: "allowed",
    actualTarget: {
      tabId: envelope.target.tabId,
      frameId: envelope.target.frameId || 0,
      origin: envelope.target.expectedOrigin
    },
    evidence: {
      elementsMatched
    },
    data: {
      captureId
    },
    warnings: [],
    completedAt: new Date().toISOString()
  });
});

// GET /api/browser/observations
browserRouter.get('/observations', (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization?.split(' ')[1];
  const portalToken = process.env.PORTAL_TOKEN || '';
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization headers' });
  }

  const isMaster = authHeader === portalToken;
  const isExtension = sessions.has(authHeader);

  if (!isMaster && !isExtension) {
    return res.status(401).json({ error: 'Unauthorized session' });
  }

  const after = req.query.after as string;
  const filteredObs = browserEvidenceStore.getObservations(after);
  const filteredExt = browserEvidenceStore.getExtractions(after);
  return res.json({ observations: filteredObs, extractions: filteredExt });
});

// GET /api/browser/observations/:captureId
browserRouter.get('/observations/:captureId', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization?.split(' ')[1];
  const portalToken = process.env.PORTAL_TOKEN || '';
  if (!authHeader || (authHeader !== portalToken && !sessions.has(authHeader))) {
    return res.status(401).json({ error: 'Unauthorized lookup session' });
  }

  const item = browserEvidenceStore.getObservationByCaptureId(req.params.captureId);
  const ext = browserEvidenceStore.getExtractionById(req.params.captureId);
  
  if (!item && !ext) {
    return res.status(404).json({ error: 'Observation context not found' });
  }

  res.json(item || ext);
});

export function getPairedBrowserInstallations(): Array<{ installationId: string; pairedAt?: Date }> {
  const seen = new Set<string>();
  const result: Array<{ installationId: string; pairedAt?: Date }> = [];
  for (const session of sessions.values()) {
    if (!seen.has(session.installationId)) {
      seen.add(session.installationId);
      result.push({ installationId: session.installationId, pairedAt: session.pairedAt });
    }
  }
  return result;
}

export function isBrowserInstallationPaired(installationId: string): boolean {
  for (const session of sessions.values()) {
    if (session.installationId === installationId) return true;
  }
  return false;
}
