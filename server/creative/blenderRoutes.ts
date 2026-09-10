// server/creative/blenderRoutes.ts
//
// Express routes for querying and commanding the live Blender desktop instance.

import { Router, Request, Response } from 'express';
import { sendBlenderCommand } from './blenderClient';

export const blenderRouter = Router();

// GET /api/blender/status - Test live connection
blenderRouter.get('/status', async (_req: Request, res: Response) => {
  const result = await sendBlenderCommand('status');
  res.json(result);
});

// GET /api/blender/scene - Fetch live scene summary
blenderRouter.get('/scene', async (_req: Request, res: Response) => {
  const result = await sendBlenderCommand('blender.get_scene_summary');
  res.json(result);
});

// POST /api/blender/action - Execute a domain operation
blenderRouter.post('/action', async (req: Request, res: Response) => {
  const { action, params } = req.body || {};
  if (!action) {
    res.status(400).json({ success: false, error: 'Missing action parameter' });
    return;
  }
  const result = await sendBlenderCommand(action, params || {});
  res.json(result);
});
