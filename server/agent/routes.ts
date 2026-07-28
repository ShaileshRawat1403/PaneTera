import { Router } from 'express';
import { createAgentRuntime } from './agentFactory';
import type { AgentRuntime } from './runtime';
import { approvePendingBrowserAction, rejectPendingBrowserAction } from './browserRunCoordinator';
import { agentRunLimiter } from '../middleware/rateLimiter';

let cachedRuntime: AgentRuntime | null = null;
let runtimeInitializationAttempted = false;

function getRuntime(): AgentRuntime | null {
  if (runtimeInitializationAttempted) return cachedRuntime;
  runtimeInitializationAttempted = true;
  cachedRuntime = createAgentRuntime();
  return cachedRuntime;
}

export const agentRouter = Router();

// Agent runs
agentRouter.post('/run', agentRunLimiter, handleAgentRun);
agentRouter.get('/runs', handleListRuns);
agentRouter.get('/run/:runId', handleGetRun);
agentRouter.get('/run/:runId/events', handleRunEvents);
agentRouter.post('/run/:runId/cancel', handleCancelRun);
agentRouter.post('/run/:runId/approve-browser', handleApproveBrowserAction);
agentRouter.post('/run/:runId/reject-browser', handleRejectBrowserAction);

// Queue
agentRouter.get('/queue/status', handleQueueStatus);
agentRouter.post('/queue/config', handleQueueConfig);

// History
agentRouter.get('/history', handleHistory);
agentRouter.get('/history/:runId', handleHistoryRun);
agentRouter.get('/history/:runId/replay', handleHistoryReplay);
agentRouter.get('/history/stats', handleHistoryStats);

// Capabilities
agentRouter.get('/capabilities', handleCapabilities);
agentRouter.get('/capabilities/stats', handleCapabilityStats);
agentRouter.post('/capabilities/:capId/health', handleCapabilityHealth);

// Model fallback
agentRouter.get('/models/stats', handleModelStats);

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

function handleRunEvents(req: any, res: any): void {
  const runtime = getRuntime();
  if (!runtime) {
    res.status(503).json({ error: 'Agent runtime is not configured.' });
    return;
  }

  const { runId } = req.params;
  const store = runtime.getStore();
  const run = store.get(runId);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current state immediately
  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('run', run);

  // If run is already terminal, close immediately
  const terminalStatuses = ['completed', 'failed', 'canceled', 'interrupted', 'expired'];
  if (terminalStatuses.includes(run.status)) {
    sendEvent('done', { status: run.status });
    res.end();
    return;
  }

  // Poll for changes and send as SSE
  let lastEventCount = (store.listEvents(runId) || []).length;
  let lastStatus = run.status;
  const interval = setInterval(() => {
    const currentRun = store.get(runId);
    if (!currentRun) {
      sendEvent('error', { message: 'Run disappeared' });
      clearInterval(interval);
      res.end();
      return;
    }

    // Send status change
    if (currentRun.status !== lastStatus) {
      lastStatus = currentRun.status;
      sendEvent('status', { status: currentRun.status, reply: currentRun.reply });
    }

    // Send new events
    const currentEvents = store.listEvents(runId) || [];
    if (currentEvents.length > lastEventCount) {
      const newEvents = currentEvents.slice(lastEventCount);
      lastEventCount = currentEvents.length;
      sendEvent('events', newEvents);
    }

    // Close on terminal status
    if (terminalStatuses.includes(currentRun.status)) {
      sendEvent('done', { status: currentRun.status, reply: currentRun.reply });
      clearInterval(interval);
      res.end();
    }
  }, 500);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
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

async function handleApproveBrowserAction(req: any, res: any): Promise<void> {
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
    const run = await approvePendingBrowserAction(runtime.getStore(), runId);
    res.json({ run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({
      version: 2,
      error: { kind: 'server-error', message },
    });
  }
}

async function handleRejectBrowserAction(req: any, res: any): Promise<void> {
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
    const run = await rejectPendingBrowserAction(runtime.getStore(), runId);
    res.json({ run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({
      version: 2,
      error: { kind: 'server-error', message },
    });
  }
}

// Queue handlers
async function handleQueueStatus(_req: any, res: any): Promise<void> {
  const { getRunQueue } = await import('./runQueue.js');
  const queue = getRunQueue();
  res.json(queue.getStatus());
}

async function handleQueueConfig(req: any, res: any): Promise<void> {
  const { getRunQueue } = await import('./runQueue.js');
  const queue = getRunQueue();
  const { maxConcurrent, maxQueued } = req.body ?? {};

  queue.updateConfig({ maxConcurrent, maxQueued });
  res.json(queue.getStatus());
}

// History handlers
async function handleHistory(req: any, res: any): Promise<void> {
  const { getRunHistory } = await import('./runHistory.js');
  const history = getRunHistory();
  const { status, model, since, until, limit, offset } = req.query ?? {};

  const result = history.query({
    status,
    model,
    since: since ? Number(since) : undefined,
    until: until ? Number(until) : undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });

  res.json(result);
}

async function handleHistoryRun(req: any, res: any): Promise<void> {
  const { getRunHistory } = await import('./runHistory.js');
  const history = getRunHistory();
  const { runId } = req.params;

  const run = history.get(runId);
  if (!run) {
    res.status(404).json({ error: 'Run not found in history' });
    return;
  }

  res.json(run);
}

async function handleHistoryReplay(req: any, res: any): Promise<void> {
  const { getRunHistory } = await import('./runHistory.js');
  const history = getRunHistory();
  const { runId } = req.params;

  const replayData = history.getReplayData(runId);
  if (!replayData) {
    res.status(404).json({ error: 'Run not found in history' });
    return;
  }

  res.json(replayData);
}

async function handleHistoryStats(_req: any, res: any): Promise<void> {
  const { getRunHistory } = await import('./runHistory.js');
  const history = getRunHistory();
  res.json(history.getStats());
}

// Capability handlers
async function handleCapabilities(req: any, res: any): Promise<void> {
  const { getCapabilityRegistry } = await import('./capabilityRegistry.js');
  const registry = getCapabilityRegistry();
  const { category, health, tag } = req.query ?? {};

  const caps = registry.getAll({ category, health, tag });
  res.json(caps);
}

async function handleCapabilityStats(_req: any, res: any): Promise<void> {
  const { getCapabilityRegistry } = await import('./capabilityRegistry.js');
  const registry = getCapabilityRegistry();
  res.json(registry.getStats());
}

async function handleCapabilityHealth(req: any, res: any): Promise<void> {
  const { getCapabilityRegistry } = await import('./capabilityRegistry.js');
  const registry = getCapabilityRegistry();
  const { capId } = req.params;

  const result = await registry.checkHealth(capId);
  res.json(result);
}

// Model fallback stats
async function handleModelStats(_req: any, res: any): Promise<void> {
  const { getModelFallbackChain } = await import('./modelFallback.js');
  const chain = getModelFallbackChain();
  res.json(chain.getStats());
}
