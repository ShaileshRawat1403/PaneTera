---
title: Tessera Governed MCP Workbench
archetype: explanation
status: draft
owner: Shailesh Rawat
maintainer: Shailesh Rawat
version: 0.1.0
tags:
  - tessera
  - mcp
  - browser-operator
  - governance
  - orchestration
  - local-workspaces
last_reviewed: 2026-07-17
---

# Tessera Governed MCP Workbench

## 1. Product Statement
Tessera is a governed MCP workbench that connects AI reasoning, browser applications, local workspaces and external tools, then turns approved intent into verified action.

## 2. Browser Operator Statement
The Browser Operator is the governed interface and actuator through which MCP-enabled intelligence interacts with the web.

## 3. Component Responsibilities
- **Chrome Extension**: Observes the current page, extracts approved structured evidence, highlights future action targets, executes future approved actions, and returns resulting browser state.
- **Browser Gateway**: Ingests payloads from the extension, performs origin validation, enforces basic constraints, and routes evidence.
- **Browser Operator MCP Façade**: Maps internal capabilities and resources to the standardized Model Context Protocol (MCP) format, enforcing scopes and authenticating external clients.
- **Master Orchestrator**: Plans actions, coordinates multiple tools/agents, handles complex research tasks, and synthesizes final documents.
- **Capability Registry**: Maintains the central definitions, constraints, and handlers for all supported actions and extractions.
- **Policy Engine**: Evaluates whether a requested capability is allowed for a given client, target, and context.
- **Approval Engine**: Manages user-facing consent flows, records approval tokens, and handles timeouts or expirations.
- **Audit System**: Records an immutable, comprehensive log of the entire execution lifecycle (proposals, approvals, executions, verifications).
- **Evidence and Provenance Store**: Persists captures, extractions, and visual evidence, assigning unique identifiers to maintain unbroken provenance traces.
- **Workspace MCP adapters**: Connects Tessera to local filesystems, repositories, and documentation.
- **External MCP connectors**: Proxies capabilities from external services (e.g., GitHub, Vercel) through Tessera's governance layer.
- **LLM provider layer**: Supplies the reasoning capabilities to generate action proposals and interpret evidence.
- **future Desktop Bridge**: Will handle governed actions on local desktop applications outside the browser.

## 4. Trust Boundaries
Tessera explicitly separates execution boundaries to ensure security:
- **Webpage content**: Untrusted. Has no instruction authority.
- **Content-script execution**: Runs in the isolated extension context, but operates on untrusted DOM.
- **Extension service worker**: Trusted to dispatch capabilities, but holds no long-lived user credentials or direct MCP access.
- **Browser gateway**: Trusted boundary that validates incoming data from the extension.
- **MCP façade**: Exposes governed endpoints to clients; never grants direct browser access.
- **Orchestrator**: High-level reasoning; cannot bypass the policy engine.
- **External MCP clients**: Untrusted callers. Must be authenticated and strictly scoped.
- **External MCP servers**: Untrusted data sources. Their tools do not automatically gain browser authority.
- **Local workspace adapters**: Trusted, but bounded by local user permissions.
- **LLM providers**: Untrusted reasoning engines. Output is treated as a proposal only.

## 5. Authority Model
- Page content has **no instruction authority**.
- MCP tool metadata has **no policy authority**.
- LLM output has **proposal authority only**.
- Tessera policy determines allowed capabilities.
- Approval grants **bounded execution authority**.
- Extension executes **only authorised envelopes**.
- Verification determines completion.
- Audit records the complete lifecycle.

## 6. End-to-End Lifecycle
The universal flow for governed capabilities is:
1. Discover capability
2. Validate MCP client
3. Parse request
4. Resolve browser session
5. Evaluate policy
6. Request user gesture or approval where required
7. Dispatch governed capability
8. Receive evidence or action result
9. Verify result
10. Store evidence
11. Emit audit event
12. Return normalised MCP result
