# Current Scope Lock: MyAI Portal (v0.1.0)

This document establishes the authoritative scope boundaries for MyAI Portal v0.1.0. No developer or MCP service is permitted to bypass these locks.

---

## 1. Locked Capabilities (Disabled)

* **Command Execution**: No shell operations, build tools, compiler runs, or test execution paths are reachable.
* **Write Actions**: File writing, patching, deleting, renaming, or modifying files in active workspaces is strictly disabled.
* **Patch Proposal**: The portal only supports inspection of files; proposing code edits or automated patches is blocked.
* **Terminal Panels**: No interactive shell access or terminal terminals are exposed to the UI or client queries.
* **Browser Remote Control**: Web automation devtools (other than read-only viewport checking) are locked down.
* **Remote Telemetry**: All analysis, scanning, and feedback logging run offline and locally. No remote network requests or metrics tracking are present.
* **Public Deployment**: The platform is built as a local developer workbench and has no public deployment target.

---

## 2. Permitted Capabilities (Read-Only)

* **Directory Reading**: Reading explorer directories and listing workspace files.
* **File Telemetry**: Parsing TS/TSX/Py components statically via regex scanners.
* **Path Traversal checks**: Verifying folder path boundaries against the policy engine in `myai-policy.json`.
* **Local Auditing**: Writing allowed and denied queries locally to `audit.log`.
