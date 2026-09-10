// server/creative/blenderRoutes.ts
//
// Express routes for observing the live Blender desktop instance.
//
// Read-only by design. Mutations reach Blender only through the Rig
// proposal → approval → invocation path; there is no direct action route.

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
