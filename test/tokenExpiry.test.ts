process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { registerMcpCredential, validateMcpClient } from '../server/mcp/browserMcpAuth';

describe('MCP credential token expiry unit tests', () => {
  it('allows valid token before expiration', () => {
    const token = 'test-token-active-123';
    registerMcpCredential(token, { clientId: 'c1', subjectId: 's1', scopes: [] }, 60_000);

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:3000',
      },
    } as any;

    const res = validateMcpClient(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.principal?.clientId, 'c1');
  });

  it('rejects token after expiration with 401 Unauthorized', async () => {
    const token = 'test-token-expired-456';
    registerMcpCredential(token, { clientId: 'c2', subjectId: 's2', scopes: [] }, -1000); // Already expired

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
        host: 'localhost:3000',
      },
    } as any;

    const res = validateMcpClient(req);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.error, 'Unauthorized: Credential expired');
  });
});
