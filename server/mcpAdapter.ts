// server/mcpAdapter.ts
// Stdio MCP Adapter manager that spawns processes and enforces global host policies.

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceCatalogPath } from './appData';
import {
  logTypedAudit,
  humanActor,
  systemActor,
  unknownActor,
  type AuditOutcome,
  type PolicyDecision,
  type TypedAuditRecord,
} from './auditRecord';
import type { OperatorPrincipal } from './operatorPrincipal';

interface PolicyConfig {
  denyPaths: string[];
  denyExtensions: string[];
  defaultRiskPolicy: Record<string, string>;
}

// Global active adapters map
const activeAdapters = new Map<string, McpWorkspaceAdapter>();

export function auditWorkspaceAdapter(input: {
  event: string;
  workspaceId: string;
  outcome: AuditOutcome;
  policyDecision?: PolicyDecision;
  details?: Record<string, unknown>;
}): TypedAuditRecord {
  return logTypedAudit({
    event: input.event,
    actor: systemActor('workspace-adapter'),
    outcome: input.outcome,
    policyDecision: input.policyDecision ?? 'allowed',
    details: { workspaceId: input.workspaceId, ...(input.details ?? {}) },
  });
}

export function auditWorkspaceCaller(input: {
  event: string;
  workspaceId: string;
  outcome: AuditOutcome;
  policyDecision: PolicyDecision;
  details?: Record<string, unknown>;
  principal?: OperatorPrincipal;
}): TypedAuditRecord {
  return logTypedAudit({
    event: input.event,
    actor: input.principal ? humanActor(input.principal) : unknownActor('workspace-caller-unattributed'),
    outcome: input.outcome,
    policyDecision: input.policyDecision,
    details: { workspaceId: input.workspaceId, ...(input.details ?? {}) },
  });
}

export class McpWorkspaceAdapter {
  private childProcess: ChildProcess | null = null;
  private messageId = 1;
  private pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private stdoutBuffer = '';

  constructor(public workspaceId: string, public workspacePath: string) {}

  public async start(): Promise<void> {
    if (this.childProcess) return;

    // Verify workspace path existence
    if (!fs.existsSync(this.workspacePath)) {
      const err = `Workspace path ${this.workspacePath} does not exist.`;
      auditWorkspaceAdapter({ event: 'workspace.adapter.error', workspaceId: this.workspaceId, outcome: 'error', details: { error: err } });
      throw new Error(err);
    }

    const scriptPath = path.resolve(__dirname, 'mcpWorkspaceServer.ts');
    
    // Spawn server using npx tsx in target workspace root directory
    this.childProcess = spawn('npx', ['tsx', scriptPath], {
      cwd: this.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.childProcess.stderr?.on('data', (data) => {
      // Forward stderr messages to portal backend logs (useful for debug)
      console.error(`[MCP WORKSPACE SERVER ${this.workspaceId} STDERR]`, data.toString().trim());
    });

    this.childProcess.on('close', (code, signal) => {
      const expectedStop = code === 0 || signal === 'SIGTERM';
      auditWorkspaceAdapter({
        event: 'workspace.adapter.stopped',
        workspaceId: this.workspaceId,
        outcome: expectedStop ? 'success' : 'error',
        details: { exitCode: code, signal },
      });
      this.childProcess = null;
      this.pendingRequests.forEach(req => req.reject(new Error('MCP server process exited')));
      this.pendingRequests.clear();
      activeAdapters.delete(this.workspaceId);
    });

    this.childProcess.on('error', (err) => {
      auditWorkspaceAdapter({ event: 'workspace.adapter.error', workspaceId: this.workspaceId, outcome: 'error', details: { error: err.message } });
      console.error(`[MCP ADAPTER ERROR ${this.workspaceId}]`, err.message);
    });

    // Handle stdout JSON-RPC response parser
    this.childProcess.stdout?.on('data', (chunk) => {
      this.stdoutBuffer += chunk.toString();
      let newlineIdx = this.stdoutBuffer.indexOf('\n');
      while (newlineIdx !== -1) {
        const line = this.stdoutBuffer.substring(0, newlineIdx).trim();
        this.stdoutBuffer = this.stdoutBuffer.substring(newlineIdx + 1);
        newlineIdx = this.stdoutBuffer.indexOf('\n');

        if (!line) continue;

        try {
          const message = JSON.parse(line);
          if (message.id !== undefined && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id)!;
            this.pendingRequests.delete(message.id);
            if (message.error) {
              reject(new Error(message.error.message || 'JSON-RPC Error'));
            } else {
              resolve(message.result);
            }
          }
        } catch (err: any) {
          console.error(`[MCP ADAPTER PARSE ERROR] Invalid line:`, line, err.message);
        }
      }
    });

    // Wait a brief moment to ensure startup
    await new Promise(resolve => setTimeout(resolve, 500));

    // Spawning only proves that the launch was requested. Do not record a
    // successful start until the process has survived the startup window.
    if (!this.childProcess || this.childProcess.exitCode !== null) {
      throw new Error(`MCP workspace server ${this.workspaceId} exited during startup.`);
    }
    auditWorkspaceAdapter({ event: 'workspace.adapter.started', workspaceId: this.workspaceId, outcome: 'success' });
  }

  public stop(): void {
    if (this.childProcess) {
      try {
        const proc = this.childProcess;
        proc.kill('SIGTERM');
        // Escalate to SIGKILL if it lingers, but unref the timer so it never
        // keeps this process (or a tsx watch restart) alive on its own.
        setTimeout(() => {
          try {
            if (proc.pid && proc.exitCode === null) {
              proc.kill('SIGKILL');
            }
          } catch {}
        }, 1000).unref();
      } catch {}
      this.childProcess = null;
    }
  }

  // Authoritative host policy validation check
  private validateAccessPolicy(toolName: string, args: any, principal?: OperatorPrincipal): void {
    const policyPath = path.resolve(__dirname, 'myai-policy.json');
    let policy: PolicyConfig = { denyPaths: [], denyExtensions: [], defaultRiskPolicy: {} };
    try {
      policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    } catch (err) {
      console.error('[POLICY WARNING] Failed to read myai-policy.json, using defaults.');
    }

    if (toolName === 'workspace.readFile' || toolName === 'workspace.analyzeStructure' || toolName === 'workspace.mapDependencies') {
      const relPath = String(
        toolName === 'workspace.mapDependencies' 
          ? (args.entryPoint || '') 
          : (args.relativePath || '')
      ).trim();
      
      // 1. Check for denied extensions
      const ext = path.extname(relPath).toLowerCase();
      const baseName = path.basename(relPath).toLowerCase();
      if (policy.denyExtensions.includes(ext) || policy.denyExtensions.includes(baseName) || baseName.startsWith('.env')) {
        auditWorkspaceCaller({
          event: 'workspace.read.denied', workspaceId: this.workspaceId, outcome: 'denied', policyDecision: 'denied',
          principal,
          details: { tool: toolName, reason: 'denied file extension or name' },
        });
        throw new Error(`Access Denied: Reading or scanning of file '${relPath}' is forbidden by host policy rules.`);
      }

      // 2. Check for denied directories / traversal
      const normalized = path.normalize(relPath);
      if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        auditWorkspaceCaller({
          event: 'workspace.read.denied', workspaceId: this.workspaceId, outcome: 'denied', policyDecision: 'denied',
          principal,
          details: { tool: toolName, reason: 'workspace boundary violation' },
        });
        throw new Error(`Access Denied: Path '${relPath}' goes outside permitted workspace boundary.`);
      }

      const pathSegments = normalized.split(path.sep);
      const isDeniedPath = policy.denyPaths.some(dp => {
        const cleanPattern = dp.replace(/\*/g, '').replace(/^\/+|\/+$/g, '');
        return pathSegments.some(seg => seg === cleanPattern);
      });

      if (isDeniedPath) {
        auditWorkspaceCaller({
          event: 'workspace.read.denied', workspaceId: this.workspaceId, outcome: 'denied', policyDecision: 'denied',
          principal,
          details: { tool: toolName, reason: 'denied workspace path' },
        });
        throw new Error(`Access Denied: Path '${relPath}' matches denied folders in host security rules.`);
      }
    }
  }

