// server/creative/reaperRoutes.ts
//
// Express routes for querying and commanding the live REAPER desktop instance.

import { Router, Request, Response } from 'express';
import { sendReaperCommand } from './reaperClient.js';

export const reaperRouter = Router();

// GET /api/reaper/status - Test live connection
reaperRouter.get('/status', async (_req: Request, res: Response) => {
  const result = await sendReaperCommand('status');
  res.json(result);
});

// GET /api/reaper/scene - Fetch live project summary
reaperRouter.get('/scene', async (_req: Request, res: Response) => {
  const result = await sendReaperCommand('reaper.get_project_summary');
  res.json(result);
});

// GET /api/reaper/peaks - Fetch track peaks
reaperRouter.get('/peaks', async (_req: Request, res: Response) => {
  const result = await sendReaperCommand('reaper.get_track_peaks', {});
  res.json(result);
});

// POST /api/reaper/action - Execute a domain operation
reaperRouter.post('/action', async (req: Request, res: Response) => {
  const { action, params } = req.body || {};
  if (!action) {
    res.status(400).json({ success: false, error: 'Missing action parameter' });
    return;
  }
  const result = await sendReaperCommand(action, params || {});
  res.json(result);
});
