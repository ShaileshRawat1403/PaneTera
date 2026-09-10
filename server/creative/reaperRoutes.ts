// server/creative/reaperRoutes.ts
//
// Express routes for observing the live REAPER desktop instance.
//
// Read-only by design. Mutations reach REAPER only through the Rig
// proposal → approval → invocation path; there is no direct action route.

import { Router, Request, Response } from 'express';
import { sendReaperCommand } from './reaperClient.js';
import { toObservationResponse } from './observation.js';

export const reaperRouter = Router();

// GET /api/reaper/status - Test live connection
reaperRouter.get('/status', async (_req: Request, res: Response) => {
  res.json(toObservationResponse(await sendReaperCommand('status')));
});

// GET /api/reaper/scene - Fetch live project summary
reaperRouter.get('/scene', async (_req: Request, res: Response) => {
  res.json(toObservationResponse(await sendReaperCommand('reaper.get_project_summary')));
});

// GET /api/reaper/peaks - Fetch track peaks
reaperRouter.get('/peaks', async (_req: Request, res: Response) => {
  res.json(toObservationResponse(await sendReaperCommand('reaper.get_track_peaks', {})));
});
