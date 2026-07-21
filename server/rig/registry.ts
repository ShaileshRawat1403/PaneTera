import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getTesseraAppDataDir } from '../appData';
import { EMPTY_CAPABILITY_SNAPSHOT, type McpConnection } from './types';

interface RegistryFile { version: 1; connections: McpConnection[] }

export class RigRegistry {
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(root = getTesseraAppDataDir()) {
    const dir = path.join(root, 'rig');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.filePath = path.join(dir, 'connections.json');
    this.reconcileAfterRestart();
  }

  list(): McpConnection[] {
    return this.read().connections;
  }

  get(connectionId: string): McpConnection | null {
    return this.list().find((record) => record.connectionId === connectionId) ?? null;
  }

  async create(input: Pick<McpConnection, 'displayName' | 'sourceClass' | 'transport' | 'endpointRef'>): Promise<McpConnection> {
    const now = new Date().toISOString();
    const connectionId = connectionIdForName(input.displayName);
    if (!connectionId || connectionId.length > 48) throw new Error('Connection name must produce a short stable identifier.');
    const record: McpConnection = {
      ...input,
      connectionId,
      executableDigest: null,
      entryPointDigest: null,
      launchSpecDigest: null,
      state: 'approval-required',
      health: { state: 'not-measured', lastSuccessfulContact: null },
      capabilities: { ...EMPTY_CAPABILITY_SNAPSHOT },
      createdAt: now,
      updatedAt: now,
      connectionApprovalId: null,
    };
    await this.mutate((records) => {
      if (records.some((candidate) => candidate.connectionId === record.connectionId)) {
        throw new Error('A Rig connection already uses that name.');
      }
      records.push(record);
    });
    return record;
  }

  async update(connectionId: string, change: (record: McpConnection) => McpConnection): Promise<McpConnection> {
    let updated: McpConnection | null = null;
    await this.mutate((records) => {
      const index = records.findIndex((record) => record.connectionId === connectionId);
      if (index < 0) throw new Error('Rig connection not found.');
      updated = { ...change(records[index]), connectionId, updatedAt: new Date().toISOString() };
      records[index] = updated;
    });
    return updated!;
  }

  async remove(connectionId: string): Promise<McpConnection> {
    let removed: McpConnection | null = null;
    await this.mutate((records) => {
      const index = records.findIndex((record) => record.connectionId === connectionId);
      if (index < 0) throw new Error('Rig connection not found.');
      [removed] = records.splice(index, 1);
    });
    return removed!;
  }

  private read(): RegistryFile {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as RegistryFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.connections)) throw new Error('Invalid Rig registry.');
      return parsed;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, connections: [] };
      throw error;
    }
  }

  private async mutate(change: (records: McpConnection[]) => void): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const file = this.read();
      change(file.connections);
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      await fs.promises.writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      await fs.promises.rename(temporary, this.filePath);
    });
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  private reconcileAfterRestart(): void {
    const file = this.read();
    let changed = false;
    const now = new Date().toISOString();
    file.connections = file.connections.map((record) => {
      if (record.state !== 'connected' && record.state !== 'starting') return record;
      changed = true;
      return {
        ...record,
        state: 'stopped',
        health: { state: 'not-measured', lastSuccessfulContact: record.health.lastSuccessfulContact },
        updatedAt: now,
      };
    });
    if (!changed) return;
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, this.filePath);
  }
}

export function connectionIdForName(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
