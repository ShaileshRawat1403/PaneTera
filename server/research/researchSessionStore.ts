import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getTesseraAppDataDir } from '../appData';
import { ResearchSession, ResearchSessionSnapshot } from './researchTypes';
import { auditResearchSystem } from './researchAudit';

function validateSession(data: any, expectedSessionId: string): asserts data is ResearchSession {
  if (!data || typeof data !== 'object') throw new Error('Session is not an object');
  if (data.sessionId !== expectedSessionId) throw new Error('Session ID mismatch');
  if (typeof data.ownerId !== 'string') throw new Error('Invalid ownerId');
  if (typeof data.title !== 'string') throw new Error('Invalid title');
  if (!['draft', 'ready', 'partial', 'archived'].includes(data.status)) throw new Error('Invalid status');
  if (typeof data.sourceCount !== 'number') throw new Error('Invalid sourceCount');
  if (!Array.isArray(data.warnings)) throw new Error('Warnings must be an array');
}

function validateSnapshot(data: any, expectedSessionId: string, expectedSnapshotId?: string): asserts data is ResearchSessionSnapshot {
  if (!data || typeof data !== 'object') throw new Error('Snapshot is not an object');
  if (data.sessionId !== expectedSessionId) throw new Error('Snapshot Session ID mismatch');
  if (expectedSnapshotId && data.snapshotId !== expectedSnapshotId) throw new Error('Snapshot ID mismatch');
  if (data.schemaVersion !== "1.0") throw new Error('Unsupported schemaVersion');
  if (typeof data.version !== 'number') throw new Error('Invalid version');
  if (!Array.isArray(data.entries)) throw new Error('Entries must be an array');
  if (!data.snapshotIntegrity || typeof data.snapshotIntegrity !== 'object' || data.snapshotIntegrity.hashAlgorithm !== 'sha256') {
    throw new Error('Invalid snapshotIntegrity');
  }
}


// A simple per-session mutex
class SessionMutex {
  private queue: Map<string, Promise<void>> = new Map();

  async acquire(sessionId: string): Promise<() => void> {
    let release!: () => void;
    const p = new Promise<void>(resolve => {
      release = resolve;
    });

    const previous = this.queue.get(sessionId) || Promise.resolve();
    const next = previous.then(() => p);
    this.queue.set(sessionId, next);
    
    await previous;
    return () => {
      if (this.queue.get(sessionId) === next) {
        this.queue.delete(sessionId);
      }
      release();
    };
  }
}

export class ResearchSessionStore {
  private baseDir: string;
  private mutex = new SessionMutex();

  constructor() {
    const appData = getTesseraAppDataDir();
    this.baseDir = path.join(appData, 'research', 'sessions');
    fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
  }

  private getSessionDir(sessionId: string): string {
    // Basic path traversal prevention
    if (!/^[a-zA-Z0-9-]+$/.test(sessionId)) {
      throw new Error('Invalid session ID');
    }
    return path.join(this.baseDir, sessionId);
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'session.json');
  }

  private getSnapshotFilePath(sessionId: string, snapshotId: string, version: number): string {
    const paddedVersion = version.toString().padStart(4, '0');
    return path.join(this.getSessionDir(sessionId), 'snapshots', `${paddedVersion}-${snapshotId}.json`);
  }

  private async atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
    const tempPath = `${filePath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    
    const content = JSON.stringify(data, null, 2);
    // 0o600 for sessions (read/write by owner)
    await fs.promises.writeFile(tempPath, content, { mode: 0o600 });
    
    try {
      await fs.promises.rename(tempPath, filePath);
    } catch (err: unknown) {
      await fs.promises.unlink(tempPath).catch(() => {}); // cleanup on failure
      throw err;
    }
  }

  public async getSession(sessionId: string): Promise<ResearchSession | null> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const p = this.getSessionFilePath(sessionId);
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, 'utf8');
      const sessionData = JSON.parse(content);
      validateSession(sessionData, sessionId);
      return sessionData;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      auditResearchSystem({ event: 'research.store.session-load-failed', outcome: 'error', sessionId, details: { error: msg } });
      throw e;
    } finally {
      release();
    }
  }

  public async saveSession(session: ResearchSession): Promise<void> {
    const release = await this.mutex.acquire(session.sessionId);
    try {
      const dir = this.getSessionDir(session.sessionId);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      await this.atomicWriteJson(this.getSessionFilePath(session.sessionId), session);
    } finally {
      release();
    }
  }

  public async saveSnapshot(session: ResearchSession, snapshot: ResearchSessionSnapshot): Promise<void> {
    const release = await this.mutex.acquire(session.sessionId);
    try {
      const dir = this.getSessionDir(session.sessionId);
      const snapDir = path.join(dir, 'snapshots');
      fs.mkdirSync(snapDir, { recursive: true, mode: 0o700 });
      
      const p = this.getSnapshotFilePath(session.sessionId, snapshot.snapshotId, snapshot.version);
      
      // Step 1: Write snapshot atomically
      await this.atomicWriteJson(p, snapshot);

      // Step 2: Update session.json
      session.currentSnapshotId = snapshot.snapshotId;
      session.updatedAt = new Date().toISOString();
      await this.atomicWriteJson(this.getSessionFilePath(session.sessionId), session);
    } finally {
      release();
    }
  }

  public async getSnapshot(sessionId: string, snapshotId: string, version: number): Promise<ResearchSessionSnapshot | null> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const p = this.getSnapshotFilePath(sessionId, snapshotId, version);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const snapshotData = JSON.parse(content);
        validateSnapshot(snapshotData, sessionId, snapshotId);
        return snapshotData;
      }
      return null;
    } finally {
      release();
    }
  }

  public async getSnapshotById(sessionId: string, snapshotId: string): Promise<ResearchSessionSnapshot | null> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const snapDir = path.join(this.getSessionDir(sessionId), 'snapshots');
      if (!fs.existsSync(snapDir)) return null;
      const files = fs.readdirSync(snapDir);
      const match = files.find(f => f.endsWith(`-${snapshotId}.json`));
      if (!match) return null;
      
      const p = path.join(snapDir, match);
      const content = fs.readFileSync(p, 'utf8');
      const snapshotData = JSON.parse(content);
      validateSnapshot(snapshotData, sessionId, snapshotId);
      return snapshotData;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      auditResearchSystem({
        event: 'research.store.snapshot-load-failed', outcome: 'error', sessionId,
        details: { snapshotId, error: msg },
      });
      throw e;
    } finally {
      release();
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const dir = this.getSessionDir(sessionId);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      release();
    }
  }
}

export const researchSessionStore = new ResearchSessionStore();

export function resetResearchSessionStoreForTest() {
  // Re-instantiate based on potentially updated env vars
  (researchSessionStore as any).baseDir = path.join(getTesseraAppDataDir(), 'research', 'sessions');
  (researchSessionStore as any).mutex = new SessionMutex();
}
