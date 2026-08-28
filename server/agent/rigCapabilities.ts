import { RigToolAdapter } from '../rig/adapter';
import { RigRuntime } from '../rig/runtime';
import { RigRegistry } from '../rig/registry';
import { logTypedAudit } from '../auditRecord';
import { rigAuditFields } from '../rig/auditClassification';
import { rigRegistry, rigApprovals, rigFindCapability } from '../rig/routes';
import type { OperatorPrincipal } from '../operatorPrincipal';
import type { McpConnection } from '../rig/types';
import type { CapabilityApprovalStore } from '../rig/approval';
import type { AgentCapability, AgentToolResult } from './types';

/**
 * Creates AgentCapability instances from enabled Rig MCP tools.
 * Each Rig tool becomes a governed capability that the agent runtime
 * can discover and invoke through the provider.
 * Proposable capabilities map strictly to risk: 'propose' and generate
 * authoritative single-use Rig proposals.
 */
export function createRigCapabilities(
  adapter: RigToolAdapter,
  runtime: RigRuntime,
  principal?: OperatorPrincipal,
  registry: { get: (id: string) => McpConnection | null } = rigRegistry,
  approvals: CapabilityApprovalStore = rigApprovals,
): AgentCapability[] {
  const tools = adapter.listEnabledTools();

  return tools.map((tool) => {
    const rawToolName = tool.rawToolName ?? tool.name;
    const isProposable = tool.permission === 'proposable';

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      risk: isProposable ? ('propose' as const) : ('observe' as const),
      async execute(arguments_: Record<string, unknown>): Promise<AgentToolResult> {
        if (isProposable) {
          const connection = registry.get(tool.connectionId);
          const capability = connection ? rigFindCapability(connection, tool.capabilityId) : null;
          if (!connection || connection.state !== 'connected' || !capability || capability.kind !== 'tool') {
            throw new Error(`Connected tool capability "${tool.capabilityId}" not found.`);
          }
          if (!capability.enabled || capability.permission !== 'proposable') {
            throw new Error(`Capability "${tool.capabilityId}" is not enabled for proposals.`);
          }

          const proposal = approvals.propose({
            connectionId: connection.connectionId,
            capabilityId: capability.capabilityId,
            capabilityDigest: tool.capabilityDigest || capability.structuralDigest,
            arguments: arguments_ && typeof arguments_ === 'object' && !Array.isArray(arguments_) ? arguments_ : {},
            displayArguments: arguments_ ?? {},
          });

          logTypedAudit({
            event: 'rig.invocation.proposed',
            ...rigAuditFields('rig.invocation.proposed', undefined, principal),
            correlation: { connectionId: connection.connectionId, proposalId: proposal.proposalId },
            details: { capabilityId: tool.capabilityId, argumentsDigest: proposal.argumentsDigest },
          });

          return {
            output: {
              proposed: true,
              connectionId: tool.connectionId,
              capabilityId: tool.capabilityId,
              toolName: rawToolName,
              proposalId: proposal.proposalId,
              expiresAt: proposal.expiresAt,
            },
            uiComponent: {
              type: 'ProposedCapabilityCall',
              data: {
                connectionId: tool.connectionId,
                capabilityId: tool.capabilityId,
                toolName: rawToolName,
                arguments: arguments_,
                proposalId: proposal.proposalId,
                expiresAt: proposal.expiresAt,
              },
            },
            requiresApproval: true,
            approval: {
              kind: 'rig-capability',
              approvalId: proposal.proposalId,
              proposalId: proposal.proposalId,
              capability: tool.capabilityId,
              connectionId: tool.connectionId,
              capabilityId: tool.capabilityId,
              capabilityDigest: tool.capabilityDigest || capability.structuralDigest,
              arguments: arguments_,
              displayArguments: arguments_,
              summary: `Call ${tool.connectionId} capability "${rawToolName}" with arguments ${JSON.stringify(arguments_)}`,
              expiresAt: proposal.expiresAt,
            },
            evidence: {
              source: 'rig-mcp',
              connectionId: tool.connectionId,
              capabilityId: tool.capabilityId,
              proposalId: proposal.proposalId,
              policyDecision: 'approval-required',
            },
          };
        }

        // Observe-risk execution path (for internal/safe read capabilities if configured)
        const result = await runtime.callTool(tool.connectionId, rawToolName, arguments_);
        return {
          output: result,
          evidence: {
            source: 'rig-mcp',
            connectionId: tool.connectionId,
            capabilityId: tool.capabilityId,
            toolName: rawToolName,
          },
        };
      },
    };
  });
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
