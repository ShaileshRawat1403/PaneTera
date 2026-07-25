process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RigToolAdapter } from '../server/rig/adapter';
import type { McpConnection } from '../server/rig/types';

describe('RigToolAdapter integration unit tests', () => {
  it('collects enabled tools from connected connections only', () => {
    const mockConnections: McpConnection[] = [
      {
        connectionId: 'conn-active',
        displayName: 'Active Server',
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
              capabilityId: 'tool-read',
              kind: 'tool',
              name: 'read_file',
              label: 'Read File',
              description: { source: 'schema-derived', text: 'Reads workspace file content.' },
              inputSchema: { type: 'object' },
              rawDeclaration: {},
              permission: 'proposable',
              enabled: true,
              structuralDigest: 'dig-1',
              presentationDigest: 'pres-1',
            },
            {
              capabilityId: 'tool-disabled',
              kind: 'tool',
              name: 'disabled_tool',
              label: 'Disabled Tool',
              description: { source: 'schema-derived', text: 'Disabled tool.' },
              inputSchema: null,
              rawDeclaration: {},
              permission: 'denied',
              enabled: false,
              structuralDigest: 'dig-2',
              presentationDigest: 'pres-2',
            },
          ],
          resources: [],
          prompts: [],
          structuralDigest: 'snap-1',
          presentationDigest: 'snap-pres-1',
          discoveredAt: new Date().toISOString(),
          truncated: false,
        },
      },
      {
        connectionId: 'conn-stopped',
        displayName: 'Stopped Server',
        sourceClass: 'panetera-managed',
        transport: { kind: 'stdio', executablePath: '/bin/node', argv: [], cwd: '/', environment: [], isolationMode: 'none' },
        endpointRef: '/bin/node',
        executableDigest: null,
        entryPointDigest: null,
        launchSpecDigest: null,
        state: 'stopped',
        health: { state: 'not-measured', lastSuccessfulContact: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectionApprovalId: null,
        capabilities: {
          tools: [
            {
              capabilityId: 'tool-stopped',
              kind: 'tool',
              name: 'stopped_tool',
              label: 'Stopped Tool',
              description: { source: 'schema-derived', text: 'Stopped tool.' },
              inputSchema: null,
              rawDeclaration: {},
              permission: 'proposable',
              enabled: true,
              structuralDigest: 'dig-3',
              presentationDigest: 'pres-3',
            },
          ],
          resources: [],
          prompts: [],
          structuralDigest: 'snap-2',
          presentationDigest: 'snap-pres-2',
          discoveredAt: new Date().toISOString(),
          truncated: false,
        },
      },
    ];

    const mockRegistry = { list: () => mockConnections };
    const adapter = new RigToolAdapter(mockRegistry);
    const tools = adapter.listEnabledTools();

    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].name, 'conn-active__read_file');
    assert.strictEqual(tools[0].connectionId, 'conn-active');
    assert.strictEqual(tools[0].permission, 'proposable');
  });
});
