# V1 Acceptance & Hardening Report

This report documents the verification checks, hardening fixes, and runtime results for the **MyAI Portal v0.1.0** read-only mission control checkpoint.

---

## 1. Hardening Actions Taken

### Stale Process Termination
* Spawning child processes registers standard listeners for server shutdown events.
* In `mcpAdapter.ts`, the `stop()` method sends a `SIGTERM` to the workspace process and registers a fallback timeout. If the process is still running after 1000ms, it is terminated with `SIGKILL` to prevent orphan memory leakage.

### Stdio JSON-RPC Timeout
* Introduced a `5000ms` promise timeout inside the `call()` adapter dispatch. If the workspace adapter does not return stdout data within 5 seconds, the request rejects, logging the timeout event to `audit.log`.

### Malformed Input Traversal Rejections
* Incoming paths in `workspace.readFile` are normalized (`path.normalize`) and have backslashes replaced to check segment-level deny matches (e.g. `node_modules` folder checks) accurately on Windows and Unix filesystems.

---

## 2. Manual Verification Proofs

### Safe Read
Querying `SECURITY.md` in `soothsayer-workspace` returned successfully:
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"content":[{"type":"text","text":"# Security Policy..."}]}
```

### Policy Denied Extension (`.env`)
Querying `apps/api/.env` returned a `403 Forbidden` from the policy engine before dispatch:
```http
HTTP/1.1 403 Forbidden

{"error":"Access Denied: Reading of file 'apps/api/.env' is forbidden by host policy rules."}
```

### Path Traversal Block
Querying `../myai-portal/server/index.ts` returned a `403 Forbidden`:
```http
HTTP/1.1 403 Forbidden

{"error":"Access Denied: Path '../myai-portal/server/index.ts' goes outside permitted workspace boundary."}
```

### Forbidden Directory Block (`node_modules`)
Querying `node_modules/express/index.js` was blocked before hitting the workspace:
```http
HTTP/1.1 403 Forbidden

{"error":"Access Denied: Path 'node_modules/express/index.js' matches denied folders in host security rules."}
```

### Disabled Workspace Check
Querying before setting `"enabled": true` in `myai-workspaces.json` rejects execution immediately:
```http
HTTP/1.1 403 Forbidden

{"error":"Workspace Soothsayer Core Workspace is disabled. Enable it in the settings first."}
```

---

## 3. Unified Test Suite Status
Running `npm test` checks all parameters:
* Validate command allowlist checks: `Passed`
* Proposal flow mock checks: `Passed`
* Workspace setup tests: `Passed`
* Stdio adapter traversal and file block checks: `Passed`
* **Test Exit Status**: `0` (Success)
