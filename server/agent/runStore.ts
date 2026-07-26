import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getPaneTeraAppDataDir } from '../appData';
import type {
  AgentContextDescriptor,
  AgentEvent,
  AgentEventType,
  AgentRun,
  AgentRunStatus,
} from './types';

interface PersistedRuns {
  version: 1;
  runs: AgentRun[];
  events: AgentEvent[];
}

export interface AgentEventReplay {
  cursorFound: boolean;
  events: AgentEvent[];
}

const TERMINAL = new Set<AgentRunStatus>(['completed', 'failed', 'canceled', 'interrupted']);
// Waiting approval is already a safe durable checkpoint: no side effect is in
// flight and the exact proposal can still be reviewed after restart. Only
// states that imply active computation become interrupted.
const RECOVERABLE = new Set<AgentRunStatus>(['queued', 'planning', 'running', 'verifying']);

export class AgentRunStore {
  private readonly filePath: string;
  private runs = new Map<string, AgentRun>();
  private events: AgentEvent[] = [];
  private writeChain: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(event: AgentEvent) => void>();

  constructor(root = getPaneTeraAppDataDir()) {
    const directory = path.join(root, 'agent');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.filePath = path.join(directory, 'runs.json');
    this.load();
    this.recoverInterruptedRuns();
  }

  async create(input: {
    objective: string;
    provider: string;
    model: string;
    context?: AgentContextDescriptor[];
  }): Promise<AgentRun> {
    const now = new Date().toISOString();
    const run: AgentRun = {
      runId: randomUUID(),
      objective: input.objective.trim().slice(0, 8_000),
      status: 'queued',
      provider: input.provider,
      model: input.model,
      createdAt: now,
      updatedAt: now,
      context: sanitiseContextDescriptors(input.context),
      currentStep: null,
      reply: null,
    };
    this.runs.set(run.runId, run);
    const event = this.appendInMemory(run.runId, 'run.created', 'Task accepted.', {
      provider: run.provider,
      model: run.model,
      contextItems: run.context.length,
    });
    await this.persist();
    this.emit(event);
    return structuredClone(run);
  }

  get(runId: string): AgentRun | null {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }

  listEvents(runId: string): AgentEvent[] {
    return this.events.filter((event) => event.runId === runId).map((event) => structuredClone(event));
  }

  listEventsAfter(eventId: string, limit = 500): AgentEventReplay {
    const index = this.events.findIndex((event) => event.eventId === eventId);
    if (index < 0) return { cursorFound: false, events: [] };
    return {
      cursorFound: true,
      events: this.events
        .slice(index + 1, index + 1 + Math.max(0, Math.min(limit, 500)))
        .map((event) => structuredClone(event)),
    };
  }

  async transition(
    runId: string,
    status: AgentRunStatus,
    patch: Partial<Pick<AgentRun, 'currentStep' | 'reply' | 'uiComponent' | 'pendingApproval' | 'error'>> = {},
  ): Promise<AgentRun> {
    const current = this.requireRun(runId);
    if (TERMINAL.has(current.status) && current.status !== status) {
      throw new Error(`Run ${runId} is already ${current.status}.`);
    }
    const next: AgentRun = {
      ...current,
      ...patch,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, next);
    await this.persist();
    return structuredClone(next);
  }

  async append(
    runId: string,
    type: AgentEventType,
    summary: string,
    data?: Record<string, unknown>,
  ): Promise<AgentEvent> {
    this.requireRun(runId);
    const event = this.appendInMemory(runId, type, summary, data);
    await this.persist();
    this.emit(event);
    return structuredClone(event);
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async cancel(runId: string): Promise<AgentRun> {
    const run = this.requireRun(runId);
    if (TERMINAL.has(run.status)) return structuredClone(run);
    const next = await this.transition(runId, 'canceled', { currentStep: null });
    await this.append(runId, 'run.canceled', 'Task canceled by the user.');
    return next;
  }

  isCanceled(runId: string): boolean {
    return this.runs.get(runId)?.status === 'canceled';
  }

  list(): AgentRun[] {
    return [...this.runs.values()].map((run) => structuredClone(run));
  }

  private requireRun(runId: string): AgentRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown agent run: ${runId}`);
    return run;
  }

  private appendInMemory(
    runId: string,
    type: AgentEventType,
    summary: string,
    data?: Record<string, unknown>,
  ): AgentEvent {
    const sequence = this.events.filter((event) => event.runId === runId).length + 1;
    const event: AgentEvent = {
      eventId: randomUUID(),
      runId,
      sequence,
      type,
      timestamp: new Date().toISOString(),
      summary: summary.slice(0, 500),
      ...(data ? { data: sanitiseEventData(data) } : {}),
    };
    this.events.push(event);
    return event;
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      try { listener(structuredClone(event)); }
      catch { /* event observers cannot break run persistence */ }
    }
  }

  private load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as PersistedRuns;
      if (parsed.version !== 1 || !Array.isArray(parsed.runs) || !Array.isArray(parsed.events)) return;
      this.runs = new Map(parsed.runs.map((run) => [run.runId, run]));
      this.events = parsed.events;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[AgentRunStore] Could not load persisted runs:', (error as Error).message);
      }
    }
  }

  private recoverInterruptedRuns(): void {
    let changed = false;
    for (const run of this.runs.values()) {
      if (!RECOVERABLE.has(run.status)) continue;
      run.status = 'interrupted';
      run.currentStep = null;
      run.error = 'PaneTera restarted before this task reached a terminal state.';
      run.updatedAt = new Date().toISOString();
      this.appendInMemory(run.runId, 'run.interrupted', 'Task interrupted by a PaneTera restart.');
      changed = true;
    }
    if (changed) void this.persist();
  }

  private async persist(): Promise<void> {
    const snapshot: PersistedRuns = {
      version: 1,
      runs: [...this.runs.values()],
      events: this.events,
    };
    const operation = this.writeChain.then(async () => {
      const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
      await fs.promises.writeFile(temporary, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', mode: 0o600 });
      await fs.promises.rename(temporary, this.filePath);
    });
    this.writeChain = operation.catch(() => undefined);
    await operation;
  }
}

function sanitiseContextDescriptors(value: AgentContextDescriptor[] | undefined): AgentContextDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((candidate) => {
    if (!candidate || typeof candidate.id !== 'string' || typeof candidate.locator !== 'string') return [];
    return [{
      id: candidate.id.slice(0, 200),
      kind: String(candidate.kind || 'unknown').slice(0, 100),
      label: String(candidate.label || '').slice(0, 500),
      locator: redactLocator(candidate.locator).slice(0, 2_000),
      ...(candidate.workspaceId ? { workspaceId: candidate.workspaceId.slice(0, 200) } : {}),
      access: String(candidate.access || 'unknown').slice(0, 100),
      materialization: String(candidate.materialization || 'unknown').slice(0, 100),
    }];
  });
}

function redactLocator(locator: string): string {
  return locator
    .replace(/^\/Users\/[^/]+/, '/Users/[redacted-user]')
    .replace(/^\/home\/[^/]+/, '/home/[redacted-user]')
    .replace(/([?&](?:token|secret|password|key|auth|credential)=)[^&]*/gi, '$1[redacted]');
}

function sanitiseEventData(data: Record<string, unknown>): Record<string, unknown> {
  const serialised = JSON.stringify(data, (key, value) => {
    if (/(?:token|secret|password|apiKey|authorization)/i.test(key)) return '[redacted]';
    return value;
  });
  return JSON.parse(serialised) as Record<string, unknown>;
}
