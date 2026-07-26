import { Router } from 'express';
import { createAgentRuntime } from './agentFactory';
import type { AgentRuntime } from './runtime';

let cachedRuntime: AgentRuntime | null = null;
let runtimeInitializationAttempted = false;

function getRuntime(): AgentRuntime | null {
  if (runtimeInitializationAttempted) return cachedRuntime;
  runtimeInitializationAttempted = true;
  cachedRuntime = createAgentRuntime();
  return cachedRuntime;
}

export const agentRouter = Router();

agentRouter.post('/run', handleAgentRun);
agentRouter.get('/runs', handleListRuns);
agentRouter.get('/run/:runId', handleGetRun);
agentRouter.post('/run/:runId/cancel', handleCancelRun);

async function handleAgentRun(req: any, res: any): Promise<void> {
  const runtime = getRuntime();
  if (!runtime) {
    res.status(503).json({
      version: 2,
      error: { kind: 'server-error', message: 'Agent runtime is not configured. Set OPENAI_API_KEY.' },
    });
    return;
  }

  const { objective, recordedObjective, history, context } = req.body ?? {};
  if (typeof objective !== 'string' || !objective.trim()) {
    res.status(400).json({
      version: 2,
      error: { kind: 'validation', message: 'objective is required.' },
    });
    return;
  }

  try {
    const result = await runtime.run({
      objective: objective.trim(),
      recordedObjective: typeof recordedObjective === 'string' ? recordedObjective : undefined,
      history: Array.isArray(history) ? history : undefined,
      context: Array.isArray(context) ? context : undefined,
    });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const runId = (error as { runId?: string })?.runId;
    res.status(500).json({
      version: 2,
      error: { kind: 'server-error', message, details: runId ? { runId } : undefined },
    });
  }
}

async function handleListRuns(_req: any, res: any): Promise<void> {
  const runtime = getRuntime();
  if (!runtime) {
    res.status(503).json({
      version: 2,
      error: { kind: 'server-error', message: 'Agent runtime is not configured.' },
    });
    return;
  }

  const store = runtime.getStore();
  const runs = store.list();
  res.json({ runs });
}

async function handleGetRun(req: any, res: any): Promise<void> {
  const runtime = getRuntime();
  if (!runtime) {
    res.status(503).json({
      version: 2,
      error: { kind: 'server-error', message: 'Agent runtime is not configured.' },
    });
    return;
  }

  const { runId } = req.params;
  const store = runtime.getStore();
  const run = store.get(runId);
  if (!run) {
    res.status(404).json({
      version: 2,
      error: { kind: 'not-found', message: `Run ${runId} not found.` },
    });
    return;
  }

  const events = store.listEvents(runId);
  res.json({ run, events });
}

async function handleCancelRun(req: any, res: any): Promise<void> {
  const runtime = getRuntime();
  if (!runtime) {
    res.status(503).json({
      version: 2,
      error: { kind: 'server-error', message: 'Agent runtime is not configured.' },
    });
    return;
  }

  const { runId } = req.params;
  try {
    await runtime.cancel(runId);
    res.json({ canceled: true, runId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      version: 2,
      error: { kind: 'server-error', message },
    });
  }
}
