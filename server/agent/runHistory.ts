// server/agent/runHistory.ts
//
// Persistent run history storage with replay capability.
// Stores completed runs in a file-based FIFO rotation.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { isTestProcess, sameLocation } from '../appData';

export interface HistoricalRun {
  runId: string;
  objective: string;
  status: 'completed' | 'failed' | 'canceled' | 'interrupted' | 'expired';
  reply?: string;
  events: unknown[];
  model?: string;
  startedAt: number;
  completedAt: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface HistoryQuery {
  status?: HistoricalRun['status'];
  model?: string;
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
}

const MAX_HISTORY = 500;
const RUN_HISTORY_REFUSAL =
  'Refusing to use the PaneTera server run history from a test process. '
  + 'Set PANETERA_RUN_HISTORY_DIR to an isolated temporary directory '
  + '(npm test does this through test/support/isolatedAppData.mjs).';

/** The server's own run history, under the directory it runs from. */
export function defaultRunHistoryDir(): string {
  return join(process.cwd(), '.panetera', 'agent-history');
}

/**
 * Where run history is stored. PANETERA_RUN_HISTORY_DIR overrides it. A test
 * process must supply an isolated directory and never reads, writes, or clears
 * the server's own history.
 */
export function resolveRunHistoryDir(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const override = env.PANETERA_RUN_HISTORY_DIR;
  const testProcess = isTestProcess(env);
  if (override) {
    if (testProcess && sameLocation(override, defaultRunHistoryDir())) throw new Error(RUN_HISTORY_REFUSAL);
    return resolve(override);
  }
  if (testProcess) throw new Error(RUN_HISTORY_REFUSAL);
  return defaultRunHistoryDir();
}

export class RunHistory {
  private history: HistoricalRun[] = [];
  private readonly dir: string;

  constructor() {
    this.dir = resolveRunHistoryDir();
    this.ensureDir();
    this.load();
  }

  /**
   * Record a completed run.
   */
  record(run: HistoricalRun): void {
    this.history.unshift(run);

    // FIFO rotation
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    this.save();
  }

  /**
   * Query runs with filters.
   */
  query(query: HistoryQuery = {}): { runs: HistoricalRun[]; total: number } {
    let filtered = [...this.history];

    if (query.status) {
      filtered = filtered.filter((r) => r.status === query.status);
    }
    if (query.model) {
      filtered = filtered.filter((r) => r.model === query.model);
    }
    if (query.since !== undefined) {
      const since = query.since;
      filtered = filtered.filter((r) => r.completedAt >= since);
    }
    if (query.until !== undefined) {
      const until = query.until;
      filtered = filtered.filter((r) => r.completedAt <= until);
    }

    const total = filtered.length;

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const runs = filtered.slice(offset, offset + limit);

    return { runs, total };
  }

  /**
   * Get a specific run by ID.
   */
  get(runId: string): HistoricalRun | undefined {
    return this.history.find((r) => r.runId === runId);
  }

  /**
   * Get replay data for a run.
   */
  getReplayData(runId: string): { run: HistoricalRun; replay: { objective: string; model?: string; events: unknown[] } } | null {
    const run = this.get(runId);
    if (!run) return null;

    return {
      run,
      replay: {
        objective: run.objective,
        model: run.model,
        events: run.events,
      },
    };
  }

  /**
   * Get statistics.
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byModel: Record<string, number>;
    avgDuration: number;
  } {
    const byStatus: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let totalDuration = 0;

    for (const run of this.history) {
      byStatus[run.status] = (byStatus[run.status] || 0) + 1;
      if (run.model) {
        byModel[run.model] = (byModel[run.model] || 0) + 1;
      }
      totalDuration += run.duration;
    }

    return {
      total: this.history.length,
      byStatus,
      byModel,
      avgDuration: this.history.length > 0 ? totalDuration / this.history.length : 0,
    };
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.history = [];
    this.save();
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private load(): void {
    try {
      const filePath = join(this.dir, 'history.json');
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8');
        this.history = JSON.parse(data).slice(0, MAX_HISTORY);
      }
    } catch {
      this.history = [];
    }
  }

  private save(): void {
    try {
      const filePath = join(this.dir, 'history.json');
      writeFileSync(filePath, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch {
      // Silently fail - history is best-effort
    }
  }
}

// Singleton
let historyInstance: RunHistory | null = null;

export function getRunHistory(): RunHistory {
  if (!historyInstance) {
    historyInstance = new RunHistory();
  }
  return historyInstance;
}
