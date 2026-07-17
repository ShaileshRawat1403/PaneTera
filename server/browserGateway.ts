// server/browserGateway.ts
import { Router, Request, Response, NextFunction } from 'express';
import { logAudit } from './audit';

export const browserRouter = Router();

export interface BrowserSession {
  accessToken: string;
  refreshToken: string;
  runtimeId: string;
  installationId: string;
  pairedAt: Date;
}

export interface ObservationItem {
  captureId: string;
  sourceType: "browser-dom";
  trustLevel: "untrusted";
  instructionAuthority: "none";
  captureType: "page-selection";
  title: string;
  url: string;
  origin: string;
  selectedText: string;
  capturedAt: string;
}

export interface ExtractionResult {
  extractionId: string;
  parentCaptureId: string;
  capability: string;
  source: {
    title: string;
    url: string;
    origin: string;
    capturedAt: string;
  };
  trust: {
    sourceType: "browser-dom";
    trustLevel: "untrusted";
    instructionAuthority: "none";
  };
  data: any;
  evidence: {
    items: any[];
    elementsMatched: number;
    contentBytes: number;
  };
  warnings: string[];
  truncated: boolean;
}

// In-Memory Database for Alpha Session
let activePairingCode: string | null = null;
let pairingCodeExpires: Date | null = null;
let failedAttempts = 0;

const sessions = new Map<string, BrowserSession>();
const refreshTokens = new Map<string, BrowserSession>(); // Maps refreshToken string to session
export const observations: ObservationItem[] = [];
export const extractions: ExtractionResult[] = [];
const processedIdempotencyKeys = new Set<string>();

// Helper to sanitize input strings
function sanitizeText(text: any): string {
  if (typeof text !== 'string') return '';
  return text.trim();
}

// Security: Enforce Bearer authentication matching extension sessions
export function requireExtensionToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization?.split(' ')[1];
  if (!authHeader || !sessions.has(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing extension session token' });
  }
  (req as any).browserSession = sessions.get(authHeader);
  next();
}

// Helper to validate loopback request origin binding
export function checkLoopbackBinding(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLoopback = ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost') || ip === '::ffff:127.0.0.1';
  if (!isLoopback) {
    return res.status(403).json({ error: 'Forbidden: Browser Operator Gateway binds to local loopback interface only' });
  }
  next();
}

// Mount loopback check globally on this router
browserRouter.use(checkLoopbackBinding);

// POST /api/browser/pairing/start -> Initiated by authenticated portal workspace UI
browserRouter.post('/pairing/start', (req: Request, res: Response) => {
  // Validate master token manually
  const portalToken = process.env.PORTAL_TOKEN || '';
  const authHeader = req.headers.authorization?.split(' ')[1];
  if (!authHeader || authHeader !== portalToken) {
    return res.status(401).json({ error: 'Unauthorized master workspace token required' });
  }

  // Generate 8-character pairing code: XXXX-XXXX
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let generated = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) generated += '-';
    generated += chars[Math.floor(Math.random() * chars.length)];
  }

  activePairingCode = generated;
  pairingCodeExpires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry
  failedAttempts = 0;

  res.json({ code: generated });
});

// POST /api/browser/pairing/exchange -> Extension exchanges code for session tokens
browserRouter.post('/pairing/exchange', (req: Request, res: Response) => {
  const { code, runtimeId, installationId } = req.body;

  if (!code || !runtimeId || !installationId) {
    return res.status(400).json({ error: 'Missing pairing parameters' });
  }

  if (failedAttempts >= 5) {
    return res.status(429).json({ error: 'Too many failed attempts. Please regenerate code in the Workbench.' });
  }

  if (!activePairingCode || !pairingCodeExpires || new Date() > pairingCodeExpires) {
    return res.status(400).json({ error: 'Pairing code expired or not initialized' });
  }

  const formattedCode = sanitizeText(code).replace(/-/g, '');
  const targetCode = activePairingCode.replace(/-/g, '');

  if (formattedCode !== targetCode) {
    failedAttempts++;
    return res.status(400).json({ error: 'Invalid pairing code' });
  }

  // Generate access & refresh tokens
  const accessToken = 'tok-' + Math.random().toString(36).substring(2) + '-' + Date.now();
  const refreshToken = 'ref-' + Math.random().toString(36).substring(2) + '-' + Date.now();

  const newSession: BrowserSession = {
    accessToken,
    refreshToken,
    runtimeId: sanitizeText(runtimeId),
    installationId: sanitizeText(installationId),
    pairedAt: new Date()
  };

  sessions.set(accessToken, newSession);
  refreshTokens.set(refreshToken, newSession);

  // Clear pairing code
  activePairingCode = null;
  pairingCodeExpires = null;

  logAudit('browser.pair', {
    actor: `extension:${runtimeId}`,
    installationId,
    capability: 'browser.pair',
    policyDecision: 'allowed',
    status: 'success',
    details: 'Browser extension paired successfully.'
  });

  res.json({ accessToken, refreshToken });
});

