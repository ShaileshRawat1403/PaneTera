// server/repoSetup.ts
//
// Core parser and validator for the guarded repo setup proposal flow.
// This is a secure, preview-only flow. It does not modify portal.yaml.

import path from 'path';
import fs from 'fs/promises';

export interface RepoSetupProposal {
  workspaceName: string;
  path: string;
  exists: boolean;
  insideWorkspaceRoot: boolean;
  gitDetected: boolean;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'cargo' | 'unknown';
  scripts?: string[];
  warnings: string[];
  allowed: boolean;
  previewOnly: true;
}

/**
 * Parses conservative repo setup intents from user queries.
 * Supports a strict allowlist of prefixes/patterns.
 */
export function parseRepoSetupIntent(query: string): { rawTarget: string } | null {
  const q = query.trim();

  // Pattern 1: add my <target> repo
  let match = q.match(/^add\s+my\s+(.+?)\s+repo$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 2: use <target> repo
  match = q.match(/^use\s+(.+?)\s+repo$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 3: track the <target> repo
  match = q.match(/^track\s+the\s+(.+?)\s+repo$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 4: track <target>
  match = q.match(/^track\s+(.+)$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 5: connect <target>
  match = q.match(/^connect\s+(.+)$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 6: make <target> available
  match = q.match(/^make\s+(.+?)\s+available$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 7: add <target> repo
  match = q.match(/^add\s+(.+?)\s+repo$/i);
  if (match) return { rawTarget: match[1] };

  // Pattern 8: add <target>
  match = q.match(/^add\s+(.+)$/i);
  if (match) return { rawTarget: match[1] };

  return null;
}

/**
 * Resolves the raw target and builds the RepoSetupProposal payload.
 * Strictly checks bounds, existence, git metadata, and package files.
 */
export async function resolveRepoSetupTarget(
  rawTarget: string,
  workspaceRoot: string,
): Promise<RepoSetupProposal> {
  // Resolve path
  let resolvedPath = rawTarget;
  if (!path.isAbsolute(rawTarget)) {
    resolvedPath = path.resolve(workspaceRoot, rawTarget);
  } else {
    resolvedPath = path.resolve(rawTarget);
  }

  // Segment-safe bounds check: absPath === root || absPath.startsWith(root + path.sep)
  const absPath = path.resolve(resolvedPath);
  const insideWorkspaceRoot =
    absPath === workspaceRoot || absPath.startsWith(workspaceRoot + path.sep);

  const workspaceName = path.basename(absPath);
  const warnings: string[] = [];

  // 1. Safe bounds check: if outside, block immediately and skip fs read
  if (!insideWorkspaceRoot) {
    warnings.push('Target path is outside the allowed workspace root.');
    return {
      workspaceName,
      path: absPath,
      exists: false,
      insideWorkspaceRoot: false,
      gitDetected: false,
      warnings,
      allowed: false,
      previewOnly: true,
    };
  }

  // 2. Perform shallow filesystem checks (inside root bounds)
  let exists = false;
  let isDir = false;
  try {
    const stat = await fs.stat(absPath);
    exists = true;
    isDir = stat.isDirectory();
  } catch {}

  if (!exists) {
    warnings.push('Target directory does not exist.');
    return {
      workspaceName,
      path: absPath,
      exists: false,
      insideWorkspaceRoot: true,
      gitDetected: false,
      warnings,
      allowed: false,
      previewOnly: true,
    };
  }

  if (!isDir) {
    warnings.push('Target path exists but is not a directory.');
    return {
      workspaceName,
      path: absPath,
      exists: true,
      insideWorkspaceRoot: true,
      gitDetected: false,
      warnings,
      allowed: false,
      previewOnly: true,
    };
  }

  // 3. Inspect directory files (shallow, no recursion)
  let gitDetected = false;
  let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'cargo' | 'unknown' = 'unknown';
  let files: string[] = [];

  try {
    files = await fs.readdir(absPath);
  } catch (e: any) {
    warnings.push(`Failed to read directory entries: ${e.message}`);
  }

  // Check git presence
  if (files.includes('.git')) {
    try {
      const gitStat = await fs.stat(path.join(absPath, '.git'));
      gitDetected = gitStat.isDirectory();
    } catch {}
  }

  if (!gitDetected) {
    warnings.push('No Git repository detected in target workspace.');
  }

  // Determine package manager priority
  const hasPackageJson = files.includes('package.json');
  if (files.includes('pnpm-lock.yaml')) {
    packageManager = 'pnpm';
  } else if (files.includes('yarn.lock')) {
    packageManager = 'yarn';
  } else if (files.includes('bun.lockb')) {
    packageManager = 'bun';
  } else if (files.includes('package-lock.json') || hasPackageJson) {
    packageManager = 'npm';
  } else if (files.includes('Cargo.toml')) {
    packageManager = 'cargo';
  }

  // Scripts extraction from package.json
  let scripts: string[] = [];
  if (hasPackageJson) {
    const pkgPath = path.join(absPath, 'package.json');
    try {
      const stat = await fs.stat(pkgPath);
      if (stat.size > 1024 * 1024) {
        warnings.push('package.json exceeds size limit of 1 MiB, scripts skipped.');
      } else {
        const raw = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        if (pkg && typeof pkg.scripts === 'object' && pkg.scripts !== null) {
          scripts = Object.keys(pkg.scripts);
        }
      }
    } catch (e: any) {
      warnings.push(`Failed to parse package.json: ${e.message}`);
    }
  }

  return {
    workspaceName,
    path: absPath,
    exists: true,
    insideWorkspaceRoot: true,
    gitDetected,
    packageManager,
    scripts: scripts.length > 0 ? scripts : undefined,
    warnings,
    allowed: true,
    previewOnly: true,
  };
}

/**
 * Top-level integration to build a RepoSetupProposal from a query.
 */
export async function buildRepoSetupProposal(
  query: string,
  workspaceRoot: string = process.env.WORKSPACE_ROOT || '/Users/Shailesh/MYAIAGENTS',
): Promise<RepoSetupProposal | null> {
  const intent = parseRepoSetupIntent(query);
  if (!intent) return null;
  return resolveRepoSetupTarget(intent.rawTarget, workspaceRoot);
}
