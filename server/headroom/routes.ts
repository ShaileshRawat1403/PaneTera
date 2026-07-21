import express from 'express';
import { logAudit } from '../audit';
import { HeadroomStore } from './store';

export const headroomRouter = express.Router();
const store = new HeadroomStore();

headroomRouter.post('/envelopes', async (req, res) => {
  try {
    const envelope = await store.createEnvelope(req.body);
    logAudit('headroom.envelope.created', {
      envelopeId: envelope.envelopeId,
      sessionId: envelope.sessionId,
      projectId: envelope.projectId,
      contextCount: envelope.context.length,
      materializedCount: envelope.materialized.length,
      exclusionCount: envelope.exclusions.length,
    });
    return res.status(201).json({ envelope });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.get('/envelopes', (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  res.json({ envelopes: store.listEnvelopes(sessionId) });
});

headroomRouter.get('/envelopes/:envelopeId', (req, res) => {
  const envelope = store.getEnvelope(req.params.envelopeId);
  if (!envelope) return res.status(404).json({ error: 'Headroom envelope not found.' });
  return res.json({ envelope });
});

headroomRouter.post('/envelopes/:envelopeId/pin', async (req, res) => {
  try {
    const capsule = await store.pinEnvelope(req.params.envelopeId, typeof req.body?.title === 'string' ? req.body.title : undefined);
    logAudit('headroom.envelope.pinned', { envelopeId: req.params.envelopeId, capsuleId: capsule.capsuleId });
    return res.status(201).json({ capsule });
  } catch (error: unknown) {
    return res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.get('/capsules', (_req, res) => res.json({ capsules: store.listCapsules() }));

headroomRouter.put('/capsules/:capsuleId', async (req, res) => {
  try {
    const capsule = await store.saveCapsule({ ...req.body, capsuleId: req.params.capsuleId });
    logAudit('headroom.capsule.updated', { capsuleId: capsule.capsuleId, projectId: capsule.projectId });
    return res.json({ capsule });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.post('/capsules', async (req, res) => {
  try {
    const capsule = await store.saveCapsule(req.body);
    logAudit('headroom.capsule.created', { capsuleId: capsule.capsuleId, projectId: capsule.projectId });
    return res.status(201).json({ capsule });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.delete('/capsules/:capsuleId', async (req, res) => {
  try {
    const capsule = await store.deleteCapsule(req.params.capsuleId);
    logAudit('headroom.capsule.deleted', { capsuleId: capsule.capsuleId, projectId: capsule.projectId });
    return res.json({ removed: true });
  } catch (error: unknown) {
    return res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
