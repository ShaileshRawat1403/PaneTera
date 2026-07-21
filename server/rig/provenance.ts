import fs from 'fs';
import path from 'path';
import { getTesseraAppDataDir } from '../appData';
import type { ProvenanceRecord } from './types';

export class ProvenanceStore {
  private readonly filePath: string;

  constructor(root = getTesseraAppDataDir()) {
    const dir = path.join(root, 'provenance');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.filePath = path.join(dir, 'records.jsonl');
  }

  append(record: ProvenanceRecord): void {
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  list(limit = 200): ProvenanceRecord[] {
    try {
      return fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean)
        .slice(-Math.max(1, Math.min(limit, 1000)))
        .map((line) => JSON.parse(line) as ProvenanceRecord);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
