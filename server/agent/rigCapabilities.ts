import { RigToolAdapter } from '../rig/adapter';
import { RigRuntime } from '../rig/runtime';
import { RigRegistry } from '../rig/registry';
import type { AgentCapability, AgentToolResult } from './types';

/**
 * Creates AgentCapability instances from enabled Rig MCP tools.
 * Each Rig tool becomes a governed capability that the agent runtime
 * can discover and invoke through the provider.
 */
export function createRigCapabilities(
  adapter: RigToolAdapter,
  runtime: RigRuntime,
): AgentCapability[] {
  const tools = adapter.listEnabledTools();

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    risk: 'observe' as const,
    async execute(arguments_: Record<string, unknown>): Promise<AgentToolResult> {
      const result = await runtime.callTool(tool.connectionId, tool.name, arguments_);
      return {
        output: result,
        evidence: {
          source: 'rig-mcp',
          connectionId: tool.connectionId,
          capabilityId: tool.capabilityId,
          toolName: tool.name,
        },
      };
    },
  }));
}

/**
 * Merges core agent capabilities with Rig MCP capabilities.
 * Rig tools are prefixed with their connection ID to avoid name collisions.
 */
export function mergeCapabilities(
  coreCapabilities: AgentCapability[],
  rigCapabilities: AgentCapability[],
): AgentCapability[] {
  const seen = new Set<string>();
  const merged: AgentCapability[] = [];

  for (const cap of coreCapabilities) {
    if (!seen.has(cap.name)) {
      seen.add(cap.name);
      merged.push(cap);
    }
  }

  for (const cap of rigCapabilities) {
    if (!seen.has(cap.name)) {
      seen.add(cap.name);
      merged.push(cap);
    }
  }

  return merged;
}
