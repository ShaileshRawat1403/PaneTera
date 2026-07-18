import fs from 'fs';
import path from 'path';
import { getTesseraAppDataDir } from '../appData';
import { ResearchSession, ResearchSessionSnapshot } from './researchTypes';
import { logAudit } from '../audit';

// A simple per-session mutex
class SessionMutex {
  private queue: Map<string, Promise<void>> = new Map();

  async acquire(sessionId: string): Promise<() => void> {
    let release!: () => void;
    const p = new Promise<void>(resolve => {
      release = resolve;
    });

    const previous = this.queue.get(sessionId) || Promise.resolve();
    this.queue.set(sessionId, previous.then(() => p));
    
    await previous;
    return () => {
      if (this.queue.get(sessionId) === p) {
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

  private async atomicWriteJson(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    
    return new Promise((resolve, reject) => {
      const content = JSON.stringify(data, null, 2);
      fs.writeFile(tempPath, content, { mode: 0o600 }, (err) => {
        if (err) return reject(err);
        
        fs.rename(tempPath, filePath, (err) => {
          if (err) {
            fs.unlink(tempPath, () => {}); // cleanup on failure
            return reject(err);
          }
          resolve();
        });
      });
    });
  }

  public async getSession(sessionId: string): Promise<ResearchSession | null> {
    const release = await this.mutex.acquire(sessionId);
    try {
      const p = this.getSessionFilePath(sessionId);
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, 'utf8');
      const session: ResearchSession = JSON.parse(content);
      if (!session.sessionId || session.sessionId !== sessionId) {
        logAudit({
          operation: 'load_session_failure',
          status: 'corrupted',
          details: 'Session ID mismatch or missing',
          sessionId
        });
        throw new Error('Corrupted session record');
      }
      return session;
    } catch (e: any) {
      logAudit({
        operation: 'load_session_failure',
        status: 'error',
        details: e.message,
        sessionId
      });
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
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, 'utf8');
      const snap: ResearchSessionSnapshot = JSON.parse(content);
      if (snap.schemaVersion !== "1.0") {
        throw new Error('Unsupported schema version');
      }
      return snap;
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
