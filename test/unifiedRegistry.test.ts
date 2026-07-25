process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildUnifiedPortalManifest } from '../server/rig/unifiedRegistry';
import type { McpConnection } from '../server/rig/types';

describe('Unified portal manifest unit tests', () => {
  it('builds a unified manifest summarizing connections and capabilities', () => {
    const mockConnections: McpConnection[] = [
      {
        connectionId: 'conn-1',
        displayName: 'Test Server',
        sourceClass: 'panetera-managed',
        transport: { kind: 'stdio', executablePath: '/bin/node', argv: [], cwd: '/', environment: [], isolationMode: 'none' },
        endpointRef: '/bin/node',
        executableDigest: null,
        entryPointDigest: null,
        launchSpecDigest: null,
        state: 'connected',
        health: { state: 'current', lastSuccessfulContact: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectionApprovalId: 'app-1',
        capabilities: {
          tools: [
            {
              capabilityId: 'tool-1',
              kind: 'tool',
              name: 'tool_one',
              label: 'Tool One',
              description: { source: 'schema-derived', text: 'Test tool' },
              inputSchema: null,
              rawDeclaration: {},
              permission: 'proposable',
              enabled: true,
              structuralDigest: 'd1',
              presentationDigest: 'p1',
            },
          ],
          resources: [],
          prompts: [],
          structuralDigest: 'snap-d1',
          presentationDigest: 'snap-p1',
          discoveredAt: new Date().toISOString(),
          truncated: false,
        },
      },
    ];

    const mockRegistry = { list: () => mockConnections };
    const manifest = buildUnifiedPortalManifest(mockRegistry);

    assert.strictEqual(manifest.version, 1);
    assert.strictEqual(manifest.summary.totalConnections, 1);
    assert.strictEqual(manifest.summary.activeConnections, 1);
    assert.strictEqual(manifest.summary.totalTools, 1);
  });
});
