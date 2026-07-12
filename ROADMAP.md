# Release Roadmap: MyAI Portal

This document outlines the productized evolution plan for **MyAI Portal** beyond the frozen v0.1.0 read-only checkpoint.

---

## 🚀 Phase 1: V1.1 Capability Manifest & Dynamic Telemetry
Introduce dynamic workspace classification using manifests.

### 1. `myai-manifest.json` Support
Connected repos declare their specific resources, tools, and UI presentation layout hints in a local root file.

### 2. UI Layout Engine Extensions
* The Portal UI reads the `"metadata.myaiPortal.ui"` hints inside the manifest to configure panels.
* Supported layout overrides:
  - `split-view`
  - `log-stream`
  - `form`
  - `dashboard`

### 3. Tool & Resource Registry Inspector
* A structured metadata page showing all active workspace tools, descriptions, schema constraints, and access logs.

---

## 🛡️ Phase 2: V2 Proposed Changes & Verification Loop (Proposal Mode)
Shift from passive read-only exploration to active change proposal without direct system writes.

### 1. `propose-change` Protocol
* The AI agent is allowed to query writing tools that suggest patches or unified diff edits.
* Direct filesystem write is blocked; edits are held in memory.

### 2. Side-by-Side Unified Diff View
* Displays proposed changes in a clear, highlight-coded visual diff interface in the center Canvas.
* Prominently labels deleted lines in red and inserted lines in green.

### 3. Explicit Operator Approval Gate
* Any execution requires manual confirmation by clicking "Approve execution" or "Reject".
* Approved updates write changes to files via local adapters.
* Logs decision metadata to the append-only audit trail.

---

## 🔌 Phase 3: V3 SDK Connectors & Dynamic Autodiscovery (V3)
* **JS Adapter SDK**: Standardize a script tag integration wrapper for web apps.
* **Autodiscovery Daemon**: Watch roots and dynamically list workspace folders in the navigator switch board.