  public async call(toolName: string, args: any, principal?: OperatorPrincipal): Promise<any> {
    // Policy must run before starting an adapter: a denied request receives no
    // process-launch side effect.
    this.validateAccessPolicy(toolName, args, principal);

    if (!this.childProcess) {
      await this.start();
    }

    const id = this.messageId++;
    const request = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout: Tool request '${toolName}' timed out after 5000ms.`));
          auditWorkspaceAdapter({
            event: 'workspace.tool.failed', workspaceId: this.workspaceId, outcome: 'error',
            details: { tool: toolName, reason: 'timeout' },
          });
        }
      }, 5000);

      this.pendingRequests.set(id, {
        resolve: (res) => {
          clearTimeout(timeout);
          auditWorkspaceAdapter({
            event: 'workspace.tool.completed', workspaceId: this.workspaceId, outcome: 'success',
            details: { tool: toolName },
          });
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timeout);
          auditWorkspaceAdapter({
            event: 'workspace.tool.failed', workspaceId: this.workspaceId, outcome: 'error',
            details: { tool: toolName, error: err instanceof Error ? err.message : String(err) },
          });
          reject(err);
        }
      });

      try {
        this.childProcess!.stdin!.write(JSON.stringify(request) + '\n');
        auditWorkspaceCaller({
          event: 'workspace.tool.dispatched', workspaceId: this.workspaceId, outcome: 'pending', policyDecision: 'allowed',
          principal,
          details: { tool: toolName },
        });
      } catch (err: any) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        auditWorkspaceAdapter({
          event: 'workspace.tool.failed', workspaceId: this.workspaceId, outcome: 'error',
          details: { tool: toolName, error: err.message },
        });
        reject(err);
      }
    });
  }
}

// Helpers to get or spawn workspace adapters securely
export async function getWorkspaceAdapter(workspaceId: string): Promise<McpWorkspaceAdapter> {
  if (activeAdapters.has(workspaceId)) {
    return activeAdapters.get(workspaceId)!;
  }

  // Check catalog first
  const catalogPath = getWorkspaceCatalogPath();
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const ws = catalog.workspaces.find((w: any) => w.id === workspaceId);

  if (!ws) {
    throw new Error(`Workspace with ID ${workspaceId} not found in catalog.`);
  }
  if (!ws.enabled) {
    throw new Error(`Workspace ${ws.name} is disabled. Enable it in the navigator settings first.`);
  }

  const adapter = new McpWorkspaceAdapter(workspaceId, ws.path);
  await adapter.start();
  activeAdapters.set(workspaceId, adapter);
  return adapter;
}

export function stopWorkspaceAdapter(workspaceId: string): void {
  if (activeAdapters.has(workspaceId)) {
    activeAdapters.get(workspaceId)!.stop();
    activeAdapters.delete(workspaceId);
  }
}

export function stopAllWorkspaceAdapters(): void {
  activeAdapters.forEach(adapter => adapter.stop());
  activeAdapters.clear();
}

export function setWorkspaceAdapterForTest(workspaceId: string, adapter: McpWorkspaceAdapter): void {
  activeAdapters.set(workspaceId, adapter);
}
