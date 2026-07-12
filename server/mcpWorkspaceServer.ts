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

// --- Static Structure Scan & Dependency Mapping Helpers ---

let cachedPolicy: any = null;
function isPathAllowedByPolicy(relPath: string): boolean {
  try {
    if (!cachedPolicy) {
      const policyPath = path.join(__dirname, 'myai-policy.json');
      if (fs.existsSync(policyPath)) {
        cachedPolicy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
      } else {
        cachedPolicy = { deniedExtensions: [], deniedPaths: [] };
      }
    }

    const cleanPath = path.normalize(relPath).replace(/\\/g, '/');
    const segments = cleanPath.split('/');

    // Check denied extensions
    const ext = path.extname(cleanPath).toLowerCase();
    if (cachedPolicy.deniedExtensions && cachedPolicy.deniedExtensions.includes(ext)) {
      return false;
    }

    // Check denied segments/paths
    if (cachedPolicy.deniedPaths) {
      for (const denied of cachedPolicy.deniedPaths) {
        if (segments.includes(denied) || cleanPath.includes(denied)) {
          return false;
        }
      }
    }
  } catch {}
  return true;
}

function getLanguageName(ext: string): string {
  if (['.ts', '.tsx'].includes(ext)) return 'typescript';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (ext === '.py') return 'python';
  return 'unknown';
}

function parseLocalStructure(filePath: string, fileContent: string) {
  const ext = path.extname(filePath).toLowerCase();
  const imports: any[] = [];
  const exports: any[] = [];
  const functions: any[] = [];
  const classes: any[] = [];
  const warnings: string[] = [];

  const lines = fileContent.split('\n');

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    // JS/TS regexes
    const importRegex = /^\s*import\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]/g;
    const importRawRegex = /^\s*import\s+['"]([^'"]+)['"]/g;
    const requireRegex = /(?:const|let|var)\s+[\w\s{},]+\s*=\s*require\(['"]([^'"]+)['"]\)/g;

    const exportDefaultRegex = /^\s*export\s+default\s+/;
    const exportNamedRegex = /^\s*export\s+(?:const|let|var|function|class)\s+(\w+)/;
    const exportListRegex = /^\s*export\s+\{([^}]+)\}/;

    const funcRegex = /^\s*(export\s+)?function\s+(\w+)/;
    const arrowFuncRegex = /^\s*(export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>/;
    const classRegex = /^\s*(export\s+)?class\s+(\w+)/;

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      let m;

      // Reset regex indices
      importRegex.lastIndex = 0;
      importRawRegex.lastIndex = 0;
      requireRegex.lastIndex = 0;

      if ((m = importRegex.exec(line)) !== null || (m = importRawRegex.exec(line)) !== null || (m = requireRegex.exec(line)) !== null) {
        const source = m[1];
        let kind: 'package' | 'relative' | 'alias' | 'unknown' = 'unknown';
        if (source.startsWith('.')) kind = 'relative';
        else if (source.startsWith('@/')) kind = 'alias';
        else kind = 'package';
        imports.push({ source, kind, line: lineNum });
      }

      if (exportDefaultRegex.test(line)) {
        exports.push({ name: 'default', kind: 'default', line: lineNum });
      }
      const namedMatch = exportNamedRegex.exec(line);
      if (namedMatch) {
        const name = namedMatch[1];
        let kind: 'function' | 'class' | 'constant' | 'unknown' = 'unknown';
        if (line.includes('function')) kind = 'function';
        else if (line.includes('class')) kind = 'class';
        else kind = 'constant';
        exports.push({ name, kind, line: lineNum });
      }
      const listMatch = exportListRegex.exec(line);
      if (listMatch) {
        const names = listMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
        names.forEach(name => {
          if (name) exports.push({ name, kind: 'unknown', line: lineNum });
        });
      }

      const fMatch = funcRegex.exec(line) || arrowFuncRegex.exec(line);
      if (fMatch) {
        functions.push({ name: fMatch[2], line: lineNum, exported: !!fMatch[1] });
      }

      const cMatch = classRegex.exec(line);
      if (cMatch) {
        classes.push({ name: cMatch[2], line: lineNum, exported: !!cMatch[1] });
      }
    });
  } else if (ext === '.py') {
    const importRegex = /^\s*import\s+([\w,.\s]+)/;
    const fromImportRegex = /^\s*from\s+([\w.]+)\s+import/;

    const pyDefRegex = /^\s*def\s+(\w+)/;
    const pyClassRegex = /^\s*class\s+(\w+)/;

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      let m = importRegex.exec(line);
      if (m) {
        const sources = m[1].split(',').map(s => s.trim());
        sources.forEach(source => {
          let kind: 'package' | 'relative' | 'alias' | 'unknown' = 'package';
          if (source.startsWith('.')) kind = 'relative';
          imports.push({ source, kind, line: lineNum });
        });
      }
      m = fromImportRegex.exec(line);
      if (m) {
        const source = m[1];
        let kind: 'package' | 'relative' | 'alias' | 'unknown' = 'package';
        if (source.startsWith('.')) kind = 'relative';
        imports.push({ source, kind, line: lineNum });
      }

      const fMatch = pyDefRegex.exec(line);
      if (fMatch) {
        const name = fMatch[1];
        const exported = !name.startsWith('_');
        functions.push({ name, line: lineNum, exported });
        if (exported) {
          exports.push({ name, kind: 'function', line: lineNum });
        }
      }

      const cMatch = pyClassRegex.exec(line);
      if (cMatch) {
        const name = cMatch[1];
        const exported = !name.startsWith('_');
        classes.push({ name, line: lineNum, exported });
        if (exported) {
          exports.push({ name, kind: 'class', line: lineNum });
        }
      }
    });
  } else {
    warnings.push(`File extension '${ext}' is not supported for structure scanning.`);
  }

  return { filePath, language: getLanguageName(ext), imports, exports, functions, classes, warnings };
}

