// src/utils/appOperationProposal.ts
//
// Turns a resolved application operation into a Rig proposal (ADR-005).
// The capability comes from the live Rig inventory, and the arguments are
// validated by the server when the proposal is created. Nothing here
// approves or runs anything: the stored proposal waits for review in Rig.

export interface AppOperationRequest {
  appId: string;
  operation: string;
  parameters: Record<string, unknown>;
}

export type AppOperationProposalOutcome =
  | { kind: 'proposed'; proposalId: string; capabilityId: string; arguments: Record<string, unknown> }
  | { kind: 'needs-capability'; message: string }
  | { kind: 'rejected'; message: string };

interface InventoryTool {
  capabilityId: string;
  name: string;
  enabled: boolean;
  permission: string;
}

interface InventoryConnection {
  connectionId: string;
  displayName?: string;
  state: string;
  capabilities?: { tools?: InventoryTool[] };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Rig errors are typed objects ({ error: { message } }); older routes send a string. */
function errorMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function proposeAppOperation(
  request: AppOperationRequest,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AppOperationProposalOutcome> {
  const authorization = { Authorization: `Bearer ${token}` };

  let connections: InventoryConnection[];
  try {
    const response = await fetchImpl('/api/rig/connections', { headers: authorization });
    const body = await readJson(response);
    if (!response.ok) {
      return { kind: 'rejected', message: `Rig could not be read, so nothing was proposed: ${errorMessage(body, `HTTP ${response.status}`)}` };
    }
    const listed = (body as { connections?: unknown } | null)?.connections;
    connections = Array.isArray(listed) ? (listed as InventoryConnection[]) : [];
  } catch (error: unknown) {
    return { kind: 'rejected', message: `Rig could not be reached, so nothing was proposed: ${describeFailure(error)}` };
  }

  const connection = connections.find((candidate) => candidate.connectionId === request.appId);
  const label = connection?.displayName ?? request.appId;
  if (!connection || connection.state !== 'connected') {
    return { kind: 'needs-capability', message: `${label} is not connected in Rig, so nothing was proposed. Connect it in Rig first.` };
  }

  const capability = connection.capabilities?.tools?.find((tool) => tool.name === request.operation);
  if (!capability) {
    return { kind: 'needs-capability', message: `${label} does not offer ${request.operation} in its current Rig inventory, so nothing was proposed.` };
  }
  if (!capability.enabled || capability.permission !== 'proposable') {
    return { kind: 'needs-capability', message: `${request.operation} is not enabled for proposals in Rig, so nothing was proposed.` };
  }

  try {
    const response = await fetchImpl('/api/rig/proposals', {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId: connection.connectionId,
        capabilityId: capability.capabilityId,
        arguments: request.parameters,
      }),
    });
    const body = await readJson(response);
    if (!response.ok) {
      return { kind: 'rejected', message: `Rig rejected the proposal, so nothing was queued: ${errorMessage(body, `HTTP ${response.status}`)}` };
    }
    const proposal = (body as { proposal?: { proposalId?: unknown; arguments?: unknown } } | null)?.proposal;
    if (!proposal || typeof proposal.proposalId !== 'string' || !proposal.arguments || typeof proposal.arguments !== 'object') {
      return { kind: 'rejected', message: 'Rig returned a proposal PaneTera could not read.' };
    }
    return {
      kind: 'proposed',
      proposalId: proposal.proposalId,
      capabilityId: capability.capabilityId,
      arguments: proposal.arguments as Record<string, unknown>,
    };
  } catch (error: unknown) {
    return { kind: 'rejected', message: `Rig could not be reached, so nothing was proposed: ${describeFailure(error)}` };
  }
}
