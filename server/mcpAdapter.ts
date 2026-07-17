// server/mcpAdapter.ts
// Stdio MCP Adapter manager that spawns processes and enforces global host policies.

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logAudit } from './audit';

interface PolicyConfig {
  denyPaths: string[];
  denyExtensions: string[];
  defaultRiskPolicy: Record<string, string>;
}

// Global active adapters map
const activeAdapters = new Map<string, McpWorkspaceAdapter>();

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
      logAudit('adapter error', { workspaceId: this.workspaceId, path: this.workspacePath, error: err });
      throw new Error(err);
    }

    const scriptPath = path.resolve(__dirname, 'mcpWorkspaceServer.ts');
    
    // Spawn server using npx tsx in target workspace root directory
    this.childProcess = spawn('npx', ['tsx', scriptPath], {
      cwd: this.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    logAudit('adapter start', { workspaceId: this.workspaceId, path: this.workspacePath });

    this.childProcess.stderr?.on('data', (data) => {
      // Forward stderr messages to portal backend logs (useful for debug)
      console.error(`[MCP WORKSPACE SERVER ${this.workspaceId} STDERR]`, data.toString().trim());
    });

    this.childProcess.on('close', (code) => {
      logAudit('adapter stop', { workspaceId: this.workspaceId, exitCode: code });
      this.childProcess = null;
      this.pendingRequests.forEach(req => req.reject(new Error('MCP server process exited')));
      this.pendingRequests.clear();
      activeAdapters.delete(this.workspaceId);
    });

    this.childProcess.on('error', (err) => {
      logAudit('adapter error', { workspaceId: this.workspaceId, error: err.message });
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
  }

  public stop(): void {
    if (this.childProcess) {
      try {
        const proc = this.childProcess;
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            if (proc.pid && proc.exitCode === null) {
              proc.kill('SIGKILL');
            }
          } catch {}
        }, 1000);
      } catch {}
      this.childProcess = null;
    }
  }

  // Authoritative host policy validation check
  private validateAccessPolicy(toolName: string, args: any): void {
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
        logAudit('file read denied', { workspaceId: this.workspaceId, path: relPath, reason: 'Denied file extension/name' });
        throw new Error(`Access Denied: Reading or scanning of file '${relPath}' is forbidden by host policy rules.`);
      }

      // 2. Check for denied directories / traversal
      const normalized = path.normalize(relPath);
      if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        logAudit('file read denied', { workspaceId: this.workspaceId, path: relPath, reason: 'Directory traversal attempt' });
        throw new Error(`Access Denied: Path '${relPath}' goes outside permitted workspace boundary.`);
      }

      const pathSegments = normalized.split(path.sep);
      const isDeniedPath = policy.denyPaths.some(dp => {
        const cleanPattern = dp.replace(/\*/g, '').replace(/^\/+|\/+$/g, '');
        return pathSegments.some(seg => seg === cleanPattern);
      });

      if (isDeniedPath) {
        logAudit('file read denied', { workspaceId: this.workspaceId, path: relPath, reason: 'Matches denyPaths configuration' });
        throw new Error(`Access Denied: Path '${relPath}' matches denied folders in host security rules.`);
      }
    }
  }

  public async call(toolName: string, args: any): Promise<any> {
    if (!this.childProcess) {
      await this.start();
    }

    // Wrap call with authoritative policy check first
    this.validateAccessPolicy(toolName, args);

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
          logAudit('adapter error', { workspaceId: this.workspaceId, error: `Tool ${toolName} timed out.` });
        }
      }, 5000);

      this.pendingRequests.set(id, {
        resolve: (res) => {
          clearTimeout(timeout);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });

      try {
        this.childProcess!.stdin!.write(JSON.stringify(request) + '\n');
        logAudit('file read allowed', { workspaceId: this.workspaceId, tool: toolName, args });
      } catch (err: any) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        logAudit('adapter error', { workspaceId: this.workspaceId, error: err.message });
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
  const catalogPath = path.resolve(__dirname, 'myai-workspaces.json');
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
