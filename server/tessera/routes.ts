// server/tessera/routes.ts
// Express router exposing Tessera Evidence & Provenance Graph endpoints.

import { Router, Request, Response } from 'express';
import { EvidenceGraphResolver } from './evidenceResolver';

export const tesseraResolver = new EvidenceGraphResolver();
export const tesseraRouter = Router();

// POST /api/tessera/sessions - Create research session
tesseraRouter.post('/sessions', (req: Request, res: Response) => {
  const { title, workspaceId } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'A valid session title string is required' });
  }

  try {
    const session = tesseraResolver.createSession(title.trim(), workspaceId);
    return res.json({ session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create research session' });
  }
});

// GET /api/tessera/sessions/:id - Retrieve research session graph
tesseraRouter.get('/sessions/:id', (req: Request, res: Response) => {
  const session = tesseraResolver.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Research session not found' });
  }
  return res.json({ session });
});

// POST /api/tessera/sessions/:id/evidence - Add evidence item to session
tesseraRouter.post('/sessions/:id/evidence', (req: Request, res: Response) => {
  const { sourceType, title, urlOrPath, snippet, lineRange } = req.body || {};
  if (!sourceType || !title || !urlOrPath || !snippet) {
    return res.status(400).json({ error: 'Missing required evidence fields (sourceType, title, urlOrPath, snippet)' });
  }

  try {
    const evidence = tesseraResolver.addEvidence(req.params.id, {
      sourceType,
      title,
      urlOrPath,
      snippet,
      lineRange,
    });
    return res.json({ evidence });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to add evidence' });
  }
});

// POST /api/tessera/analysis/synthesize - Synthesize provenance-backed report
tesseraRouter.post('/analysis/synthesize', (req: Request, res: Response) => {
  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const analysis = tesseraResolver.synthesizeAnalysis(sessionId);
    return res.json({ analysis });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to synthesize analysis' });
  }
});
