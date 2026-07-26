import { Router } from 'express';
import { getModelStore } from './modelStore';

export const modelRouter = Router();

modelRouter.get('/', handleListModels);
modelRouter.get('/active', handleGetActiveModel);
modelRouter.post('/active', handleSetActiveModel);

async function handleListModels(_req: any, res: any): Promise<void> {
  const store = getModelStore();
  const models = store.listModels();
  res.json({ models });
}

async function handleGetActiveModel(_req: any, res: any): Promise<void> {
  const store = getModelStore();
  const model = store.getActiveModel();
  res.json({ model });
}

async function handleSetActiveModel(req: any, res: any): Promise<void> {
  const { modelId } = req.body ?? {};
  if (typeof modelId !== 'string' || !modelId.trim()) {
    res.status(400).json({
      version: 2,
      error: { kind: 'validation', message: 'modelId is required.' },
    });
    return;
  }

  try {
    const store = getModelStore();
    const model = store.setActiveModel(modelId.trim());
    res.json({ model });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({
      version: 2,
      error: { kind: 'not-found', message },
    });
  }
}
