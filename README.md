# MyAI Portal: Read-Only Mission Control (v0.1.0)

MyAI Portal is a local-first, secure, single-window developer control plane designed to govern, inspect, and explore workspaces using the Model Context Protocol (MCP).

Version **0.1.0 (Codename: Read-Only Mission Control)** freezes a safe, read-only local execution environment. It guarantees that the AI agent and the portal interface can explore file structures and query repositories without any capacity to write files, modify codes, or execute shell commands.

## Key Features in V1
* **Separate Governance Contracts**: Segregates workspace states (`myai-workspaces.json`), manifest schemas (`myai-manifest.json`), and host-enforced permissions (`myai-policy.json`).
* **Authoritative Policy Wrapping**: Every file listing or read request is vetted by the host policy engine before hitting workspace processes.
* **Append-Only Audit Trail**: Structured event tracking (allowed/denied operations, lifecycle starts, policy violations) logged to `server/audit.log`.
* **Standardized stdio MCP Adapters**: Spawns isolated subprocesses per enabled workspace root to answer queries safely.
* **Unified UI Canvas**: A clean sidebar browser, file navigator tree, safety blocks overlay, and a live audit log viewer drawer.

## Quick Start
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Configure Environment**:
   Copy `.env.example` to `.env` and replace placeholders. Ensure `PORTAL_TOKEN` is set.
3. **Run Dev Environment**:
   ```bash
   npm run dev
   ```
   * Client: `http://localhost:5173`
   * Backend API Server: `http://127.0.0.1:4000`

## Documentation Index
* [Architecture Guide](ARCHITECTURE.md) - Stdio JSON-RPC design and workspace adapter boundaries.
* [Security Specification](SECURITY.md) - Path filtering, traversal checks, and size boundaries.
* [V1 Acceptance Pass](V1_ACCEPTANCE.md) - Hardening status, validation proofs, and logs.
* [Roadmap Plan](ROADMAP.md) - The path to V1.1 capabilities and V2 proposal loops.
* [3-Minute Demo Walkthrough](docs/demo-v1.md) - Try it out locally.