// POST /api/browser/token/refresh -> Refreshes temporary access token
browserRouter.post('/token/refresh', (req: Request, res: Response) => {
  const { refreshToken, installationId } = req.body;
  if (!refreshToken || !installationId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const session = refreshTokens.get(refreshToken);
  if (!session || session.installationId !== installationId) {
    return res.status(401).json({ error: 'Invalid refresh token or installation mismatch' });
  }

  // Generate new access token
  const newAccessToken = 'tok-' + Math.random().toString(36).substring(2) + '-' + Date.now();
  
  // Revoke old session key
  sessions.delete(session.accessToken);

  session.accessToken = newAccessToken;
  sessions.set(newAccessToken, session);

  res.json({ accessToken: newAccessToken });
});

// GET /api/browser/health
browserRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// GET /api/browser/session -> Fetch paired session stats
browserRouter.get('/session', requireExtensionToken, (req: Request, res: Response) => {
  const session = (req as any).browserSession as BrowserSession;
  res.json({
    paired: true,
    runtimeId: session.runtimeId,
    installationId: session.installationId,
    pairedAt: session.pairedAt
  });
});

// DELETE /api/browser/session -> Disconnect extension session
browserRouter.delete('/session', requireExtensionToken, (req: Request, res: Response) => {
  const session = (req as any).browserSession as BrowserSession;
  sessions.delete(session.accessToken);
  refreshTokens.delete(session.refreshToken);

  logAudit('browser.disconnect', {
    actor: `extension:${session.runtimeId}`,
    installationId: session.installationId,
    capability: 'browser.disconnect',
    policyDecision: 'allowed',
    status: 'success',
    details: 'Browser extension disconnected.'
  });

  res.json({ success: true });
});

// POST /api/browser/observations -> Adds captured DOM info to feed
browserRouter.post('/observations', requireExtensionToken, (req: Request, res: Response) => {
  const envelope = req.body;
  if (!envelope || !envelope.target || !envelope.payload) {
    return res.status(400).json({ error: 'Invalid envelope structure' });
  }

  const { title, url, selectedText } = envelope.payload;
  const expectedOrigin = envelope.target.expectedOrigin;

  if (!url || !title) {
    return res.status(400).json({ error: 'Missing URL or Title parameters' });
  }

  const { idempotencyKey } = envelope;
  if (idempotencyKey) {
    if (processedIdempotencyKeys.has(idempotencyKey)) {
      return res.status(400).json({ error: 'Duplicate transaction key (idempotency enforcement)' });
    }
    processedIdempotencyKeys.add(idempotencyKey);
    if (processedIdempotencyKeys.size > 1000) {
      const first = processedIdempotencyKeys.values().next().value;
      if (first) processedIdempotencyKeys.delete(first);
    }
  }

  // Enforce origin verification bounds
  let derivedOrigin = '';
  try {
    derivedOrigin = new URL(url || envelope.payload.source?.url || '').origin;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload target URL format' });
  }

  if (expectedOrigin.toLowerCase() !== derivedOrigin.toLowerCase()) {
    return res.status(400).json({ error: 'Security Exception: expected target origin mismatch' });
  }

  const maxBytes = envelope.constraints?.maxOutputBytes || 2000000;
  const payloadString = JSON.stringify(envelope.payload);
  const contentBytes = typeof Blob !== 'undefined' ? new Blob([payloadString]).size : Buffer.byteLength(payloadString, 'utf8');
  if (contentBytes > maxBytes) {
    return res.status(400).json({ error: 'Payload size limit exceeded constraints bounds' });
  }
  if (contentBytes > 2000000) {
    return res.status(400).json({ error: 'Payload size limit exceeded maximum bounds (2MB)' });
  }

  const session = (req as any).browserSession as BrowserSession;

  // Retention duration constraint: remove observations older than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  while (observations.length > 0 && observations[0].capturedAt < oneHourAgo) {
    observations.shift();
  }
  while (extractions.length > 0 && extractions[0].source.capturedAt < oneHourAgo) {
    extractions.shift();
  }

  const captureId = 'capture-' + Math.random().toString(36).substring(2) + '-' + Date.now();
  
  if (envelope.capability === 'browser.page.observe' || envelope.capability === 'browser.selection.observe') {
    // Phase 1 Observation
    const newObs: ObservationItem = {
      captureId,
      sourceType: "browser-dom",
      trustLevel: "untrusted",
      instructionAuthority: "none",
      captureType: "page-selection",
      title: sanitizeText(title),
      url: sanitizeText(url),
      origin: sanitizeText(expectedOrigin),
      selectedText: sanitizeText(selectedText || ''),
      capturedAt: new Date().toISOString()
    };

    if (observations.length >= 50) observations.shift();
    observations.push(newObs);

    logAudit('browser.observe', {
      actor: `extension:${session.runtimeId}`,
      installationId: session.installationId,
      capability: envelope.capability,
      targetUrl: newObs.url,
      captureId,
      policyDecision: 'allowed',
      status: 'success',
      details: `Observed context: "${newObs.title}"`
    });
  } else {
    // Phase 2 Extraction
    const extractionPayload = envelope.payload as ExtractionResult;
    extractionPayload.parentCaptureId = captureId;
    
    if (extractions.length >= 50) extractions.shift();
    extractions.push(extractionPayload);

    logAudit('browser.extract', {
      actor: `extension:${session.runtimeId}`,
      installationId: session.installationId,
      capability: envelope.capability,
      targetUrl: extractionPayload.source.url,
      extractionId: extractionPayload.extractionId,
      policyDecision: 'allowed',
      status: 'success',
      details: `Extracted ${envelope.capability} from "${extractionPayload.source.title}"`
    });
  }

  // Return normalized response envelope
  res.json({
    transactionId: envelope.transactionId,
    status: "completed",
    policyDecision: "allowed",
    actualTarget: {
      tabId: envelope.target.tabId,
      frameId: envelope.target.frameId || 0,
      origin: expectedOrigin
    },
    evidence: {
      elementsMatched: 1
    },
    data: {
      captureId
    },
    warnings: [],
    completedAt: new Date().toISOString()
  });
});

