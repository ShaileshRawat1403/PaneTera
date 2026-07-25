import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { getTesseraAppDataDir } from '../appData';
import type { ProvenanceRecord } from './types';

export class ProvenanceStore {
  private readonly filePath: string;
  private readonly archivePath: string;
  private lastHash = '0';

  constructor(root = getTesseraAppDataDir()) {
    const dir = path.join(root, 'provenance');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.filePath = path.join(dir, 'records.jsonl');
    this.archivePath = path.join(dir, 'provenance-archive.jsonl');
    this.initChain();
    this.rotateIfNeeded();
  }

  private initChain(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const lines = fs.readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        const rec = JSON.parse(line) as ProvenanceRecord;
        this.lastHash = createHash('sha256').update(JSON.stringify({ recordId: rec.recordId, prevHash: rec.prevHash ?? '0' })).digest('hex');
      }
    } catch {
      this.lastHash = '0';
    }
  }

  append(record: ProvenanceRecord): void {
    const prevHash = this.lastHash;
    record.prevHash = prevHash;
    this.lastHash = createHash('sha256').update(JSON.stringify({ recordId: record.recordId, prevHash })).digest('hex');
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
    this.rotateIfNeeded();
  }

  list(limit = 200): ProvenanceRecord[] {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8').trim();
      if (!content) return [];
      return content
        .split('\n')
        .filter(Boolean)
        .slice(-Math.max(1, Math.min(limit, 1000)))
        .map((line) => JSON.parse(line) as ProvenanceRecord);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  rotateIfNeeded(maxRecords = 500): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const lines = fs.readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
      if (lines.length <= maxRecords) return;

      const archiveCount = lines.length - maxRecords;
      const toArchive = lines.slice(0, archiveCount);
      const toKeep = lines.slice(archiveCount);

      // Append oldest records to provenance-archive.jsonl
      fs.appendFileSync(this.archivePath, `${toArchive.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });

      // Rewrite records.jsonl with newest maxRecords lines
      const temporary = `${this.filePath}.${randomUUID()}.tmp`;
      fs.writeFileSync(temporary, `${toKeep.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temporary, this.filePath);
    } catch (error: unknown) {
      console.error('Failed to rotate provenance store:', error);
    }
  }
}
