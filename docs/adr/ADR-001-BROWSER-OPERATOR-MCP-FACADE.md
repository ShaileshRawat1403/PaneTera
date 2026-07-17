# ADR-001: Browser Operator MCP Façade

## Title
Browser Operator capabilities are exposed through a governed Tessera MCP façade, not directly from the Chrome extension.

## Context
Tessera aims to expose its browser interaction capabilities to external MCP clients (agents, LLMs, and other orchestrators) while retaining strict governance, policy enforcement, and auditability. The architecture must bridge the gap between external intelligence layers and the local browser environment without introducing direct attack vectors to the browser extension itself.

## Decision
The Chrome extension will **not** host an MCP server. Instead, the Tessera backend will expose a governed Browser Operator MCP façade using the official stable `@modelcontextprotocol/sdk` (v1) running on a dedicated Express endpoint (`POST /mcp/browser`) over Streamable HTTP (stateless).

The extension remains a paired browser execution surface responsible solely for observing the page, extracting structured evidence, and eventually executing approved actions. The Tessera backend acts as the authoritative gateway for MCP transport, client authentication, capability discovery, policy evaluation, approvals, audits, and provenance orchestration.

## Alternatives Considered and Rejected

- **A. Chrome extension directly hosts MCP:** Rejected. Browser extensions are short-lived execution surfaces and should not expose network ports or manage complex external authentication mechanisms directly.
- **B. LLM calls browser extension APIs directly:** Rejected. LLMs must not directly control Chrome; doing so bypasses Tessera's governance, approval, and audit layers.
- **C. Separate browser-automation service with its own policy:** Rejected. Splitting policy away from Tessera's central orchestrator fragments the audit trail and duplicates governance logic.
- **D. Duplicate browser tools inside every agent:** Rejected. This creates duplicate browser logic and forces each agent to independently manage extension communication, which leads to security and maintenance overhead.
- **E. Extension stores external provider API keys:** Rejected. Extensions are inherently untrusted environments for long-lived sensitive credentials.
- **F. External MCP clients receive browser session tokens:** Rejected. External clients must only interface with the MCP façade and never gain direct session access to the extension's internal web socket or API layer.
- **G. Manual JSON-RPC implementation / v2 Beta SDKs:** Rejected. Custom transports or unstable betas increase maintenance overhead and risk protocol non-compliance. We pin the stable SDK v1.
- **H. SSE / Resumability / Long-lived sessions in V0:** Rejected. V0 is explicitly stateless, using JSON-only Streamable HTTP, reducing connection state complexity.

## Consequences
- **Positive:** Policy remains centralized within the Tessera backend. Browser and workspace capabilities share a unified audit trail. External MCP clients remain safely isolated from the underlying browser mechanics.
- **Positive:** Future governed actions will inherently reuse the same rigorous proposal and approval lifecycle already established.
- **Negative/Tradeoff:** Introduces a proxy layer, slightly increasing latency and complexity in the Tessera backend architecture.

## Security Implications
This decision is fundamental to Tessera's security posture. By isolating the Chrome extension behind the backend façade, we prevent malicious MCP clients from bypassing policy or injecting prompt-driven scripts directly into the browser. 

## Migration Implications
Since this is a greenfield integration for MCP clients connecting to the Browser Operator, there is no direct migration path. Current Phase 1 and 2A tools must be carefully wrapped into the new MCP façade.
