// server/schema/routes.ts
import { Router, Request, Response } from 'express';
import { schemaRegistry } from './registry';
import { validateCardData } from './validator';

export const schemaRouter = Router();

// GET /api/schemas - List all registered schemas (optional ?domain= filter)
schemaRouter.get('/', (req: Request, res: Response) => {
  const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
  const schemas = schemaRegistry.listSchemas(domain);
  res.json({ schemas });
});

// POST /api/schemas - Register a new schema
schemaRouter.post('/', (req: Request, res: Response) => {
  const result = schemaRegistry.registerSchema(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid schema definition', details: result.errors });
  }
  res.status(201).json({ success: true, schema: schemaRegistry.getSchema(req.body.id) });
});

// GET /api/schemas/:id - Get specific schema by ID
schemaRouter.get('/:id', (req: Request, res: Response) => {
  const schema = schemaRegistry.getSchema(req.params.id);
  if (!schema) {
    return res.status(404).json({ error: `Schema '${req.params.id}' not found` });
  }
  res.json(schema);
});

// PUT /api/schemas/:id - Update schema
schemaRouter.put('/:id', (req: Request, res: Response) => {
  const existing = schemaRegistry.getSchema(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: `Schema '${req.params.id}' not found` });
  }

  const updatedSchema = { ...req.body, id: req.params.id };
  const result = schemaRegistry.registerSchema(updatedSchema);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid schema update', details: result.errors });
  }
  res.json({ success: true, schema: schemaRegistry.getSchema(req.params.id) });
});

// DELETE /api/schemas/:id - Delete schema
schemaRouter.delete('/:id', (req: Request, res: Response) => {
  const deleted = schemaRegistry.deleteSchema(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: `Schema '${req.params.id}' not found` });
  }
  res.json({ success: true, id: req.params.id });
});

// POST /api/schemas/:id/validate - Validate data payload against schema
schemaRouter.post('/:id/validate', (req: Request, res: Response) => {
  const schema = schemaRegistry.getSchema(req.params.id);
  if (!schema) {
    return res.status(404).json({ error: `Schema '${req.params.id}' not found` });
  }

  const result = validateCardData(schema, req.body.data || {});
  res.json(result);
});
