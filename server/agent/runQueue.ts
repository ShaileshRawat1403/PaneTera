// server/agent/runQueue.ts
//
// Agent run queue with concurrency control.
// Manages pending, running, and completed runs with priority support.

import { EventEmitter } from 'events';

export interface QueuedRun {
  runId: string;
  objective: string;
  history?: unknown[];
  context?: Record<string, unknown>;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface QueueConfig {
  maxConcurrent: number;
  maxQueued: number;
  defaultPriority: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 2,
  maxQueued: 10,
  defaultPriority: 0,
};

export class AgentRunQueue extends EventEmitter {
  private pending: QueuedRun[] = [];
  private running = new Map<string, QueuedRun>();
  private completed = new Map<string, QueuedRun>();
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enqueue a new run. Returns the runId or null if queue is full.
   */
  enqueue(
    runId: string,
    objective: string,
    options: { history?: unknown[]; context?: Record<string, unknown>; priority?: number } = {}
  ): QueuedRun | null {
    if (this.pending.length >= this.config.maxQueued) {
      return null;
    }

    const run: QueuedRun = {
      runId,
      objective,
      history: options.history,
      context: options.context,
      priority: options.priority ?? this.config.defaultPriority,
      status: 'pending',
      enqueuedAt: Date.now(),
    };

    this.pending.push(run);
    this.pending.sort((a, b) => b.priority - a.priority);

    this.emit('enqueued', run);
    this.processNext();

    return run;
  }

  /**
   * Mark a run as started (called by runtime).
   */
  start(runId: string): boolean {
    const idx = this.pending.findIndex((r) => r.runId === runId);
    if (idx === -1) return false;

    const [run] = this.pending.splice(idx, 1);
    run.status = 'running';
    run.startedAt = Date.now();
    this.running.set(runId, run);

    this.emit('started', run);
    this.processNext();
    return true;
  }

  /**
   * Mark a run as completed.
   */
  complete(runId: string, status: 'completed' | 'failed' | 'canceled'): void {
    const run = this.running.get(runId);
    if (!run) return;

    run.status = status;
    run.completedAt = Date.now();
    this.running.delete(runId);
    this.completed.set(runId, run);

    this.emit('completed', run);
    this.processNext();
  }

  /**
   * Cancel a pending or running run.
   */
  cancel(runId: string): boolean {
    // Check pending
    const pendingIdx = this.pending.findIndex((r) => r.runId === runId);
    if (pendingIdx !== -1) {
      const [run] = this.pending.splice(pendingIdx, 1);
      run.status = 'canceled';
      run.completedAt = Date.now();
      this.completed.set(runId, run);
      this.emit('canceled', run);
      return true;
    }

    // Check running
    const run = this.running.get(runId);
    if (run) {
      this.complete(runId, 'canceled');
      return true;
    }

    return false;
  }

  /**
   * Get queue status.
   */
  getStatus(): {
    pending: number;
    running: number;
    completed: number;
    maxConcurrent: number;
    maxQueued: number;
    nextInQueue?: QueuedRun;
  } {
    return {
      pending: this.pending.length,
      running: this.running.size,
      completed: this.completed.size,
      maxConcurrent: this.config.maxConcurrent,
      maxQueued: this.config.maxQueued,
      nextInQueue: this.pending[0],
    };
  }

  /**
   * Get a run by ID from any state.
   */
  getRun(runId: string): QueuedRun | undefined {
    return (
      this.running.get(runId) ||
      this.pending.find((r) => r.runId === runId) ||
      this.completed.get(runId)
    );
  }

  /**
   * Get all runs with optional status filter.
   */
  getRuns(status?: QueuedRun['status']): QueuedRun[] {
    const all = [...this.pending, ...Array.from(this.running.values()), ...Array.from(this.completed.values())];
    if (status) {
      return all.filter((r) => r.status === status);
    }
    return all;
  }

  /**
   * Process next items in queue if capacity available.
   */
  private processNext(): void {
    while (this.running.size < this.config.maxConcurrent && this.pending.length > 0) {
      const next = this.pending[0];
      if (!next) break;

      // Emit event but don't actually start - runtime will call start()
      this.emit('ready', next);
      break; // Only emit one at a time; runtime will call start() then this again
    }
  }

  /**
   * Update config at runtime.
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
    this.processNext();
  }
}

// Singleton queue instance
let queueInstance: AgentRunQueue | null = null;

export function getRunQueue(): AgentRunQueue {
  if (!queueInstance) {
    queueInstance = new AgentRunQueue();
  }
  return queueInstance;
}
