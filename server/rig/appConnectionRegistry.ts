// server/rig/appConnectionRegistry.ts
//
// Registers PaneTera's built-in application MCP connections (Blender, REAPER)
// in the Rig registry. These connections are gated by approval and governed
// invocation.

import path from 'path';
import { RigRegistry } from './registry';
import { RigRuntime } from './runtime';

// Path to tsx binary (used to launch the MCP servers)
const TSX_PATH = path.resolve(process.cwd(), 'node_modules/.bin/tsx');
const PROJECT_ROOT = process.cwd();

interface AppMcpConnection {
  connectionId: string;
  displayName: string;
  executablePath: string;
  argv: string[];
}

const APP_CONNECTIONS: Record<string, AppMcpConnection> = {
  blender: {
    connectionId: 'blender',
    displayName: 'Blender',
    executablePath: TSX_PATH,
    argv: [path.resolve(PROJECT_ROOT, 'server/mcp/blenderMcpServer.ts')],
  },
  reaper: {
    connectionId: 'reaper',
    displayName: 'REAPER',
    executablePath: TSX_PATH,
    argv: [path.resolve(PROJECT_ROOT, 'server/mcp/reaperMcpServer.ts')],
  },
};

export function registerAppMcpConnection(
  name: string,
  registry: RigRegistry,
  runtime: RigRuntime,
): void {
  const connection = APP_CONNECTIONS[name];
  if (!connection) {
    console.warn(`[AppConnectionRegistry] Unknown app: ${name}`);
    return;
  }

  // Check if already registered
  const existing = registry.get(connection.connectionId);
  if (existing) {
    console.log(`[AppConnectionRegistry] ${connection.displayName} already registered in Rig`);
    return;
  }

  // Create a placeholder record that will be fully configured when the user
  // approves it through the Rig UI. The connection starts in 'approval-required'
  // state and transitions to 'connected' only after explicit approval.
  registry.create({
    displayName: connection.displayName,
    sourceClass: 'panetera-managed',
    transport: {
      kind: 'stdio',
      executablePath: connection.executablePath,
      argv: connection.argv,
      cwd: PROJECT_ROOT,
      environment: [
        { name: 'NODE_ENV', source: 'literal', value: process.env.NODE_ENV || 'development' },
        { name: 'PORTAL_TOKEN', source: 'literal', value: process.env.PORTAL_TOKEN || '' },
        { name: 'PATH', source: 'literal', value: process.env.PATH || '/usr/local/bin:/usr/bin:/bin' },
      ],
      isolationMode: 'none',
    },
    endpointRef: connection.executablePath,
  }).then((record) => {
    console.log(`[AppConnectionRegistry] ${connection.displayName} registered in Rig (id: ${record.connectionId}, state: ${record.state})`);
  }).catch((err) => {
    console.warn(`[AppConnectionRegistry] Failed to register ${connection.displayName}: ${err.message}`);
  });
}

export function getAppConnectionConfig(name: string): AppMcpConnection | undefined {
  return APP_CONNECTIONS[name];
}

export { APP_CONNECTIONS };
