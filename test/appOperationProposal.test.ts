// test/appOperationProposal.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { proposeAppOperation } from '../src/utils/appOperationProposal';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const addModifier = { capabilityId: 'blender.blender.add_modifier', name: 'blender.add_modifier', enabled: true, permission: 'proposable' };

function rig(options: { connection?: unknown; proposalResponse?: Response }) {
  const calls: Array<{ url: string; method: string; body?: unknown; auth?: string }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: headers.Authorization });
    if (url === '/api/rig/connections') return json({ connections: options.connection ? [options.connection] : [] });
    if (url === '/api/rig/proposals') return options.proposalResponse ?? json({ error: 'unexpected' }, 500);
    return json({ error: 'unexpected route' }, 404);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const request = { appId: 'blender', operation: 'blender.add_modifier', parameters: { modifierType: 'BEVEL', objectId: 'CanisterBody' } };

describe('proposeAppOperation', () => {
  it('posts exactly the resolved parameters and reports the stored arguments', async () => {
    const stored = { modifierType: 'BEVEL', objectId: 'CanisterBody' };
    const { impl, calls } = rig({
      connection: { connectionId: 'blender', displayName: 'Blender', state: 'connected', capabilities: { tools: [addModifier] } },
      proposalResponse: json({ proposal: { proposalId: 'prop-7', arguments: stored } }, 201),
    });
    const outcome = await proposeAppOperation(request, 'tok', impl);
    assert.deepEqual(outcome, { kind: 'proposed', proposalId: 'prop-7', capabilityId: addModifier.capabilityId, arguments: stored });
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['GET /api/rig/connections', 'POST /api/rig/proposals']);
    assert.deepEqual(calls[1].body, { connectionId: 'blender', capabilityId: addModifier.capabilityId, arguments: request.parameters });
    assert.ok(calls.every((c) => c.auth === 'Bearer tok'));
  });

  it('never approves or invokes', async () => {
    const { impl, calls } = rig({
      connection: { connectionId: 'blender', state: 'connected', capabilities: { tools: [addModifier] } },
      proposalResponse: json({ proposal: { proposalId: 'p', arguments: {} } }, 201),
    });
    await proposeAppOperation(request, 'tok', impl);
    assert.ok(!calls.some((c) => /approve|invocations/.test(c.url)));
  });

  it('proposes nothing when the application is not connected or the capability is unavailable', async () => {
    const cases = [
      undefined,
      { connectionId: 'blender', displayName: 'Blender', state: 'approval-required', capabilities: { tools: [addModifier] } },
      { connectionId: 'blender', displayName: 'Blender', state: 'connected', capabilities: { tools: [] } },
      { connectionId: 'blender', displayName: 'Blender', state: 'connected', capabilities: { tools: [{ ...addModifier, permission: 'denied' }] } },
    ];
    for (const connection of cases) {
      const { impl, calls } = rig({ connection });
      const outcome = await proposeAppOperation(request, 'tok', impl);
      assert.equal(outcome.kind, 'needs-capability', JSON.stringify(connection));
      assert.ok(!calls.some((c) => c.method === 'POST'), 'nothing is posted');
    }
  });

  it('surfaces the server validation error when Rig rejects the proposal', async () => {
    const { impl } = rig({
      connection: { connectionId: 'blender', state: 'connected', capabilities: { tools: [addModifier] } },
      proposalResponse: json({ version: 2, error: { kind: 'validation', message: 'Missing required field: objectId' } }, 400),
    });
    const outcome = await proposeAppOperation({ ...request, parameters: { modifierType: 'BEVEL' } }, 'tok', impl);
    assert.equal(outcome.kind, 'rejected');
    assert.match((outcome as { message: string }).message, /Missing required field: objectId/);
  });
});
