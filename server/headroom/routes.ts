import express from 'express';
import { auditOperatorAction } from '../operatorAudit';
import { operatorPrincipalForRequest } from '../operatorPrincipal';
import { HeadroomStore } from './store';

export const headroomRouter = express.Router();
const store = new HeadroomStore();

headroomRouter.post('/envelopes', async (req, res) => {
  try {
    const envelope = await store.createEnvelope(req.body);
    auditOperatorAction({ event: 'headroom.envelope.created', principal: operatorPrincipalForRequest(req), details: {
      envelopeId: envelope.envelopeId,
      sessionId: envelope.sessionId,
      projectId: envelope.projectId,
      contextCount: envelope.context.length,
      materializedCount: envelope.materialized.length,
      exclusionCount: envelope.exclusions.length,
    } });
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
    auditOperatorAction({ event: 'headroom.envelope.pinned', principal: operatorPrincipalForRequest(req), details: { envelopeId: req.params.envelopeId, capsuleId: capsule.capsuleId } });
    return res.status(201).json({ capsule });
  } catch (error: unknown) {
    return res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.get('/capsules', (_req, res) => res.json({ capsules: store.listCapsules() }));

headroomRouter.put('/capsules/:capsuleId', async (req, res) => {
  try {
    const capsule = await store.saveCapsule({ ...req.body, capsuleId: req.params.capsuleId });
    auditOperatorAction({ event: 'headroom.capsule.updated', principal: operatorPrincipalForRequest(req), details: { capsuleId: capsule.capsuleId, projectId: capsule.projectId } });
    return res.json({ capsule });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.post('/capsules', async (req, res) => {
  try {
    const capsule = await store.saveCapsule(req.body);
    auditOperatorAction({ event: 'headroom.capsule.created', principal: operatorPrincipalForRequest(req), details: { capsuleId: capsule.capsuleId, projectId: capsule.projectId } });
    return res.status(201).json({ capsule });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.delete('/capsules/:capsuleId', async (req, res) => {
  try {
    const capsule = await store.deleteCapsule(req.params.capsuleId);
    auditOperatorAction({ event: 'headroom.capsule.deleted', principal: operatorPrincipalForRequest(req), details: { capsuleId: capsule.capsuleId, projectId: capsule.projectId } });
    return res.json({ removed: true });
  } catch (error: unknown) {
    return res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

headroomRouter.post('/capsules/:capsuleId/annotations', async (req, res) => {
  try {
    const { capsuleId } = req.params;
    const { target, text, sourceFile, sourceLine } = req.body;
    if (typeof target !== 'string' || typeof text !== 'string') {
      return res.status(400).json({ error: 'target and text are required strings.' });
    }
    const capsules = store.listCapsules();
    const capsule = capsules.find((c) => c.capsuleId === capsuleId);
    if (!capsule) return res.status(404).json({ error: 'Capsule not found.' });

    const annotation = {
      target,
      text,
      createdAt: new Date().toISOString(),
      ...(typeof sourceFile === 'string' && { sourceFile }),
      ...(typeof sourceLine === 'number' && { sourceLine }),
    };
    const updated = await store.saveCapsule({
      ...capsule,
      annotations: [...(capsule.annotations ?? []), annotation],
    });
    auditOperatorAction({ event: 'headroom.capsule.annotation.added', principal: operatorPrincipalForRequest(req), details: { capsuleId, target: target.slice(0, 80) } });
    return res.status(201).json({ annotation, capsule: updated });
  } catch (error: unknown) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
