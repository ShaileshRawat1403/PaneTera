// server/native/routes.ts
// Express router for native file and folder grants.

import { Router, Request, Response } from 'express';
import { nativeGrantStore } from './picker';

export const nativeRouter = Router();

/**
 * POST /api/native-grants/file
 * Create a short-lived (15-minute) grant for an explicit local file.
 */
nativeRouter.post('/file', (req: Request, res: Response) => {
  try {
    const { targetPath, workspaceRoot } = req.body || {};
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'targetPath string is required' });
    }
    const grant = nativeGrantStore.createGrant({
      type: 'file',
      targetPath,
      workspaceRoot,
    });
    return res.json({ version: 2, grant });
  } catch (err: any) {
    return res.status(400).json({ version: 2, error: err.message || 'Failed to create file grant' });
  }
});

/**
 * POST /api/native-grants/folder
 * Create a short-lived (15-minute) grant for an explicit local folder.
 */
nativeRouter.post('/folder', (req: Request, res: Response) => {
  try {
    const { targetPath, workspaceRoot } = req.body || {};
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'targetPath string is required' });
    }
    const grant = nativeGrantStore.createGrant({
      type: 'folder',
      targetPath,
      workspaceRoot,
    });
    return res.json({ version: 2, grant });
  } catch (err: any) {
    return res.status(400).json({ version: 2, error: err.message || 'Failed to create folder grant' });
  }
});

/**
 * GET /api/native-grants/:token
 * Verify an existing grant token.
 */
nativeRouter.get('/:token', (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const grant = nativeGrantStore.verifyGrant(token);
    return res.json({ version: 2, grant });
  } catch (err: any) {
    return res.status(404).json({ version: 2, error: err.message || 'Invalid or expired grant token' });
  }
});

/**
 * DELETE /api/native-grants/:token
 * Revoke an active grant token.
 */
nativeRouter.delete('/:token', (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const revoked = nativeGrantStore.revokeGrant(token);
    return res.json({ version: 2, revoked });
  } catch (err: any) {
    return res.status(400).json({ version: 2, error: err.message || 'Failed to revoke grant token' });
  }
});
