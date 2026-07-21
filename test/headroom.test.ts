process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HeadroomStore } from '../server/headroom/store';
import { LocalScopeStore } from '../server/headroom/localScopeStore';

function context(locator = '/Users/shailesh/project/src/App.tsx') {
  return [{
    id: 'ctx-1', kind: 'file', label: 'App.tsx', included: true, authority: 'none', access: 'read-scoped', freshness: 'current',
    source: { origin: 'local-fs', locator },
    materialization: { mode: 'inline', measurement: { unit: 'bytes', value: 6 } },
  }];
}

describe('Headroom envelopes are truthful and sensitive by default', () => {
  it('persists hashes and measurements without persisting material', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const store = new HeadroomStore(root);
      const envelope = await store.createEnvelope({
        sessionId: 'session-12345678', projectId: 'PaneTera', projectRoot: '/Users/shailesh/project', objective: 'Inspect App',
        intent: { family: 'artifact' }, context: context(), material: { 'ctx-1': '<hello>' },
        materialized: { 'ctx-1': '&lt;hello&gt;' }, capabilitiesOffered: [],
      });
      assert.notStrictEqual(envelope.materialized[0].sourceDigest, envelope.materialized[0].materializedDigest);
      assert.strictEqual(envelope.materialized[0].measurement.value, Buffer.byteLength('&lt;hello&gt;'));
      const persisted = fs.readFileSync(path.join(root, 'headroom', 'envelopes', `${envelope.envelopeId}.json`), 'utf8');
      assert.ok(!persisted.includes('<hello>'));
      assert.ok(!persisted.includes('&lt;hello&gt;'));
      assert.ok(persisted.includes('project:src/App.tsx'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('records user exclusions rather than silently omitting them', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const store = new HeadroomStore(root);
      const excluded = context();
      (excluded[0] as any).included = false;
      const envelope = await store.createEnvelope({
        sessionId: 'session-12345678', intent: {}, context: excluded, material: {}, materialized: {},
      });
      assert.deepStrictEqual(envelope.exclusions, [{ itemId: 'ctx-1', reason: 'user-excluded' }]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('redacts URL credentials and sensitive query values', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const store = new HeadroomStore(root);
      const envelope = await store.createEnvelope({
        sessionId: 'session-12345678', intent: {},
        context: context('https://user:pass@example.com/data?token=abc&view=full'), material: {}, materialized: {},
      });
      const locator = (envelope.context[0] as any).source.locator as string;
      assert.ok(!locator.includes('pass'));
      assert.ok(!locator.includes('abc'));
      assert.ok(locator.includes('%5Bredacted%5D'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});

describe('Headroom capsules are durable and editable', () => {
  it('pins redacted metadata and resumes it across store instances', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const first = new HeadroomStore(root);
      const envelope = await first.createEnvelope({
        sessionId: 'session-12345678', projectId: 'PaneTera', objective: 'Finish Rig', intent: {},
        context: context(), material: {}, materialized: {},
      });
      const pinned = await first.pinEnvelope(envelope.envelopeId, 'Release context');
      const updated = await first.saveCapsule({
        ...pinned, decisions: ['No tag before Rig and Headroom'], assumptions: ['Single user'],
        unresolvedQuestions: ['Chrome acceptance'], changedUnderstanding: ['MCP is part of Rig'],
      });
      const resumed = new HeadroomStore(root).listCapsules()[0];
      assert.strictEqual(resumed.capsuleId, updated.capsuleId);
      assert.deepStrictEqual(resumed.decisions, ['No tag before Rig and Headroom']);
      assert.deepStrictEqual(resumed.changedUnderstanding, ['MCP is part of Rig']);
      assert.strictEqual(first.getEnvelope(envelope.envelopeId)?.pinnedCapsuleId, pinned.capsuleId);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('deletes a capsule without deleting its source envelope', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const store = new HeadroomStore(root);
      const envelope = await store.createEnvelope({
        sessionId: 'session-12345678', projectId: 'PaneTera', intent: {}, context: context(), material: {}, materialized: {},
      });
      const capsule = await store.pinEnvelope(envelope.envelopeId, 'Disposable');
      assert.strictEqual((await store.deleteCapsule(capsule.capsuleId)).capsuleId, capsule.capsuleId);
      assert.strictEqual(store.listCapsules().length, 0);
      assert.ok(store.getEnvelope(envelope.envelopeId));
      assert.strictEqual(store.getEnvelope(envelope.envelopeId)?.pinnedCapsuleId, null);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});

describe('temporary local scopes survive backend restarts but still expire and revoke', () => {
  it('persists a bounded grant and its revocation across store instances', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const first = new LocalScopeStore(root);
      await first.add({
        id: 'scope-1', kind: 'file', path: '/tmp/example.txt', sessionId: 'session-12345678',
        selectedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
        recursive: false, revokedAt: null, observedMtimeMs: 1,
      });
      assert.strictEqual(new LocalScopeStore(root).list('session-12345678').length, 1);
      await new LocalScopeStore(root).revoke('scope-1');
      assert.ok(new LocalScopeStore(root).get('scope-1')?.revokedAt);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('removes expired grants during restart reconciliation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panetera-headroom-'));
    try {
      const first = new LocalScopeStore(root);
      await first.add({
        id: 'expired', kind: 'folder', path: '/tmp', sessionId: 'session-12345678',
        selectedAt: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString(),
        recursive: false, revokedAt: null, observedMtimeMs: 1,
      });
      assert.strictEqual(new LocalScopeStore(root).get('expired'), null);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
