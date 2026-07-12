# System Architecture: MyAI Portal V1

This document explains the architecture, execution pipeline, and process boundaries of **MyAI Portal v0.1.0**.

## System Diagram
```
[Portal UI (Browser)] 
       │ (Fetch API + SSE / Bearer token auth)
       ▼
[Express Backend Server (Port 4000)]
       │
       ├─► [Host Policy Engine (myai-policy.json)] (Authoritative check)
       ├─► [Workspace Catalog (myai-workspaces.json)] (State check)
       ├─► [Append-only Logger (server/audit.log)]
       │
       ▼ (stdio spawn / tsx server/mcpWorkspaceServer.ts)
[Workspace stdio MCP Process] (Bound to selected workspace directory)
```

## Core Architectural Components

### 1. The Portal Host (Express Backend)
Runs locally as a Node.js process. It manages:
* **The Catalog Registry**: Stores registered workspaces, directories, and enabled flags in `myai-workspaces.json`.
* **The Stdio Adapter Manager (`mcpAdapter.ts`)**: Dynamically spawns one MCP server process per enabled workspace. It routes commands, parses JSON-RPC 2.0 lines, and handles error states.
* **Process Exit Hooks**: Cleanly kills all workspace child processes on server shutdown (`SIGINT`/`SIGTERM`) to avoid orphan leaks.

### 2. The Workspace MCP Server (`mcpWorkspaceServer.ts`)
A lightweight, dependency-free script launched in the workspace context. It communicates solely over standard input/output (`stdin`/`stdout`).
* **Stdout Isolation**: Any diagnostic logs inside the server are piped to `stderr` so they do not contaminate the JSON-RPC stream on `stdout`.
* **Read-Only Capability**: Hardcoded to only support five safe query tools. It lacks file-write or shell execution logic.

### 3. Feature Flags Config (`server/features.ts`)
V1 locks down any writing or command execution capabilities using strict Boolean features:
* `proposalMode: false`
* `commandExecution: false`
* `browserObservation: false`
* `dynamicManifests: false`
* `resourceRegistry: false`

If disabled features are hit via public API routes (e.g. `POST /api/execute`), the backend immediately rejects them with a `403 Forbidden` response.
