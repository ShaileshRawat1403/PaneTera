# Alpha Test Plan: MyAI Portal V1 Read-Only Mission Control

This plan details the target tests, boundaries, and validation workflows to run during the **MyAI Portal v0.1.0** Alpha testing cycle.

---

## 1. Objectives & Safety Boundaries
* **Read-Only Lock**: Ensure no capabilities exist within the UI or backend query adapter to write files, modify codes, or execute commands.
* **Sandbox Verification**: Vets the effectiveness of host-level policy checks (`myai-policy.json`) mapping relative and absolute file paths before process execution.
* **Telemetry Control**: Zero remote tracking or external telemetry. All testing feedback is strictly packaged and downloaded locally via browser blobs.

---

## 2. Target Test Coverage Area

### A. Workspace Discovery & Lifecycle Switcher
* **Autodiscovery**: Confirm directories matching blacklist filters (e.g. `node_modules`, `.git`, `dist`, `.next`) are excluded from suggested scans.
* **Toggles**: Confirm child processes (stdio mcp adapter) are cleanly spawned upon enabling, and forcefully killed via double signal listener sweeps (`SIGTERM` + `SIGKILL` backup) when toggled off.

### B. Host-Enforced Policy Layer
* **Extension Blocks**: Verify immediate blocks when trying to read `.env`, `.pem`, `.key`, or `.sqlite` files.
* **Directory Blocks**: Verify matches against forbidden segments (`node_modules/`, `.git/`, `dist/`).
* **Path Traversal blocks**: Verify blocks when querying outside the workspace roots.
* **Size Checks**: Confirm reading files larger than 500KB returns size warnings instead of raw loading.

### C. UI Cockpit & Feedback Logger
* **Intelligence Scanner**: Verify technology detection correctly detects stack confidence labels (`detected`, `likely`, `unknown`).
* **Testing Panel**: Ensure task lists check state tracking, note validation, and friction scores generate a clean browser-triggered download of `session-summary.json`.
