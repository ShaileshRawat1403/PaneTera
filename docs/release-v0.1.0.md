# V1 Release Checkpoint: Read-Only Mission Control (v0.1.0)

* **Version**: 0.1.0
* **Codename**: Read-Only Mission Control
* **Status**: Local-only accepted checkpoint

This checkpoint establishes a safe, read-only control plane wrapper over local developer workspaces. It guarantees that the AI operator has access to inspect repository structures, but zero ability to write changes or run terminal commands.

---

## 1. Accepted Capabilities
1. **Separated Governance Configuration**: Decoupled catalog files (`myai-workspaces.json`), manifest hints (`myai-manifest.json`), and security boundaries (`myai-policy.json`).
2. **Authoritative Host Verification**: The backend acts as a security wrap proxy. The workspace process is treated as untrusted.
3. **Audit Trails**: Structured append-only audit events logged to file.
4. **Clean Explorer UX**: Displays active file lists, reads text documents, and warns on policy blocks.

## 2. Hardening Measures
* Spawns workspace-specific subprocesses using isolated Node stdio connections.
* Added `5000ms` request timeout handling to prevent server lockups on slow subprocesses.
* Enforced double kill checks (`SIGTERM` followed by backup `SIGKILL` timeout) to clean up stale adapters on disable/shutdown.
* Refuses loading files larger than `500KB` to prevent heap exhaustion.

## 3. Security Proof
* **Allowed Safe File Read**: Verified.
* **Blocked `.env` access**: Verified.
* **Blocked path traversals**: Verified.
* **Blocked `node_modules` access**: Verified.
* **Blocked disabled workspaces**: Verified.
* **Audit tracking**: Fired on both allowed and blocked attempts.

## 4. Test Suite Status
All unit tests passed. Total test coverage includes:
* Git intent resolvers
* Proposal structures
* Traversal regex policy boundaries
* Mock tool executions

---

## 5. Limitations & Deferred Scope
The following items are explicitly **deferred** from this checkpoint:
* Writing workspace files or patches.
* Executing arbitrary shell scripts or terminal logs.
* Auto-discovery scanning daemon (suggestions only inside approved folder roots).
* Dynamic layouts or custom safe URLs.
