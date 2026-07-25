process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProvenanceStore } from '../server/rig/provenance';
import type { ProvenanceRecord } from '../server/rig/types';

describe('ProvenanceStore hash chain integrity unit tests', () => {
  it('assigns prevHash and maintains hash chain across appends', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-prov-chain-test-'));
    const store = new ProvenanceStore(tmpDir);

    const rec1: ProvenanceRecord = {
      recordId: 'prov-1',
      recordType: 'mcp-invocation',
      ownerId: 'local-operator',
      sourceIdentity: { kind: 'mcp-connection', id: 'c-1' },
      parentRecordIds: [],
      inputDigest: 'dig-in',
      outputDigest: 'dig-out',
      createdAt: new Date().toISOString(),
      sourceClass: 'panetera-managed',
      trustLevel: 'untrusted',
      correlation: { connectionId: 'c-1' },
      integrity: 'verified',
      retentionClass: 'session',
    };

    const rec2: ProvenanceRecord = {
      recordId: 'prov-2',
      recordType: 'mcp-invocation',
      ownerId: 'local-operator',
      sourceIdentity: { kind: 'mcp-connection', id: 'c-1' },
      parentRecordIds: ['prov-1'],
      inputDigest: 'dig-in-2',
      outputDigest: 'dig-out-2',
      createdAt: new Date().toISOString(),
      sourceClass: 'panetera-managed',
      trustLevel: 'untrusted',
      correlation: { connectionId: 'c-1' },
      integrity: 'verified',
      retentionClass: 'session',
    };

    store.append(rec1);
    store.append(rec2);

    const records = store.list();
    assert.strictEqual(records.length, 2);
    assert.strictEqual(records[0].prevHash, '0');
    assert.ok(typeof records[1].prevHash === 'string');
    assert.notStrictEqual(records[1].prevHash, '0');
  });
});
