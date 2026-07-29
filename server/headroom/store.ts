import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { getTesseraAppDataDir } from '../appData';

export interface HeadroomEnvelope {
  envelopeId: string;
  sessionId: string;
  createdAt: string;
  projectId: string | null;
  objective: string | null;
  intent: unknown;
  context: unknown[];
  materialized: Array<{
    itemId: string;
    sourceDigest: string;
    materializedDigest: string;
    mode: 'inline' | 'retrieved';
    measurement: { unit: 'bytes'; value: number };
    truncated: boolean;
  }>;
  exclusions: Array<{ itemId: string; reason: 'user-excluded' | 'policy-denied' | 'over-threshold' | 'stale' | 'unreachable' }>;
  model: { connectionId: string; modelId: string } | null;
  capabilitiesOffered: string[];
  pinnedCapsuleId: string | null;
  activeCapsule: {
    capsuleId: string;
    snapshotDigest: string;
  } | null;
}

export interface HeadroomCapsule {
  capsuleId: string;
  title: string;
  projectId: string | null;
  objective: string | null;
  decisions: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  changedUnderstanding: string[];
  context: unknown[];
  envelopeIds: string[];
  createdAt: string;
  updatedAt: string;
  annotations: Array<{
    target: string;
    text: string;
    createdAt: string;
    sourceFile?: string;
    sourceLine?: number;
  }>;
}

interface EnvelopeInput {
  sessionId: string;
  projectId?: string | null;
  projectRoot?: string | null;
  objective?: string | null;
  intent: unknown;
  context: unknown[];
  material: Record<string, string>;
  materialized: Record<string, string>;
  model?: { connectionId: string; modelId: string } | null;
  capabilitiesOffered?: string[];
  activeCapsule?: { capsuleId: string; snapshot: unknown } | null;
}

const SESSION_RETENTION_MS = 24 * 60 * 60_000;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function redactLocator(locator: string, projectRoot?: string | null): string {
  if (projectRoot && path.isAbsolute(locator)) {
    const relative = path.relative(projectRoot, locator);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return relative === '' ? 'project:.' : `project:${relative}`;
    }
  }
  try {
    const url = new URL(locator);
    if (url.username || url.password) {
      url.username = '[redacted]';
      url.password = '';
    }
    for (const key of [...url.searchParams.keys()]) {
      if (/(?:token|secret|password|key|auth|credential)/i.test(key)) url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch { /* not a URL */ }
  return locator
    .replace(/^\/Users\/[^/]+/, '/Users/[redacted-user]')
    .replace(/^\/home\/[^/]+/, '/home/[redacted-user]')
    .replace(/([?&](?:token|secret|password|key|auth|credential)=)[^&]*/gi, '$1[redacted]');
}

function sanitiseContext(value: unknown, projectRoot?: string | null): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = structuredClone(candidate) as Record<string, any>;
    if (item.source && typeof item.source === 'object' && typeof item.source.locator === 'string') {
      item.source.locator = redactLocator(item.source.locator, projectRoot);
    }
    item.authority = 'none';
    return [item];
  });
}

export class HeadroomStore {
  private readonly root: string;
  private readonly envelopesDir: string;
  private readonly capsulesPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(root = getTesseraAppDataDir()) {
    this.root = path.join(root, 'headroom');
    this.envelopesDir = path.join(this.root, 'envelopes');
    this.capsulesPath = path.join(this.root, 'capsules.json');
    fs.mkdirSync(this.envelopesDir, { recursive: true, mode: 0o700 });
    this.cleanupExpired();
  }

