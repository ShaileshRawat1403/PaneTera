export type RigPermission = 'denied' | 'proposable' | 'auto-invocable';

// The canonical client connection-state and health unions, mirrored from the
// server enums. These live here, on the shared type, rather than privately in a
// component, so every consumer reasons over the same closed set and the load
// boundary can validate against it.
export type ConnectionState =
  | 'disabled'
  | 'approval-required'
  | 'starting'
  | 'auth-required'
  | 'connected'
  | 'unreachable'
  | 'stopped';
export type ConnectionHealth = 'current' | 'degraded' | 'not-measured';

export type RigSourceClass = 'panetera-managed' | 'local-user-installed' | 'remote-external';
export type StdioIsolationMode = 'none' | 'container';

export const CONNECTION_STATES: readonly ConnectionState[] = [
  'disabled', 'approval-required', 'starting', 'auth-required', 'connected', 'unreachable', 'stopped',
];
export const CONNECTION_HEALTHS: readonly ConnectionHealth[] = ['current', 'degraded', 'not-measured'];
export const RIG_TRANSPORT_KINDS: readonly string[] = ['stdio', 'http'];
export const RIG_SOURCE_CLASSES: readonly RigSourceClass[] = ['panetera-managed', 'local-user-installed', 'remote-external'];
export const STDIO_ISOLATION_MODES: readonly StdioIsolationMode[] = ['none', 'container'];

export interface RigCapability {
  capabilityId: string;
  kind: 'tool' | 'resource' | 'prompt';
  name: string;
  label: string;
  description: { source: string; text: string };
  inputSchema: Record<string, unknown> | null;
  rawDeclaration: Record<string, unknown>;
  permission: RigPermission;
  enabled: boolean;
  structuralDigest: string;
  presentationDigest: string;
}

export interface RigConnection {
  connectionId: string;
  displayName: string;
  sourceClass: RigSourceClass;
  transport: { kind: 'stdio'; executablePath: string; argv: string[]; cwd: string; isolationMode: StdioIsolationMode }
    | { kind: 'http'; url: string; localDevelopment: boolean; authRef: string | null };
  state: ConnectionState;
  health: { state: ConnectionHealth; lastSuccessfulContact: string | null };
  capabilities: {
    tools: RigCapability[];
    resources: RigCapability[];
    prompts: RigCapability[];
    truncated: boolean;
    discoveredAt: string | null;
  };
  connectionApprovalId: string | null;
}

// Provenance, mirrored from the server record. `recordType` and `retentionClass`
// are open strings on purpose (new kinds can appear); trust and integrity are
// closed enums the UI must never widen or infer.
export type ProvenanceTrustLevel = 'untrusted' | 'derived' | 'authoritative';
export type ProvenanceIntegrity = 'verified' | 'unverified' | 'broken';

export const PROVENANCE_TRUST_LEVELS: readonly ProvenanceTrustLevel[] = ['untrusted', 'derived', 'authoritative'];
export const PROVENANCE_INTEGRITIES: readonly ProvenanceIntegrity[] = ['verified', 'unverified', 'broken'];

export interface ProvenanceRecord {
  recordId: string;
  recordType: string;
  ownerId: string;
  sourceIdentity: { kind: string; id: string };
  parentRecordIds: string[];
  inputDigest: string | null;
  outputDigest: string | null;
  createdAt: string;
  sourceClass: RigSourceClass;
  trustLevel: ProvenanceTrustLevel;
  correlation: {
    envelopeId?: string;
    proposalId?: string;
    approvalId?: string;
    connectionId?: string;
  };
  integrity: ProvenanceIntegrity;
  retentionClass: string;
}

export interface RigResourceChoice {
  connectionId: string;
  capabilityId: string;
  label: string;
  uri: string;
  connectionName: string;
}
