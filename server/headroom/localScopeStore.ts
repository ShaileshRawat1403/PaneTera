import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getTesseraAppDataDir } from '../appData';

export type LocalSelectionKind = 'file' | 'folder';

export interface LocalSelectionGrant {
  id: string;
  kind: LocalSelectionKind;
  path: string;
  selectedAt: string;
  expiresAt: string;
  sessionId: string;
  recursive: boolean;
  revokedAt: string | null;
  observedMtimeMs: number;
}

interface ScopeFile { version: 1; grants: LocalSelectionGrant[] }

export class LocalScopeStore {
  private readonly filePath: string;
  private grants: LocalSelectionGrant[];
  private writeChain: Promise<void> = Promise.resolve();

  constructor(root = getTesseraAppDataDir()) {
    const dir = path.join(root, 'headroom');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.filePath = path.join(dir, 'local-scopes.json');
    this.grants = this.read().filter((grant) => Date.parse(grant.expiresAt) > Date.now());
    this.writeSync();
  }

  list(sessionId?: string): LocalSelectionGrant[] {
    return this.grants.filter((grant) => !sessionId || grant.sessionId === sessionId).map((grant) => ({ ...grant }));
  }

  get(id: string): LocalSelectionGrant | null {
    const grant = this.grants.find((candidate) => candidate.id === id);
    return grant ? { ...grant } : null;
  }

  async add(grant: LocalSelectionGrant): Promise<void> {
    await this.mutate((grants) => { grants.push({ ...grant }); });
  }

  async revoke(id: string): Promise<LocalSelectionGrant> {
    let revoked: LocalSelectionGrant | null = null;
    await this.mutate((grants) => {
      const index = grants.findIndex((grant) => grant.id === id);
      if (index < 0) throw new Error('Temporary attachment scope not found.');
      revoked = { ...grants[index], revokedAt: new Date().toISOString() };
      grants[index] = revoked;
    });
    return revoked!;
  }

  private read(): LocalSelectionGrant[] {
    try {
      const value = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as ScopeFile;
      if (value.version !== 1 || !Array.isArray(value.grants)) throw new Error('Invalid local scope registry.');
      return value.grants;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async mutate(change: (grants: LocalSelectionGrant[]) => void): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const next = this.grants.map((grant) => ({ ...grant }));
      change(next);
      await this.atomicWrite(next);
      this.grants = next;
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  private writeSync(): void {
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, grants: this.grants }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, this.filePath);
  }

  private async atomicWrite(grants = this.grants): Promise<void> {
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify({ version: 1, grants }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await fs.promises.rename(temporary, this.filePath);
  }
}