  async createEnvelope(input: EnvelopeInput): Promise<HeadroomEnvelope> {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(input.sessionId)) throw new Error('Invalid Headroom session identifier.');
    if (!Array.isArray(input.context) || !input.material || !input.materialized) throw new Error('Invalid Headroom envelope.');
    const context = sanitiseContext(input.context, input.projectRoot);
    const materialized = Object.entries(input.materialized).flatMap(([itemId, exact]) => {
      const source = input.material[itemId];
      if (typeof source !== 'string' || typeof exact !== 'string') return [];
      const item = input.context.find((candidate) => (candidate as Record<string, unknown>)?.id === itemId) as
        { materialization?: { mode: string } } | undefined;
      const mode = item?.materialization?.mode;
      if (mode !== 'inline' && mode !== 'retrieved') return [];
      return [{
        itemId,
        sourceDigest: sha256(source),
        materializedDigest: sha256(exact),
        mode: mode as 'inline' | 'retrieved',
        measurement: { unit: 'bytes' as const, value: bytes(exact) },
        truncated: false,
      }];
    });
    const exclusions: HeadroomEnvelope['exclusions'] = [];
    for (const candidate of input.context as Array<Record<string, unknown> & { materialization?: { mode?: string }; included?: boolean; freshness?: string }>) {
      if (!candidate || typeof candidate.id !== 'string') continue;
      if (candidate.included === false) {
        exclusions.push({ itemId: candidate.id, reason: 'user-excluded' });
        continue;
      }
      if (candidate.freshness === 'stale') {
        exclusions.push({ itemId: candidate.id, reason: 'stale' });
        continue;
      }
      if (
        candidate.included !== (false as boolean)
        && ['inline', 'retrieved'].includes(candidate.materialization?.mode ?? '')
        && typeof input.materialized[candidate.id] !== 'string'
      ) exclusions.push({ itemId: candidate.id, reason: 'unreachable' });
    }
    const envelope: HeadroomEnvelope = {
      envelopeId: randomUUID(),
      sessionId: input.sessionId,
      createdAt: new Date().toISOString(),
      projectId: typeof input.projectId === 'string' ? input.projectId : null,
      objective: typeof input.objective === 'string' ? input.objective : null,
      intent: input.intent,
      context,
      materialized,
      exclusions,
      model: input.model ?? null,
      capabilitiesOffered: Array.isArray(input.capabilitiesOffered)
        ? input.capabilitiesOffered.filter((item): item is string => typeof item === 'string')
        : [],
      pinnedCapsuleId: null,
      activeCapsule: input.activeCapsule && typeof input.activeCapsule.capsuleId === 'string'
        ? { capsuleId: input.activeCapsule.capsuleId, snapshotDigest: sha256(JSON.stringify(input.activeCapsule.snapshot)) }
        : null,
    };
    await this.atomicWrite(path.join(this.envelopesDir, `${envelope.envelopeId}.json`), envelope);
    return envelope;
  }

  listEnvelopes(sessionId?: string): HeadroomEnvelope[] {
    return fs.readdirSync(this.envelopesDir)
      .filter((name) => name.endsWith('.json'))
      .flatMap((name) => {
        try {
          const value = JSON.parse(fs.readFileSync(path.join(this.envelopesDir, name), 'utf8')) as HeadroomEnvelope;
          return !sessionId || value.sessionId === sessionId ? [value] : [];
        } catch { return []; }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getEnvelope(envelopeId: string): HeadroomEnvelope | null {
    if (!/^[0-9a-f-]{36}$/.test(envelopeId)) return null;
    try { return JSON.parse(fs.readFileSync(path.join(this.envelopesDir, `${envelopeId}.json`), 'utf8')) as HeadroomEnvelope; }
    catch { return null; }
  }

  listCapsules(): HeadroomCapsule[] {
    try {
      const value = JSON.parse(fs.readFileSync(this.capsulesPath, 'utf8'));
      return Array.isArray(value?.capsules) ? value.capsules : [];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async saveCapsule(input: Partial<HeadroomCapsule> & { title: string; capsuleId?: string }): Promise<HeadroomCapsule> {
    const now = new Date().toISOString();
    const existing = input.capsuleId ? this.listCapsules().find((item) => item.capsuleId === input.capsuleId) : undefined;
    const capsule: HeadroomCapsule = {
      capsuleId: existing?.capsuleId ?? randomUUID(),
      title: input.title.trim().slice(0, 160) || 'Untitled context',
      projectId: typeof input.projectId === 'string' ? input.projectId : existing?.projectId ?? null,
      objective: typeof input.objective === 'string' ? input.objective : existing?.objective ?? null,
      decisions: stringList(input.decisions ?? existing?.decisions),
      assumptions: stringList(input.assumptions ?? existing?.assumptions),
      unresolvedQuestions: stringList(input.unresolvedQuestions ?? existing?.unresolvedQuestions),
      changedUnderstanding: stringList(input.changedUnderstanding ?? existing?.changedUnderstanding),
      context: sanitiseContext(input.context ?? existing?.context ?? []),
      envelopeIds: stringList(input.envelopeIds ?? existing?.envelopeIds),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      annotations: existing?.annotations ?? [],
    };
    await this.mutateCapsules((capsules) => {
      const index = capsules.findIndex((item) => item.capsuleId === capsule.capsuleId);
      if (index >= 0) capsules[index] = capsule;
      else capsules.push(capsule);
    });
    return capsule;
  }

  async pinEnvelope(envelopeId: string, title?: string): Promise<HeadroomCapsule> {
    const envelope = this.getEnvelope(envelopeId);
    if (!envelope) throw new Error('Headroom envelope not found.');
    const capsule = await this.saveCapsule({
      title: title || envelope.objective || `Context from ${new Date(envelope.createdAt).toLocaleString()}`,
      projectId: envelope.projectId,
      objective: envelope.objective,
      context: envelope.context,
      envelopeIds: [envelope.envelopeId],
    });
    await this.atomicWrite(path.join(this.envelopesDir, `${envelopeId}.json`), { ...envelope, pinnedCapsuleId: capsule.capsuleId });
    return capsule;
  }

  async deleteCapsule(capsuleId: string): Promise<HeadroomCapsule> {
    let removed: HeadroomCapsule | null = null;
    await this.mutateCapsules((capsules) => {
      const index = capsules.findIndex((item) => item.capsuleId === capsuleId);
      if (index < 0) throw new Error('Headroom capsule not found.');
      [removed] = capsules.splice(index, 1);
    });
    for (const envelope of this.listEnvelopes()) {
      if (envelope.pinnedCapsuleId !== capsuleId) continue;
      await this.atomicWrite(path.join(this.envelopesDir, `${envelope.envelopeId}.json`), {
        ...envelope,
        pinnedCapsuleId: null,
      });
    }
    return removed!;
  }

  private async mutateCapsules(change: (capsules: HeadroomCapsule[]) => void): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const capsules = this.listCapsules();
      change(capsules);
      await this.atomicWrite(this.capsulesPath, { version: 1, capsules });
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  private async atomicWrite(filePath: string, value: unknown): Promise<void> {
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await fs.promises.rename(temporary, filePath);
  }

  private cleanupExpired(): void {
    const cutoff = Date.now() - SESSION_RETENTION_MS;
    for (const name of fs.readdirSync(this.envelopesDir)) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(this.envelopesDir, name);
      try {
        const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as HeadroomEnvelope;
        if (!value.pinnedCapsuleId && Date.parse(value.createdAt) < cutoff) fs.unlinkSync(filePath);
      } catch { /* leave malformed records for explicit diagnosis */ }
    }
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 2000)).filter(Boolean).slice(0, 100)
    : [];
}
