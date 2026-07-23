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

export interface RigResourceChoice {
  connectionId: string;
  capabilityId: string;
  label: string;
  uri: string;
  connectionName: string;
}
