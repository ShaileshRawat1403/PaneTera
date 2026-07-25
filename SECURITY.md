# Security Specification: PaneTera

PaneTera operates on a **zero-trust execution model** regarding the connected workspaces. The workspace process is treated as unprivileged and isolated.

## The Security Wrap Pipeline
All workspace tool calls must travel through this linear pipeline before execution:
```
UI request 
  ➔ Backend Auth Check (Bearer token validation)
  ➔ Workspace State Check (Must be marked enabled in myai-workspaces.json)
  ➔ Host Policy check (myai-policy.json match rules)
  ➔ Adapter JSON-RPC Stdio Dispatch
  ➔ Response Size Validation
  ➔ Audit Log Record
```

## Security Controls

### 1. Authoritative Policy Matching
We match paths against policies locally in `mcpAdapter.ts` *before* the request is sent to the workspace process:
* **Denied Extensions**: Reject files matching `.env`, `.env.local`, `.pem`, `.key`, `.db`, `.sqlite`.
* **Path Traversal Check**: Reject relative paths containing `..` or absolute paths traversing outside the registered workspace root path.
* **Denied Directory Check**: Rejects reading paths that match denied directory segments defined in `myai-policy.json` (such as `node_modules`, `.git`, `.next`, `dist`).

### 2. Workspace Lock Verification
The workspace child process is locked to its `cwd` folder. The standard `workspace.readFile` tool resolves paths strictly relative to the process working directory, checking startsWith validation on the resolved absolute path.

### 3. File Size Guardrails
Reading extremely large files (e.g. log dumps, package locks) could exhaust server memory or degrade UI rendering. 
* File reads larger than **500KB** are rejected immediately with an explicit limit warning.

### 4. Static Scan & Dependency Routing Limits
To ensure that structure scans and dependency routing do not exhaust resources or leak sensitive paths:
* **Host Policy Bound**: All recursive checks are subject to the same `myai-policy.json` checks and traversal guards as standard file reading.
* **Max Depth & Files**: We hard-cap mapping depth at **3** levels and the total number of mapped node files at **50**.
* **Cycle Prevention**: We maintain a visited path tracking set to terminate loop traversals immediately.
* **No Runtime Execution**: The analysis is purely static and regex-driven; no runtime code or workspace code is executed.

### 4. Local-Only Assumption
The portal is designed to run exclusively on the developer's localhost loops. All network ports (Vite 5173, Express 4000) bind strictly to `127.0.0.1` or `localhost`, preventing external network connections.
