// test/rigLoadingModel.test.ts
//
// Acceptance tests for the Rig connections loading boundary. The rule they hold:
// unavailable data must never read as an authoritative empty Rig. Only a 2xx
// response whose body is a real `{ connections: [...] }` array is a load; every
// other outcome is an explicit failure, and only a successful empty array is the
// authoritative empty state.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  loadRigConnections,
  loadRigProvenance,
  isRigConnection,
  isRigCapability,
  resolveRigConnectionsView,
  type RigFetch,
} from '../src/components/rig/rigLoadingModel';
import type { RigCapability, RigConnection } from '../src/rig/types';

function cap(kind: RigCapability['kind'] = 'tool'): RigCapability {
  return {
    capabilityId: 'cap-1', kind, name: 'n', label: 'n',
    description: { source: 'schema-derived', text: 'does a thing' },
    inputSchema: null, rawDeclaration: {}, permission: 'proposable', enabled: false,
    structuralDigest: 'd', presentationDigest: 'd',
  };
}

const okFetch = (connections: unknown): RigFetch => async () => ({
  ok: true, status: 200, json: async () => ({ connections }),
});
const okProvFetch = (records: unknown): RigFetch => async () => ({
  ok: true, status: 200, json: async () => ({ records }),
});

function conn(id: string): RigConnection {
  return {
    connectionId: id, displayName: id, sourceClass: 'local-user-installed',
    transport: { kind: 'stdio', executablePath: '/x', argv: [], cwd: '/', isolationMode: 'none' },
    state: 'connected', health: { state: 'current', lastSuccessfulContact: null },
    capabilities: { tools: [], resources: [], prompts: [], truncated: false, discoveredAt: null },
    connectionApprovalId: null,
  } as RigConnection;
}

describe('loadRigConnections turns every failure into an explicit reason', () => {
  it('returns connections on a well-formed success', async () => {
    const result = await loadRigConnections(okFetch([conn('a')]), 't');
    assert.ok(result.ok && result.connections.length === 1);
  });

  it('accepts an empty array as a legitimately empty Rig', async () => {
    const result = await loadRigConnections(okFetch([]), 't');
    assert.ok(result.ok && result.connections.length === 0);
  });

  it('reports a 401 with its status and carries no connections', async () => {
    const result = await loadRigConnections(async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) }), 't');
    assert.strictEqual(result.ok, false);
    assert.ok(!result.ok && /401/.test(result.reason) && /Unauthorized/.test(result.reason));
    assert.ok(!('connections' in result), 'no connections leak on failure');
  });

  it('reports a 500 with its status', async () => {
    const result = await loadRigConnections(async () => ({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) }), 't');
    assert.ok(!result.ok && /500/.test(result.reason));
  });

  it('reports a network failure without leaking connections', async () => {
    const result = await loadRigConnections(async () => { throw new Error('offline'); }, 't');
    assert.ok(!result.ok && /reach|connection/i.test(result.reason));
  });

  it('rejects a malformed connections payload as unreadable, never as empty', async () => {
    for (const bad of ['nope', null, 42, { nested: [] }, undefined]) {
      const result = await loadRigConnections(okFetch(bad), 't');
      assert.strictEqual(result.ok, false, `connections=${JSON.stringify(bad)} is not a valid Rig`);
      assert.ok(!result.ok && /format|read/i.test(result.reason));
      assert.ok(!('connections' in result), 'no empty connections leak from a schema failure');
    }
  });

  it('rejects a body whose json cannot be parsed', async () => {
    const result = await loadRigConnections(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }), 't');
    assert.strictEqual(result.ok, false);
  });

  it('rejects an array containing a malformed connection element', async () => {
    const cases: unknown[] = [
      [null],
      ['bad'],
      [42],
      [{ connectionId: 'x' }], // incomplete: no state/health/transport/capabilities
      [conn('good'), null], // one good, one bad still fails the whole load
      [{ ...conn('x'), capabilities: { tools: 'no', resources: [], prompts: [] } }], // caps not arrays
      [{ ...conn('x'), health: 'nope' }],
    ];
    for (const bad of cases) {
      const result = await loadRigConnections(okFetch(bad), 't');
      assert.strictEqual(result.ok, false, `${JSON.stringify(bad)} must fail`);
      assert.ok(!result.ok && /format/i.test(result.reason));
    }
  });

  it('accepts an array of fully-formed connections', async () => {
    const result = await loadRigConnections(okFetch([conn('a'), conn('b')]), 't');
    assert.ok(result.ok && result.connections.length === 2);
  });

  it('rejects a connection whose capability arrays contain a malformed element', async () => {
    const withCaps = (caps: unknown) => ({ ...conn('x'), capabilities: { ...conn('x').capabilities, ...(caps as object) } });
    const cases: unknown[] = [
      [withCaps({ resources: [null] })],
      [withCaps({ tools: ['bad'] })],
      [withCaps({ prompts: [42] })],
      [withCaps({ tools: [{ capabilityId: 'c', kind: 'tool' }] })], // missing enabled/permission/description
      [withCaps({ resources: [{ ...cap('resource'), kind: 'weird' }] })], // bad enum
      [withCaps({ prompts: [{ ...cap('prompt'), permission: 'sometimes' }] })], // bad enum
      [withCaps({ tools: [{ ...cap('tool'), description: { source: 's' } }] })], // no description.text
    ];
    for (const bad of cases) {
      const result = await loadRigConnections(okFetch(bad), 't');
      assert.strictEqual(result.ok, false, `${JSON.stringify(bad)} must fail`);
    }
  });

  it('accepts a connection carrying fully-formed capabilities', async () => {
    const good = { ...conn('x'), capabilities: { tools: [cap('tool')], resources: [cap('resource')], prompts: [cap('prompt')], truncated: false, discoveredAt: null } };
    const result = await loadRigConnections(okFetch([good]), 't');
    assert.ok(result.ok && result.connections.length === 1);
  });
});

