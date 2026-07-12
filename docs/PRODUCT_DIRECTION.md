# Product Architecture: Tessera Workbench

This document details the long-term vision, capabilities, connector layer, and safety model of the **Tessera Workbench** (formerly MyAI Portal).

---

## 1. Product Vision

> **"A local-first AI workbench for understanding, researching, and orchestrating systems through safe, inspectable connectors."**

Rather than being a simple chat over repository files, Tessera Workbench serves as a unified control plane. The natural language chat interface acts as the master orchestrator, but the actual capability execution is delegated to clean, plug-and-play connector layers governed by host-level policy configurations.

---

## 2. Product Name Exploration

The working name has transitioned to **Tessera Workbench**:
* **Tessera**: Refers to the small tile pieces that make up a grand mosaic system (representing local code repositories, web applications, chrome tabs, and databases).
* **Workbench**: The practical surface where developers inspect, research, and test changes safely.

---

## 3. Core Persona Profiles

1. **Software Architect & System Researcher**:
   * *Needs*: Mapping complex dependencies, locating symbol flows, finding hidden routes, reviewing safety boundaries.
   * *Aversion*: Running untrusted node modules or launching local servers just to read code.
2. **Product Manager & Business Analyst (PM / BA)**:
   * *Needs*: Reviewing pipeline status, verifying user stories, understanding feature footprints.
3. **QA Engineer**:
   * *Needs*: Evaluating endpoints, checking API schema contracts, inspecting audit records.

---

## 4. Bounded Four-Layer Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Workbench UI                                             │
│    Inspecting files, previewing, dependency nodes, telemetry│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. Master Chat Orchestrator                                 │
│    Routes intent, translates goals, requests approvals       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. Capability / Connector Layer                             │
│    MCP Servers, Live App Manifests, Chrome Extension, CLIs   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. Policy + Audit Layer                                     │
│    Authoritative host-level policies (audit.log & checks)   │
└──────────────────────────────┘
```

---

## 5. Plug-and-Play Connector Model

Every connected component answers the standard system contract profile:
```yaml
name: soothsayer-core
type: repo
what_can_you_read:
  - src/**/*.ts
  - package.json
what_can_you_show:
  - static-exports
  - imports
what_can_you_do:
  - dry-run-check
what_requires_approval:
  - code-patch
what_is_forbidden:
  - rm-rf
  - curl-external
how_to_check_health:
  - stdio-ping
how_to_audit:
  - host-policy-logs
```

### Supported Connectors Over Time:
* **Local Repositories**: Connected via Sandboxed MCP adapters.
* **Live Applications**: Connected via dynamic `myai-manifest.json` endpoints.
* **Browser Session Context**: Connected via the browser research capture extension.
* **Databases & External APIs**: Bounded schema connectors.

---

## 6. The Role of the Chrome Extension

The browser extension does **not** perform remote browser control or mouse-clicking. Instead, it serves as a **Research Capture + Page Context Bridge**:
1. **Context Sharing**: Pushes current open tab metadata, DOM outline structure, and headings to the local workbench.
2. **Research Snippets**: Clips text selections, documents, and reference citations to a local file queue.
3. **Authenticated Bridge**: Resolves web pages requiring credentials that a backend fetch agent cannot access directly.

---

## 7. Safety & Policy Model

1. **Authoritative Host Control**: Security rules are defined locally on the host (`myai-policy.json`). They are evaluated in the backend runtime before queries reach stdio tools.
2. **Local Logging**: Write access audits, allowed/denied traces, and inspections are saved in an append-only `audit.log` locally.
3. **Zero-Execution Execution**: Static scans extract symbols via regex and do not run code, compile dependencies, or run package managers.

---

## 8. Roadmap & Scope

### Phase 1: Local Sandbox (v0.1.0-alpha) — *Complete*
* Static Structure Scan + Dependency Map.
* Policy blocks check.
* 6-point telemetry status chips.
* Local session telemetry export.

### Phase 2: Chrome Research Bridge (v0.2.0)
* Lightweight chrome clipping extension.
* Context metadata queue.

### Out of Scope (Locked Capabilities):
* Automated live browser control (clicks, typing).
* Remote execution or remote shell terminal.
* Telemetry uploads.
* Direct code writes without multi-party approvals.
