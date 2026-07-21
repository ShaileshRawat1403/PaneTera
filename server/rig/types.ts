export type SourceClass = 'panetera-managed' | 'local-user-installed' | 'remote-external';
export type Permission = 'denied' | 'proposable' | 'auto-invocable';
export type ConnectionState =
  | 'disabled'
  | 'approval-required'
  | 'starting'
  | 'auth-required'
  | 'connected'
  | 'unreachable'
  | 'stopped';
export type ConnectionHealth = 'current' | 'degraded' | 'not-measured';

export interface StdioTransportSpec {
  kind: 'stdio';
  executablePath: string;
  argv: string[];
  cwd: string;
  environment: Array<
    | { name: string; source: 'literal'; value: string }
    | { name: string; source: 'secret-ref'; secretRef: string }
  >;
  isolationMode: 'none' | 'container';
}

export interface HttpTransportSpec {
  kind: 'http';
  url: string;
  localDevelopment: boolean;
  authRef: string | null;
}

export type McpTransportSpec = StdioTransportSpec | HttpTransportSpec;

export interface CapabilityCard {
  capabilityId: string;
  kind: 'tool' | 'resource' | 'prompt';
  name: string;
  label: string;
  description: { source: 'schema-derived' | 'user-authored' | 'user-adopted'; text: string };
  inputSchema: Record<string, unknown> | null;
  rawDeclaration: unknown;
  permission: Permission;
  enabled: boolean;
  structuralDigest: string;
  presentationDigest: string;
}

export interface CapabilitySnapshot {
  tools: CapabilityCard[];
  resources: CapabilityCard[];
  prompts: CapabilityCard[];
  structuralDigest: string;
  presentationDigest: string;
  discoveredAt: string | null;
  truncated: boolean;
}

export interface McpConnection {
  connectionId: string;
  displayName: string;
  sourceClass: SourceClass;
  transport: McpTransportSpec;
  endpointRef: string;
  executableDigest: string | null;
  entryPointDigest: string | null;
  launchSpecDigest: string | null;
  state: ConnectionState;
  health: { state: ConnectionHealth; lastSuccessfulContact: string | null };
  capabilities: CapabilitySnapshot;
  createdAt: string;
  updatedAt: string;
  connectionApprovalId: string | null;
}

export interface ProposedCapabilityCall {
  proposalId: string;
  connectionId: string;
  capabilityId: string;
  capabilityDigest: string;
  argumentsDigest: string;
  arguments: Record<string, unknown>;
  displayArguments: unknown;
  createdAt: string;
  expiresAt: string;
  approvalRequired: true;
}

export interface ApprovedCapabilityCall {
  approvalId: string;
  proposalId: string;
  connectionId: string;
  capabilityId: string;
  capabilityDigest: string;
  argumentsDigest: string;
  approvedAt: string;
  expiresAt: string;
  consumption:
    | { state: 'unconsumed' }
    | { state: 'claimed'; claimId: string; claimedAt: string }
    | { state: 'consumed'; claimId: string; consumedAt: string };
}

export interface ProvenanceRecord {
  recordId: string;
  recordType: string;
  ownerId: string;
  sourceIdentity: { kind: string; id: string };
  parentRecordIds: string[];
  inputDigest: string | null;
  outputDigest: string | null;
  createdAt: string;
  sourceClass: SourceClass;
  trustLevel: 'untrusted' | 'derived' | 'authoritative';
  correlation: {
    envelopeId?: string;
    proposalId?: string;
    approvalId?: string;
    connectionId?: string;
  };
  integrity: 'verified' | 'unverified' | 'broken';
  retentionClass: string;
}

export const EMPTY_CAPABILITY_SNAPSHOT: CapabilitySnapshot = {
  tools: [],
  resources: [],
  prompts: [],
  structuralDigest: '',
  presentationDigest: '',
  discoveredAt: null,
  truncated: false,
};