describe('isRigCapability enforces the capability shape and enums', () => {
  it('accepts a valid capability and rejects malformed ones', () => {
    assert.strictEqual(isRigCapability(cap('tool')), true);
    assert.strictEqual(isRigCapability(null), false);
    assert.strictEqual(isRigCapability('x'), false);
    assert.strictEqual(isRigCapability({ ...cap(), kind: 'nope' }), false);
    assert.strictEqual(isRigCapability({ ...cap(), permission: 'nope' }), false);
    assert.strictEqual(isRigCapability({ ...cap(), enabled: 'yes' }), false);
    assert.strictEqual(isRigCapability({ ...cap(), description: null }), false);
    assert.strictEqual(isRigCapability({ ...cap(), description: { source: 's' } }), false);
  });
});

describe('isRigConnection enforces the shape the renderer dereferences', () => {
  it('accepts a complete connection and rejects malformed ones', () => {
    assert.strictEqual(isRigConnection(conn('a')), true);
    assert.strictEqual(isRigConnection(null), false);
    assert.strictEqual(isRigConnection('x'), false);
    assert.strictEqual(isRigConnection(42), false);
    assert.strictEqual(isRigConnection({ connectionId: 'x' }), false);
    assert.strictEqual(isRigConnection({ ...conn('x'), capabilities: undefined }), false);
  });
});

describe('loadRigProvenance is honest, never failing open to empty', () => {
  it('returns records on a well-formed success', async () => {
    const result = await loadRigProvenance(okProvFetch([{ recordId: 'r1' }]), 't');
    assert.ok(result.ok && result.records.length === 1);
  });

  it('accepts an empty array as legitimately empty', async () => {
    const result = await loadRigProvenance(okProvFetch([]), 't');
    assert.ok(result.ok && result.records.length === 0);
  });

  it('rejects a malformed records payload rather than coercing to empty', async () => {
    for (const bad of ['nope', null, 42, [null], ['bad'], [1]]) {
      const result = await loadRigProvenance(okProvFetch(bad), 't');
      assert.strictEqual(result.ok, false, `${JSON.stringify(bad)} must fail`);
    }
  });

  it('reports a 500 and a network failure', async () => {
    assert.strictEqual((await loadRigProvenance(async () => ({ ok: false, status: 500, json: async () => ({}) }), 't')).ok, false);
    assert.strictEqual((await loadRigProvenance(async () => { throw new Error('offline'); }, 't')).ok, false);
  });
});

describe('resolveRigConnectionsView distinguishes every load state', () => {
  it('is loading before the first successful load, with no error', () => {
    assert.deepStrictEqual(resolveRigConnectionsView({ loaded: false, connections: [], error: null }), { status: 'loading' });
  });

  it('is a hard error when a failure has no cached inventory', () => {
    assert.deepStrictEqual(
      resolveRigConnectionsView({ loaded: false, connections: [], error: 'boom' }),
      { status: 'error', reason: 'boom' },
    );
  });

  it('is authoritative empty only for a successful empty load', () => {
    assert.deepStrictEqual(resolveRigConnectionsView({ loaded: true, connections: [], error: null }), { status: 'empty' });
  });

  it('is ready with a non-empty successful load', () => {
    const connections = [conn('a')];
    assert.deepStrictEqual(resolveRigConnectionsView({ loaded: true, connections, error: null }), { status: 'ready', connections });
  });

  it('is stale, preserving the cached inventory, when a refresh fails after a success', () => {
    const connections = [conn('a')];
    assert.deepStrictEqual(
      resolveRigConnectionsView({ loaded: true, connections, error: 'refresh failed' }),
      { status: 'stale', reason: 'refresh failed', connections },
    );
  });

  it('never lets an error read as an authoritative empty Rig', () => {
    // A failed refresh after a previously empty (but successful) load is stale,
    // disclosed, not a clean empty state.
    const view = resolveRigConnectionsView({ loaded: true, connections: [], error: 'refresh failed' });
    assert.strictEqual(view.status, 'stale');
    assert.notStrictEqual(view.status, 'empty');
  });
});
