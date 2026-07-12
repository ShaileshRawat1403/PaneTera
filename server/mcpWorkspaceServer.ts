// server/mcpWorkspaceServer.ts
// Stdio-based MCP server running per workspace context.
// Strictly read-only file/git inspection.
// All log outputs must go to stderr. stdout is reserved for JSON-RPC.

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Helper to write JSON-RPC messages cleanly
function sendResponse(id: any, result: any) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + '\n');
}

function sendError(id: any, code: number, message: string, data?: any) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } }) + '\n');
}

// Helpers for read-only filesystem scanning
function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'non-git';
  }
}

function getGitStatus(): string {
  try {
    return execSync('git status --porcelain', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim() || 'clean';
  } catch {
    return 'not-git-repo';
  }
}

// Recurse directory safely
interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.turbo', '.cache'
]);

function scanDir(dirPath: string, rootDir: string, currentDepth: number, maxDepth: number): FileInfo[] {
  const results: FileInfo[] = [];
  if (currentDepth > maxDepth) return results;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.mcp-config' && entry.name !== 'myai-manifest.json') {
        continue; // ignore hidden files/directories unless standard manifests
      }
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        results.push({ name: entry.name, path: relativePath, isDirectory: true });
        results.push(...scanDir(fullPath, rootDir, currentDepth + 1, maxDepth));
      } else {
        let size = 0;
        try {
          size = fs.statSync(fullPath).size;
        } catch {}
        results.push({ name: entry.name, path: relativePath, isDirectory: false, size });
      }
    }
  } catch (err: any) {
    console.error(`[MCP SERVER ERROR] Failed to read dir ${dirPath}:`, err.message);
  }
  return results;
}

// Main JSON-RPC Dispatcher
async function handleRequest(req: any) {
  const { method, id, params } = req;

  if (method === 'initialize') {
    return sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: {
        name: "myai-workspace-mcp",
        version: "1.0.0"
      }
    });
  }

  if (method === 'tools/list') {
    return sendResponse(id, {
      tools: [
        {
          name: "workspace.info",
          description: "Retrieve workspace repo name, type, and current branch branch metadata.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "workspace.listFiles",
          description: "List directory files recursively inside the workspace root folder.",
          inputSchema: {
            type: "object",
            properties: {
              maxDepth: { type: "integer", description: "Maximum recursion depth limit. Defaults to 3." }
            }
          }
        },
        {
          name: "workspace.readFile",
          description: "Read complete text contents of a safe workspace file.",
          inputSchema: {
            type: "object",
            required: ["relativePath"],
            properties: {
              relativePath: { type: "string", description: "Relative path of file inside workspace." }
            }
          }
        },
        {
          name: "workspace.searchFiles",
          description: "Scan workspace files for a text pattern or query.",
          inputSchema: {
            type: "object",
            required: ["query"],
            properties: {
              query: { type: "string", description: "Case-insensitive query string to match inside files." }
            }
          }
        },
        {
          name: "workspace.getGitStatus",
          description: "Get active modified or untracked changes status porcelain output.",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    });
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    try {
      const workspaceRoot = process.cwd();

      if (toolName === 'workspace.info') {
        let pkgName = path.basename(workspaceRoot);
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'));
          if (pkg.name) pkgName = pkg.name;
        } catch {}

        return sendResponse(id, {
          content: [{
            type: "text",
            text: JSON.stringify({
              name: pkgName,
              path: workspaceRoot,
              branch: getGitBranch(),
              hasManifest: fs.existsSync(path.join(workspaceRoot, 'myai-manifest.json'))
            }, null, 2)
          }]
        });
      }

      if (toolName === 'workspace.listFiles') {
        const maxDepth = typeof args.maxDepth === 'number' ? args.maxDepth : 3;
        const files = scanDir(workspaceRoot, workspaceRoot, 1, maxDepth);
        return sendResponse(id, {
          content: [{
            type: "text",
            text: JSON.stringify({ files }, null, 2)
          }]
        });
      }

      if (toolName === 'workspace.readFile') {
        const relPath = String(args.relativePath || '').trim();
        if (!relPath) {
          return sendError(id, -32602, "Missing parameter: relativePath");
        }
        // Normalize backslashes (Windows-style) and traversal components
        const cleanPath = path.normalize(relPath).replace(/\\/g, '/');
        if (cleanPath.startsWith('..') || path.isAbsolute(cleanPath)) {
          return sendError(id, -32602, "Access denied: path traverses outside workspace root");
        }

        const fullPath = path.resolve(workspaceRoot, cleanPath);
        if (!fullPath.startsWith(workspaceRoot)) {
          return sendError(id, -32602, "Access denied: path traverses outside workspace root");
        }
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
          return sendError(id, -32602, "File not found or is a directory");
        }

        // Limit maximum file size read to 500KB
        const stats = fs.statSync(fullPath);
        if (stats.size > 500 * 1024) {
          return sendError(id, -32602, `File is too large to read (size: ${(stats.size / 1024).toFixed(1)}KB, limit: 500KB)`);
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          return sendResponse(id, {
            content: [{
              type: "text",
              text: content
            }]
          });
        } catch (readErr: any) {
          return sendError(id, -32603, `Failed to read file: ${readErr.message}`);
        }
      }

      if (toolName === 'workspace.searchFiles') {
        const query = (args.query || '').toLowerCase();
        if (!query) {
          return sendError(id, -32602, "Missing parameter: query");
        }

        // Perform standard text scan over workspace files (shallow check)
        const files = scanDir(workspaceRoot, workspaceRoot, 1, 2); // limit to depth 2 for shallow search
        const matches: Array<{ path: string; lines: string[] }> = [];

        for (const file of files) {
          if (file.isDirectory) continue;
          const fullPath = path.join(workspaceRoot, file.path);
          try {
            // simple check if it's text by checking size and extension
            if (fs.statSync(fullPath).size > 200000) continue; // skip large files
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes(query)) {
              const lines = content.split('\n');
              const matchedLines = lines
                .map((line, idx) => ({ line: line.trim(), num: idx + 1 }))
                .filter(item => item.line.toLowerCase().includes(query))
                .slice(0, 5) // max 5 matches per file
                .map(item => `L${item.num}: ${item.line}`);

              matches.push({ path: file.path, lines: matchedLines });
            }
          } catch {}
        }

        return sendResponse(id, {
          content: [{
            type: "text",
            text: JSON.stringify({ query, matches }, null, 2)
          }]
        });
      }

      if (toolName === 'workspace.getGitStatus') {
        const status = getGitStatus();
        return sendResponse(id, {
          content: [{
            type: "text",
            text: status
          }]
        });
      }

      return sendError(id, -32601, `Tool not found: ${toolName}`);

    } catch (err: any) {
      console.error(`[MCP SERVER ERROR] Failure executing tool ${toolName}:`, err.message);
      return sendError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  // default ignore other methods (e.g. notifications)
}

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    handleRequest(req);
  } catch (err: any) {
    sendError(null, -32700, "Parse error");
  }
});

console.error("[MCP SERVER] Workspace stdio MCP Server started.");