function resolveImportFile(source: string, currentDir: string, workspaceRoot: string): string | null {
  // Try exact candidate matching
  const candidateBase = path.resolve(currentDir, source);

  // Security bounds check
  if (!candidateBase.startsWith(workspaceRoot)) {
    return null;
  }

  const candidates = [
    candidateBase,
    candidateBase + '.ts',
    candidateBase + '.tsx',
    candidateBase + '.js',
    candidateBase + '.jsx',
    candidateBase + '.mjs',
    candidateBase + '.cjs',
    path.join(candidateBase, 'index.ts'),
    path.join(candidateBase, 'index.tsx'),
    path.join(candidateBase, 'index.js'),
    path.join(candidateBase, 'index.jsx')
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
      return path.relative(workspaceRoot, cand);
    }
  }

  // Python support
  if (source.startsWith('.')) {
    let cleanSource = source;
    let dotsCount = 0;
    while (cleanSource.startsWith('.')) {
      dotsCount++;
      cleanSource = cleanSource.slice(1);
    }
    let pyDir = currentDir;
    for (let i = 1; i < dotsCount; i++) {
      pyDir = path.dirname(pyDir);
    }
    const pyCandidate = path.resolve(pyDir, cleanSource.replace(/\./g, '/'));
    if (pyCandidate.startsWith(workspaceRoot)) {
      const pyFiles = [pyCandidate + '.py', path.join(pyCandidate, '__init__.py')];
      for (const pf of pyFiles) {
        if (fs.existsSync(pf) && !fs.statSync(pf).isDirectory()) {
          return path.relative(workspaceRoot, pf);
        }
      }
    }
  }

  return null;
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
        },
        {
          name: "workspace.analyzeStructure",
          description: "Statically analyze imports, exports, functions, and classes of a single JS/TS/Py file without execution.",
          inputSchema: {
            type: "object",
            required: ["relativePath"],
            properties: {
              relativePath: { type: "string", description: "Relative path of file inside workspace." }
            }
          }
        },
        {
          name: "workspace.mapDependencies",
          description: "Map import dependency routes recursively starting from a workspace file entry point.",
          inputSchema: {
            type: "object",
            required: ["entryPoint"],
            properties: {
              entryPoint: { type: "string", description: "Relative path of the starting file inside workspace." },
              maxDepth: { type: "integer", description: "Traversal recursion depth limit. Hard cap is 3." }
            }
          }
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

      if (toolName === 'workspace.analyzeStructure') {
        const relPath = String(args.relativePath || '').trim();
        if (!relPath) {
          return sendError(id, -32602, "Missing parameter: relativePath");
        }
        const cleanPath = path.normalize(relPath).replace(/\\/g, '/');
        if (cleanPath.startsWith('..') || path.isAbsolute(cleanPath)) {
          return sendError(id, -32602, "Access denied: path traverses outside workspace root");
        }
        const fullPath = path.resolve(workspaceRoot, cleanPath);
        if (!fullPath.startsWith(workspaceRoot)) {
          return sendError(id, -32602, "Access denied: path traverses outside workspace root");
        }
        if (!isPathAllowedByPolicy(cleanPath)) {
          return sendError(id, -32602, "Access blocked: host policy restriction");
        }
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
          return sendError(id, -32602, "File not found or is a directory");
        }
        const stats = fs.statSync(fullPath);
        if (stats.size > 500 * 1024) {
          return sendError(id, -32602, `File is too large to scan (size: ${(stats.size / 1024).toFixed(1)}KB, limit: 500KB)`);
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const result = parseLocalStructure(cleanPath, content);
          return sendResponse(id, {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          });
        } catch (err: any) {
          return sendError(id, -32603, `Failed to analyze file: ${err.message}`);
        }
      }

      if (toolName === 'workspace.mapDependencies') {
        const entryPoint = String(args.entryPoint || '').trim();
        if (!entryPoint) {
          return sendError(id, -32602, "Missing parameter: entryPoint");
        }
        const cleanEntryPoint = path.normalize(entryPoint).replace(/\\/g, '/');
        if (cleanEntryPoint.startsWith('..') || path.isAbsolute(cleanEntryPoint)) {
          return sendError(id, -32602, "Access denied: path traverses outside workspace root");
        }

        const maxDepth = typeof args.maxDepth === 'number' ? Math.min(3, args.maxDepth) : 3;

        const nodes: any[] = [];
        const edges: any[] = [];
        const warnings: string[] = [];

        const visited = new Set<string>();
        const queue: Array<{ relPath: string; depth: number }> = [{ relPath: cleanEntryPoint, depth: 0 }];

        while (queue.length > 0) {
          const current = queue.shift()!;
          const currentPath = current.relPath;
          const currentDepth = current.depth;

          if (visited.has(currentPath)) {
            continue;
          }
          visited.add(currentPath);

          if (nodes.length >= 50) {
            warnings.push("Maximum files limit (50) reached. Traversal stopped early.");
            break;
          }

          // Check policy
          if (!isPathAllowedByPolicy(currentPath)) {
            nodes.push({ path: currentPath, language: 'unknown', status: 'blocked', reason: 'Blocked by host policy' });
            continue;
          }

          // Check if file extension is allowed
          const ext = path.extname(currentPath).toLowerCase();
          const allowedExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'];
          if (ext && !allowedExts.includes(ext)) {
            nodes.push({ path: currentPath, language: 'unknown', status: 'skipped', reason: `File extension '${ext}' is skipped` });
            continue;
          }

          const fullPath = path.resolve(workspaceRoot, currentPath);
          if (!fullPath.startsWith(workspaceRoot)) {
            nodes.push({ path: currentPath, language: 'unknown', status: 'blocked', reason: 'Traversal outside root' });
            continue;
          }

          if (!fs.existsSync(fullPath)) {
            nodes.push({ path: currentPath, language: 'unknown', status: 'missing', reason: 'File does not exist' });
            continue;
          }

          const stats = fs.statSync(fullPath);
          if (stats.size > 500 * 1024) {
            nodes.push({ path: currentPath, language: getLanguageName(ext), status: 'skipped', reason: 'File exceeds 500KB size limit' });
            continue;
          }

          // Read and scan
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const structure = parseLocalStructure(currentPath, content);

            nodes.push({
              path: currentPath,
              language: structure.language,
              status: 'resolved'
            });

            if (currentDepth < maxDepth) {
              const currentDir = path.dirname(fullPath);

              for (const imp of structure.imports) {
                if (imp.kind === 'relative') {
                  const resolvedRel = resolveImportFile(imp.source, currentDir, workspaceRoot);
                  if (resolvedRel) {
                    edges.push({
                      from: currentPath,
                      to: resolvedRel,
                      importSource: imp.source,
                      status: 'resolved'
                    });
                    queue.push({ relPath: resolvedRel, depth: currentDepth + 1 });
                  } else {
                    const missingPath = path.relative(workspaceRoot, path.resolve(currentDir, imp.source));
                    edges.push({
                      from: currentPath,
                      to: missingPath,
                      importSource: imp.source,
                      status: 'missing'
                    });
                    if (!nodes.some(n => n.path === missingPath)) {
                      nodes.push({
                        path: missingPath,
                        language: 'unknown',
                        status: 'missing',
                        reason: 'Import file path not found'
                      });
                    }
                  }
                } else {
                  const targetName = imp.source;
                  if (!nodes.some(n => n.path === targetName)) {
                    nodes.push({
                      path: targetName,
                      language: 'unknown',
                      status: imp.kind === 'alias' ? 'alias' : 'external',
                      reason: imp.kind === 'alias' ? 'Path alias' : 'External module package'
                    });
                  }
                  edges.push({
                    from: currentPath,
                    to: targetName,
                    importSource: imp.source,
                    status: imp.kind === 'alias' ? 'alias' : 'external'
                  });
                }
              }
            } else if (structure.imports.length > 0) {
              warnings.push(`Import scanning skipped for ${currentPath} (exceeded maxDepth of ${maxDepth})`);
            }

          } catch (readErr: any) {
            nodes.push({ path: currentPath, language: getLanguageName(ext), status: 'skipped', reason: `Read failure: ${readErr.message}` });
          }
        }

        return sendResponse(id, {
          content: [{
            type: "text",
            text: JSON.stringify({ entryPoint: cleanEntryPoint, maxDepth, nodes, edges, warnings }, null, 2)
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