// GET /api/browser/observations -> Poll list of observations (Master Token OR Extension Token allowed)
browserRouter.get('/observations', (req: Request, res: Response, next: NextFunction) => {
  // Authentication check: supports either master token OR active extension token
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

  // Cursor-based filtering
  const after = req.query.after as string;
  if (after) {
    const filteredObs = observations.filter(o => o.capturedAt > after);
    const filteredExt = extractions.filter(e => e.source.capturedAt > after);
    return res.json({ observations: filteredObs, extractions: filteredExt });
  }

  res.json({ observations, extractions });
});

// GET /api/browser/observations/:captureId -> Single observation lookup
browserRouter.get('/observations/:captureId', (req: Request, res: Response) => {
  // Auth check
  const authHeader = req.headers.authorization?.split(' ')[1];
  const portalToken = process.env.PORTAL_TOKEN || '';
  if (!authHeader || (authHeader !== portalToken && !sessions.has(authHeader))) {
    return res.status(401).json({ error: 'Unauthorized lookup session' });
  }

  const item = observations.find(o => o.captureId === req.params.captureId);
  const ext = extractions.find(e => e.parentCaptureId === req.params.captureId || e.extractionId === req.params.captureId);
  
  if (!item && !ext) {
    return res.status(404).json({ error: 'Observation context not found' });
  }

  res.json(item || ext);
});
