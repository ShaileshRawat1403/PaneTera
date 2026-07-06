# MYAI Portal — Product Contract

**Version**: 0.1.0
**Status**: Active POC

---

## Identity

MYAI Portal is a single-door work surface where AI helps explore, prepare,
preview, and request approval for real actions.

It is not an autonomous agent. It is not an execution engine. It is the
interface through which a human operator sees, decides, and approves.

---

## Core Capabilities

### Explore
Browse registered workspaces, list files, read code, search across projects.
All exploration is read-only and requires no approval.

### Preview
Render structured intelligence feed cards: file indices, search results,
code previews, git history, memory recall, workspace telemetry, terminal
output. All preview is passive — it shows, it does not change.

### Propose
When a user's intent implies mutation (run a command, apply a change, create
a file), the portal prepares a **proposed action card** showing:
- Workspace
- Exact command
- Execution mode (`local-shell` | `apple-container` | future adapters)
- Risk level (`safe` | `review` | `dangerous`)
- Reason / context

Nothing runs until the user approves.

### Execute (delegated)
Approved actions are dispatched to an **execution adapter** — a pluggable
backend that validates the command, previews or runs it, and streams output
back to the feed.

The portal itself never calls `exec()` directly on user commands. It routes
through a governed adapter layer.

**Current Phase 1 adapters:**
- `local-shell` — dry-run preview on the host machine (safe allowlist only)
- `apple-container` — dry-run Apple Container command preview (macOS 26+)

**Future adapters:**
- `dax` — delegated governed execution via DAX RAO loop
- `remote` — SSH/cloud execution

---

## Non-Goals

These are things the portal will **never** do:

| Non-Goal | Why |
|---|---|
| Autonomous mutation | Nothing changes without human approval |
| Hidden execution | Every command is visible, proposed, and approved before running |
| Model-owned truth | The model proposes; the system governs; the human decides |
| Own execution engine | Execution is delegated to adapters (dax, containers, shell) |
| Hard dependency on any single agent | Portal works independently; rook, dax, flowright are optional integrations |

---

## Execution Contract

```
intent
  → preview (show what will happen)
  → proposed action card (approval gate)
  → user approves or rejects
  → execution adapter validates and previews/runs the command
  → output streams back to feed
```

### Allowlist (Phase 1)

Only these commands are permitted in the initial POC:

| Command | Risk Level | Allowed Adapters |
|---|---|---|
| `npm test` | safe | local-shell, apple-container |
| `npm run build` | safe | local-shell, apple-container |
| `npm run lint` | safe | local-shell, apple-container |
| `npm run verify` | safe | local-shell, apple-container |
| `git status` | safe | local-shell, apple-container |
| `git log` | safe | local-shell, apple-container |
| `git diff` | safe | local-shell, apple-container |
| `cargo test` | safe | local-shell, apple-container |
| `cargo check` | safe | local-shell, apple-container |
| `cargo build` | review | local-shell, apple-container |

No arbitrary command passthrough. The allowlist is defined in code, not in
config, and must be extended explicitly.

---

## Architecture

```
Chat Input
  → LLM response (or local resolver)
  → Intent classification
  → If read-only: render feed card
  → If mutation:
      → Proposed Action Card (approval gate)
      → User approves
      → Execution Adapter
           ├─ local-shell adapter
           ├─ apple-container adapter
           └─ future: dax adapter, remote adapter
      → Output streams to feed
```

### Adapter Interface

Every adapter implements:

```typescript
interface ExecutionAdapter {
  name: string;
  available(): Promise<boolean>;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
```

Adapters are selected by the portal based on user preference or automatic
fallback. The portal does not decide what runs — it decides where it runs.

---

## Integration Points

Portal can optionally connect to ecosystem members:

| System | Integration | Required? |
|---|---|---|
| rook | MCP MemoryServer via stdio subprocess | No — memory bridge is optional |
| dax | Future execution adapter via `dax serve` or subprocess | No — future phase |
| flowright | Governed workflow bridge for content workflow visibility/actions | No |

No external system is required for the portal to function. It degrades
gracefully when integrations are unavailable.

---

## Security Boundaries

- `PORTAL_TOKEN` — user/operator access to the portal API
- `PORTAL_INGEST_SECRET` — machine-to-machine ingest bridge (future)
- Execution adapter commands are validated against the allowlist before dispatch
- Apple Containers provide VM-level isolation for untrusted commands
- No secrets are passed to execution adapters unless explicitly configured
