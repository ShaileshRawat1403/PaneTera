// server/execution/index.ts
//
// Execution router — validates commands against the allowlist, selects
// an adapter, and dispatches approved requests. This is the single
// entry point the server uses to execute commands.

import {
  validateCommand,
  type ExecutionAdapter,
  type ExecutionMode,
  type ExecutionRequest,
  type ExecutionResult,
  type AllowlistEntry,
} from './types';
import { LocalShellAdapter } from './localShellAdapter';
import { AppleContainerAdapter } from './appleContainerAdapter';

// ── Adapter registry ─────────────────────────────────────────────────────────

const adapters: Record<string, ExecutionAdapter> = {
  'local-shell': new LocalShellAdapter(),
  'apple-container': new AppleContainerAdapter(),
};

// ── Validation result ────────────────────────────────────────────────────────

export interface ValidationResult {
  allowed: boolean;
  entry: AllowlistEntry | null;
  reason: string;
  availableAdapters: ExecutionMode[];
}

/**
 * Validate a command and return which adapters can run it.
 * Does NOT execute anything — this is the "preview" step.
 */
export async function validateExecution(
  command: string,
  preferredMode?: ExecutionMode,
): Promise<ValidationResult> {
  const entry = validateCommand(command);

  if (!entry) {
    return {
      allowed: false,
      entry: null,
      reason: `Command not in allowlist: "${command}"`,
      availableAdapters: [],
    };
  }

  // Check which adapters are actually available on this system
  const available: ExecutionMode[] = [];
  for (const mode of entry.allowedAdapters) {
    const adapter = adapters[mode];
    if (adapter && await adapter.available()) {
      available.push(mode);
    }
  }

  if (preferredMode && available.includes(preferredMode)) {
    available.sort((a) => (a === preferredMode ? -1 : 1));
  }

  if (available.length === 0) {
    return {
      allowed: true,
      entry,
      reason: 'Command is allowed but no execution adapters are available',
      availableAdapters: [],
    };
  }

  return {
    allowed: true,
    entry,
    reason: 'Command validated against allowlist',
    availableAdapters: available,
  };
}

/**
 * Execute an approved command through the specified adapter.
 * The caller is responsible for showing the approval gate first.
 */
export async function executeCommand(
  command: string,
  workspacePath: string,
  workspaceName: string,
  mode: ExecutionMode,
): Promise<ExecutionResult> {
  // Re-validate at execution time (defense in depth)
  const entry = validateCommand(command);
  if (!entry) {
    return {
      id: generateId(),
      success: false,
      exitCode: null,
      stdout: '',
      stderr: `BLOCKED: "${command}" is not in the command allowlist.`,
      durationMs: 0,
      adapter: 'none',
      dryRun: false,
    };
  }

  const adapter = adapters[mode];
  if (!adapter) {
    return {
      id: generateId(),
      success: false,
      exitCode: null,
      stdout: '',
      stderr: `Unknown execution adapter: ${mode}`,
      durationMs: 0,
      adapter: 'none',
      dryRun: false,
    };
  }

  if (!entry.allowedAdapters.includes(mode)) {
    return {
      id: generateId(),
      success: false,
      exitCode: null,
      stdout: '',
      stderr: `BLOCKED: ${mode} is not allowed for "${entry.command}".`,
      durationMs: 0,
      adapter: 'none',
      dryRun: false,
    };
  }

  const request: ExecutionRequest = {
    id: generateId(),
    command: command.trim(),
    workspacePath,
    workspaceName,
    allowlistEntry: entry,
    mode,
  };

  return adapter.execute(request);
}

/**
 * Get the status of all registered adapters.
 */
export async function getAdapterStatus(): Promise<
  Array<{ name: string; available: boolean }>
> {
  const result: Array<{ name: string; available: boolean }> = [];
  for (const [name, adapter] of Object.entries(adapters)) {
    result.push({
      name,
      available: await adapter.available(),
    });
  }
  return result;
}

// Re-export types for server use
export type { ExecutionMode, ExecutionResult, AllowlistEntry } from './types';
export { COMMAND_ALLOWLIST, validateCommand } from './types';

function generateId(): string {
  // Simple unique ID without external dependency
  return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function selectedExecutionMode(): ExecutionMode {
  const mode = process.env.PORTAL_EXECUTION_MODE;
  return mode === 'apple-container' ? 'apple-container' : 'local-shell';
}

export interface ProposedActionData {
  workspaceName: string;
  command: string;
  reason: string;
  riskLevel: string;
  executionMode: ExecutionMode;
  isDryRun: boolean;
  allowed: boolean;
  description: string;
}

export function buildProposedActionData(
  workspaceName: string,
  command: string,
  reason: string = '',
): ProposedActionData {
  const allowlistEntry = validateCommand(command);
  const risk = allowlistEntry ? allowlistEntry.risk : 'dangerous';
  const allowed = !!allowlistEntry;
  const mode = selectedExecutionMode();

  return {
    workspaceName,
    command,
    reason,
    riskLevel: risk,
    executionMode: mode,
    isDryRun: true, // Phase 1 is dry-run only
    allowed,
    description: allowlistEntry?.description || 'Blocked / Unknown Command',
  };
}

export function parseLocalCommandProposal(query: string): { workspace: string; command: string } | null {
  const proposeVerbRegex = /\b(build|lint|verify|tests?)\b/i;
  const proposeWorkspaceMatch = query.match(/(?:for|in)\s+([\w-]+)/i);
  const proposeVerbMatch = query.match(proposeVerbRegex);
  if (proposeVerbMatch && proposeWorkspaceMatch) {
    const workspace = proposeWorkspaceMatch[1];
    const verb = proposeVerbMatch[1].toLowerCase();
    const isRust = workspace.toLowerCase() === 'rook';
    const usesVerifyInsteadOfTest = workspace.toLowerCase() === 'flowright';
    const command = verb.startsWith('verify')
      ? 'npm run verify'
      : verb.startsWith('lint')
        ? 'npm run lint'
        : verb.startsWith('test')
          ? (isRust ? 'cargo test' : (usesVerifyInsteadOfTest ? 'npm run verify' : 'npm test'))
          : (isRust ? 'cargo check' : 'npm run build');
    return { workspace, command };
  }
  return null;
}
