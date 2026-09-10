// server/creative/blenderRoutes.ts
//
// Express routes for observing the live Blender desktop instance.
//
// Read-only by design. Mutations reach Blender only through the Rig
// proposal → approval → invocation path; there is no direct action route.

import { Router, Request, Response } from 'express';
import { sendBlenderCommand } from './blenderClient';
import { toObservationResponse } from './observation';

export const blenderRouter = Router();

// GET /api/blender/status - Test live connection
blenderRouter.get('/status', async (_req: Request, res: Response) => {
  res.json(toObservationResponse(await sendBlenderCommand('status')));
});

// GET /api/blender/scene - Fetch live scene summary
blenderRouter.get('/scene', async (_req: Request, res: Response) => {
  res.json(toObservationResponse(await sendBlenderCommand('blender.get_scene_summary')));
});
