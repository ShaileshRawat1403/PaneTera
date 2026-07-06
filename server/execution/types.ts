// server/execution/types.ts
//
// Execution adapter contract for myai-portal.
// See docs/MYAI_PORTAL_CONTRACT.md for the full product contract.
//
// Adapters are pluggable backends that run approved commands.
// The portal never calls exec() directly — it routes through an adapter.

// ── Risk levels ──────────────────────────────────────────────────────────────

export type RiskLevel = 'safe' | 'review' | 'dangerous';

// ── Execution mode ───────────────────────────────────────────────────────────

export type ExecutionMode = 'local-shell' | 'apple-container' | 'dax' | 'dry-run';

// ── Allowlist ────────────────────────────────────────────────────────────────
// Phase 1: only these commands are permitted. The allowlist is defined in
// code, not config, and must be extended explicitly.

export interface AllowlistEntry {
  /** The base command (e.g. 'npm test', 'git status'). Matched as a safe prefix. */
  command: string;
  risk: RiskLevel;
  /** Human-readable description shown in the approval card */
  description: string;
  /** Which adapters can run this command */
  allowedAdapters: ExecutionMode[];
}

export const COMMAND_ALLOWLIST: AllowlistEntry[] = [
  {
    command: 'npm test',
    risk: 'safe',
    description: 'Run project test suite',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'npm run build',
    risk: 'safe',
    description: 'Build project for production',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'npm run lint',
    risk: 'safe',
    description: 'Run linter on project source',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'npm run verify',
    risk: 'safe',
    description: 'Run project verification script',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'git status',
    risk: 'safe',
    description: 'Show working tree status',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'git log',
    risk: 'safe',
    description: 'Show commit history',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'git diff',
    risk: 'safe',
    description: 'Show uncommitted changes',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'cargo test',
    risk: 'safe',
    description: 'Run Rust test suite',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'cargo check',
    risk: 'safe',
    description: 'Check Rust project without producing a final binary',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
  {
    command: 'cargo build',
    risk: 'review',
    description: 'Compile Rust project',
    allowedAdapters: ['local-shell', 'apple-container'],
  },
];

// ── Execution request/result ─────────────────────────────────────────────────

export interface ExecutionRequest {
  /** Unique request ID for tracking */
  id: string;
  /** The full command string to execute */
  command: string;
  /** The workspace directory to execute in */
  workspacePath: string;
  /** Human-readable workspace name */
  workspaceName: string;
  /** Matched allowlist entry (already validated before reaching adapter) */
  allowlistEntry: AllowlistEntry;
  /** Which adapter mode was selected */
  mode: ExecutionMode;
}

export interface ExecutionResult {
  id: string;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Milliseconds elapsed */
  durationMs: number;
  /** The adapter that ran this command */
  adapter: string;
  /** Whether this was a dry run (no actual execution) */
  dryRun: boolean;
}

// ── Adapter interface ────────────────────────────────────────────────────────

export interface ExecutionAdapter {
  /** Human-readable adapter name */
  name: string;

  /** Check if this adapter is available on the current system */
  available(): Promise<boolean>;

  /** Execute a validated, approved command */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

// ── Allowlist validation ─────────────────────────────────────────────────────

/**
 * Check a command against the allowlist. Returns the matching entry or null.
 * Match is exact matching for the safest POC.
 */
export function validateCommand(command: string): AllowlistEntry | null {
  const normalized = normalizeCommand(command);
  if (!normalized || hasUnsafeShellSyntax(normalized)) {
    return null;
  }

  for (const entry of COMMAND_ALLOWLIST) {
    if (normalized === entry.command) {
      return entry;
    }
  }
  return null;
}

export function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

function hasUnsafeShellSyntax(command: string): boolean {
  return /[\n\r;&|<>`$\\]/.test(command);
}
