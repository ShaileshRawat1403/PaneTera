import { RigRegistry } from './registry';
import { RigRuntime } from './runtime';
import type { LlmToolDefinition, McpConnection } from './types';

export class RigToolAdapter {
  constructor(
    private readonly registry: Pick<RigRegistry, 'list'> = new RigRegistry(),
    private readonly runtime?: Pick<RigRuntime, 'isConnected'>
  ) {}

  listEnabledTools(connectionIds?: string[]): LlmToolDefinition[] {
    const connections = this.registry.list();
    const result: LlmToolDefinition[] = [];

    for (const connection of connections) {
      if (connection.state !== 'connected') continue;
      if (connectionIds && !connectionIds.includes(connection.connectionId)) continue;
      if (this.runtime && !this.runtime.isConnected(connection.connectionId)) continue;

      for (const tool of connection.capabilities.tools) {
        if (!tool.enabled || tool.permission === 'denied') continue;
        result.push({
          name: `${connection.connectionId}__${tool.name}`,
          description: tool.description.text,
          inputSchema: tool.inputSchema || {},
          connectionId: connection.connectionId,
          capabilityId: tool.capabilityId,
          permission: tool.permission,
        });
      }
    }

    return result;
  }
}
