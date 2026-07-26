// server/agent/runHistory.ts
//
// Persistent run history storage with replay capability.
// Stores completed runs in a file-based FIFO rotation.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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
const HISTORY_DIR = join(process.cwd(), '.panetera', 'agent-history');

export class RunHistory {
  private history: HistoricalRun[] = [];

  constructor() {
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
    if (query.since) {
      filtered = filtered.filter((r) => r.completedAt >= query.since);
    }
    if (query.until) {
      filtered = filtered.filter((r) => r.completedAt <= query.until);
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
    if (!existsSync(HISTORY_DIR)) {
      mkdirSync(HISTORY_DIR, { recursive: true });
    }
  }

  private load(): void {
    try {
      const filePath = join(HISTORY_DIR, 'history.json');
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
      const filePath = join(HISTORY_DIR, 'history.json');
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
