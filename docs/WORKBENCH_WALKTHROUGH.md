# MYAI Portal Workbench Walkthrough

**Date**: 2026-07-06  
**Status**: ACTIVE POC (All Verification Scenarios Passed)  
**Environment**: Local Governed Workspace (`/Users/Shailesh/MYAIAGENTS`)  

---

## Walkthrough Scenarios & Verification Results

### 1. Portal starts without Rook configured
- **Result**: **PASS**  
- **Notes**: The portal server starts and functions gracefully. The Rook memory bridge handles the missing debug binary path (`ROOK_BINARY_PATH`) by logging a clean warning and disabling the session memory recall cards UI without throwing fatal uncaught exceptions or interrupting server runtime.

### 2. Workspace list loads from portal.yaml
- **Result**: **PASS**  
- **Notes**: `/api/workspaces` successfully returns the registered workspaces `flowright` and `websiteops-pothos-proof` mapped from the local configuration.

### 3. File browsing works for a registered workspace
- **Result**: **PASS**  
- **Notes**: Querying `/api/files?workspace=flowright` returns the file directory listing, successfully identifying standard files like `package.json`.

### 4. File reading works for a safe file
- **Result**: **PASS**  
- **Notes**: `/api/read?workspace=flowright&path=package.json` reads and returns the JSON file contents cleanly while enforcing size limits (2 MiB) and safe extension boundaries.

### 5. Search works in a workspace
- **Result**: **PASS**  
- **Notes**: `/api/search?workspace=flowright&keyword=dependencies` scans the text content of the workspace files and returns correct line search hits.

### 6. Prompt: "run npm run verify in flowright"
- **Result**: **PASS**  
- **Notes**:
  - Successfully triggers the `ProposedAction` card creation.
  - Card correctly surfaces `isDryRun: true`, `executionMode: "local-shell"`, and `riskLevel: "safe"`.
  - The exact command is matched to `"npm run verify"`.
  - Approving/submitting the action to `/api/execute` streams simulated dry-run logs back. No real shell execution occurs.

### 7. Prompt: "run npm install in flowright"
- **Result**: **PASS**  
- **Notes**:
  - Blocks execution of the non-allowlisted command.
  - Generates a `ProposedAction` card with `allowed: false`. The approval flow is completely blocked and no execute path is available.

### 8. Normal chat still works after dismissing/rejecting a card
- **Result**: **PASS**  
- **Notes**: Sending follow-up queries (e.g. greeting) after dismissing/rejecting command execution proposals returns standard conversational chatbot text successfully.

### 9. Flowright content workflow card remains separate from shell ProposedAction
- **Result**: **PASS**  
- **Notes**: Flowright workflow runs (gated by state machines) are parsed and rendered via structurally distinct `ContentWorkflow` cards, completely separate from the shell-based `ProposedAction` cards.

---

## Build & Test Status

- **Lint (`npm run lint`)**: PASS
- **Build (`npm run build`)**: PASS
- **Tests (`npm test`)**: PASS (All 15 command validation and proposal flow tests are green)
