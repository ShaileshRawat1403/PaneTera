import { RigRegistry } from './registry';
import type { McpConnection } from './types';

export interface UnifiedPortalManifest {
  version: number;
  timestamp: string;
  connections: McpConnection[];
  summary: {
    totalConnections: number;
    activeConnections: number;
    totalTools: number;
    totalResources: number;
    totalPrompts: number;
  };
}

export function buildUnifiedPortalManifest(registry: Pick<RigRegistry, 'list'> = new RigRegistry()): UnifiedPortalManifest {
  const connections = registry.list();
  const activeConnections = connections.filter((c) => c.state === 'connected');

  let totalTools = 0;
  let totalResources = 0;
  let totalPrompts = 0;

  for (const conn of activeConnections) {
    totalTools += conn.capabilities.tools.length;
    totalResources += conn.capabilities.resources.length;
    totalPrompts += conn.capabilities.prompts.length;
  }

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    connections,
    summary: {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      totalTools,
      totalResources,
      totalPrompts,
    },
  };
}
