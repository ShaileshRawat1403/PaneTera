process.env.NODE_ENV = 'test';

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProvenanceStore } from '../server/rig/provenance';
import type { ProvenanceRecord } from '../server/rig/types';

describe('ProvenanceStore FIFO compaction and rotation tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-provenance-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rotates oldest records to provenance-archive.jsonl when exceeding maxRecords limit', () => {
    const store = new ProvenanceStore(tempDir);

    const makeRecord = (id: number): ProvenanceRecord => ({
      recordId: `rec-${id}`,
      recordType: 'test-event',
      ownerId: 'operator-1',
      sourceIdentity: { kind: 'test', id: 'unit-test' },
      parentRecordIds: [],
      inputDigest: null,
      outputDigest: null,
      createdAt: new Date().toISOString(),
      sourceClass: 'panetera-managed',
      trustLevel: 'authoritative',
      correlation: {},
      integrity: 'verified',
      retentionClass: 'standard',
    });

    // Populate 10 records
    for (let i = 1; i <= 10; i++) {
      store.append(makeRecord(i));
    }

    // Force rotation with maxRecords = 5
    store.rotateIfNeeded(5);

    // Verify main store has last 5 records (rec-6 to rec-10)
    const activeRecords = store.list(10);
    assert.strictEqual(activeRecords.length, 5);
    assert.strictEqual(activeRecords[0].recordId, 'rec-6');
    assert.strictEqual(activeRecords[4].recordId, 'rec-10');

    // Verify archive file contains first 5 records (rec-1 to rec-5)
    const archivePath = path.join(tempDir, 'provenance', 'provenance-archive.jsonl');
    assert.ok(fs.existsSync(archivePath));
    const archivedLines = fs.readFileSync(archivePath, 'utf8').trim().split('\n');
    assert.strictEqual(archivedLines.length, 5);
    assert.match(archivedLines[0], /rec-1/);
    assert.match(archivedLines[4], /rec-5/);
  });
});
