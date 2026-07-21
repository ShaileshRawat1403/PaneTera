export type RigPermission = 'denied' | 'proposable' | 'auto-invocable';

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
  sourceClass: 'panetera-managed' | 'local-user-installed' | 'remote-external';
  transport: { kind: 'stdio'; executablePath: string; argv: string[]; cwd: string; isolationMode: string }
    | { kind: 'http'; url: string; localDevelopment: boolean; authRef: null };
  state: string;
  health: { state: string; lastSuccessfulContact: string | null };
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
