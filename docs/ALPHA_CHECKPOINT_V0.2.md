# Alpha Checkpoint v0.2.0: Tessera Workbench

Tessera Workbench is **ready for wider controlled alpha testing**.

This milestone incorporates the natural language orchestrator query loop, local session records, and interface improvements driven by initial alpha test feedback.

---

## 1. Current Capabilities

Tessera Workbench v0.2.0-alpha provides a secure, read-only control plane for local software repository exploration:
* **Workspace Mission Control**: Catalog of local repositories connected via isolated stdio adapters.
* **Orchestrator Chat V0**: Rule-based intent classifier routing natural-language questions to safe tools and printing grounded summaries.
* **Static Structure Scan**: Static syntax symbol extractor identifying exports, local functions, and imports without running code.
* **Dependency Map**: Real-time routing path calculation starting from file entry points. Includes a frontend toggle to filter external modules.
* **Audit & Inspection Trace**: Collapsible trace details showing what tools and files were inspected, alongside policy logs.
* **Local Session Cockpit**: Interactive test panel for scoring friction, writing notes, and exporting session records.

---

## 2. Changes Since v0.1.0

* **Grounded Natural-Language Orchestration**: Replaced generic chat with a strict read-only tool query planner and citation builder.
* **Local-Only Dependencies Filter**: Toggle switch to focus on local workspace files, filtering out third-party packages (like React).
* **Read-only preview lock**: Embedded padlock icon and tooltip to avoid confusion around editing code previews.
* **Indexing Loading Feedback**: Status messages indicating file scan progress.
* **Ollama Guide**: Added instructions for configuring local models for offline summaries.

---

## 3. Test Results Summary

* **Static Scans & Routing**: Passed (handles TS, Python, TSX, cyclic imports, path aliases).
* **Policy Enforcement**: Passed (successfully blocks unauthorized reads on `.env` and records denied events).
* **Orchestrator test suite**: Passed (verifies no-workspace guide card, intent classification, and fallback parser).

---

## 4. Known Limitations & Disabled Risky Features

* **Concise Fallbacks**: Local-first mode summaries are concise by design when not utilizing an external LLM.
* **Experimental Deployed App**: The Live App workbench is experimental and manifest lookup is disabled unless manually exposed.
* **Locked/Disabled Capabilities**:
  * No file write actions or code modifications.
  * No command execution, terminal tools, or compilers.
  * No active browser control or automation.
  * No external cloud telemetry or tracking.

---

## 5. Recommended Tester Profile (Test 3)

We recommend targeting **tech-adjacent profiles** for the next testing loop:
* **Product Managers** (with technical exposure)
* **Business Analysts** (BA)
* **QA Leads** / **QA Engineers**
* **Documentation Leads** / **Solution Consultants**

*Goal*: Validate whether the workbench interface and natural language orchestrator are understandable without deep codebase engineering context.
