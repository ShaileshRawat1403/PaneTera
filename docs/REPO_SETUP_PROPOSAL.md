# Guarded Repo Setup Proposal Flow

**Version**: 0.1.0  
**Status**: Active POC (Preview Only)  

---

## Purpose

The **Guarded Repo Setup Proposal Flow** allows operators to propose adding or tracking new repositories (workspaces) within the portal via natural language queries. 

The system operates strictly under a **preview-only** contract in Phase 1: it parses, resolves, and analyzes workspace properties without mutating the configuration (`portal.yaml`) or running unauthorized shell/installation commands.

---

## Non-Goals

- **No Config Mutation**: The server will not modify `portal.yaml` or append workspaces programmatically in this phase.
- **No Git Checkout / Cloning**: The portal will not fetch, clone, or initialize git repositories.
- **No Dependency Execution**: The portal will not run `npm install`, `cargo build`, or any other installation tasks during proposal verification.
- **No Arbitrary Scanning**: Only shallow directories under `WORKSPACE_ROOT` can be checked. No recursive directory crawls or secret/credential reading is allowed.

---

## Payload Contract

The `RepoSetupProposal` UI component is structured as follows:

```typescript
interface RepoSetupProposal {
  /** The basename folder name of the proposed repository */
  workspaceName: string;
  /** The fully-resolved absolute path to the directory */
  path: string;
  /** True if the path exists on the host filesystem */
  exists: boolean;
  /** True if the target path is strictly inside the WORKSPACE_ROOT boundary */
  insideWorkspaceRoot: boolean;
  /** True if a valid .git folder resides in the directory */
  gitDetected: boolean;
  /** Detected package manager (npm | pnpm | yarn | bun | cargo | unknown) */
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'cargo' | 'unknown';
  /** Preset scripts extracted from package.json if present */
  scripts?: string[];
  /** Validation warnings (e.g. outside root, missing dir, no git) */
  warnings: string[];
  /** True if all safety bounds and filesystem requirements are satisfied */
  allowed: boolean;
  /** Always true for Phase 1 preview limitations */
  previewOnly: true;
}
```

---

## Example Prompts

- `“add my websiteops repo”`
- `“connect /Users/Shailesh/MYAIAGENTS/PaneTera”`
- `“track the flowright repo”`
- `“make websiteops-pothos-proof available”`

---

## Safety & Bounds Rules

1. **Path Traversal Prevention**: Every target path is normalized using `path.resolve` and checked against `WORKSPACE_ROOT`:
   ```typescript
   const absPath = path.resolve(resolvedPath);
   const insideWorkspaceRoot = absPath === root || absPath.startsWith(root + path.sep);
   ```
   If a path fails this segment-aware check, resolution is halted immediately with `allowed: false` without reading the directory.
2. **Secrets Protection**: Files like `.env`, keys, or certificates are ignored.
3. **Sane Limits**: Reading `package.json` enforces a strict 1 MiB size limit before parsing.
