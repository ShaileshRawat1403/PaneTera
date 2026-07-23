# PaneTera Product Roadmap

This document outlines PaneTera's staged product evolution. The original MyAI
Portal phases below remain as foundation history; new capability families must
follow the canonical product and safety requirements in
`docs/PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md` and must not be presented
as implemented until they pass the current checkpoint's acceptance standard.

## Current convergence tranche

Finish and verify the workstation before widening its capability surface:

1. responsive conversation/canvas behavior;
2. evidence hierarchy and truthful provenance;
3. useful empty-canvas starts;
4. the paired Browser Operator journey in real Chrome;
5. actor-separated audit and expiring, revocable grants.

## Planned PaneTera capability sequence

### Stage A: Command and session controls

Add a capability-backed composer palette. The eligible command set is below;
each command appears only after its real surface and state exist:

- `/goal` — view or update the active Headroom objective;
- `/plan` — open a governed plan and proposal surface;
- `/compact` — distil current work into a bounded, inspectable capsule;
- `/continue` — fork or resume from a capsule with provenance;
- `/context` — inspect explicitly attached context and grants;
- `/rig` — open connections and capabilities;
- `/model` — select an available model under a visible task policy.

Convenience controls must not make hidden authority changes. A future fast
profile may change latency or cost, but never silently weaken approval, evidence,
or verification requirements.

### Stage B: Context continuity

- Make compacted capsules reviewable, editable, and reversible.
- Continue or fork work from an explicit capsule rather than hidden transcript
  state.
- Preserve goals, decisions, assumptions, evidence, unresolved questions,
  freshness, and next actions.
- Keep raw history available as evidence without presenting it as compiled
  memory.

### Stage C: Governed planning and autonomy

- Render proposed steps, required capabilities, expected evidence, and success
  checks before execution.
- Add model and execution profiles with visible cost, latency, and capability
  trade-offs.
- Support bounded autonomy grants only when they name the target, permitted
  actions, expiry, revocation path, and audit actor.
- Keep writes, network mutations, exports, and consequential actions behind the
  applicable policy even when a low-risk profile is active.

### Stage D: Trust spine

Build the durable connection between claims, evidence, decisions, and checks:

1. Define a generic provenance record for source, actor, grant, capture or run,
   transformations, freshness, and parent records.
2. Add a lineage canvas that lets a person navigate from a claim to its
   evidence, capture/run, governing grant, verification, and decision.
3. Add a verification ledger whose entries name the check type, target,
   expected result, observed result, status, verifier, and evidence. A passing
   check supports a bounded assertion; it does not make the whole output true.
4. Add governed export that applies the canonical redaction policy, records the
   evidence used, and emits an audit/provenance receipt without forcing internal
   metadata into the visible artifact when a sidecar is more appropriate.

Actor-separated audit and expiring, revocable grants are prerequisites. The
shared redaction policy must be consolidated before governed export ships.

### Stage E: Bounded runs and reproducibility

- Add enforced ceilings for wall-clock time and tool calls, plus provider-backed
  or clearly estimated token and cost budgets. Do not present estimates as
  exact measurements.
- Gate budget extensions explicitly rather than silently overrunning them.
- Add run comparison/replay using recorded inputs, policies, model/tool
  identities, versions, and environment facts where available.
- Diff inputs, environment, outputs, checks, and evidence between runs.
- Call replay a reproducibility or regression aid, not proof of determinism.
  External state, stochastic sampling, unavailable versions, and time-dependent
  inputs must be disclosed when they prevent faithful reproduction.

### Stage F: Governed local data connectors

Build databases as Rig adapters, not as database logic inside the composer.

1. Define a common connector contract for health, schema discovery, query
   capabilities, grants, provenance, and audit.
2. Add SQLite read-only access through the native file picker with an explicit
   file grant.
3. Add local PostgreSQL through localhost or a Unix socket, preferably using a
   dedicated read-only database role and database/schema scope.
4. Add a database canvas for schema inspection, bounded SQL preview, results,
   truncation, timing, and attaching a selected result as untrusted evidence.
5. Add mutations only as explicit proposals showing SQL, target, expected
   impact, transaction boundary, verification, and rollback where supported.
6. Consider DuckDB, MySQL, approved tunnels, and database MCP servers only after
   the SQLite/PostgreSQL contract is accepted.

Database credentials remain local, never enter prompts or browser storage, and
must be represented by protected references rather than copied into connection
records. Reads require time, row, and byte bounds. Export and all writes remain
auditable actions; broad DDL such as `DROP` and `TRUNCATE` stays disabled until
an explicit later policy is approved.

### Stage G: Policy preview and governed delegation

1. Add policy preview using the same authoritative policy engine that will
   enforce the grant. Show which actions become automatic, proposal-gated, or
   denied, and bind the accepted preview to a policy digest.
2. Add bounded child agents only after actor-separated audit, grant lifecycle,
   budgets, provenance, and verification exist.
3. Give every child a distinct audit actor linked to its initiating human,
   parent run, and parent agent. Never collapse parent and child into one actor.
4. Compute child authority as the intersection of the parent's current grant
   and the narrower delegated scope. A child cannot extend expiry, restore a
   revoked grant, increase a budget, or delegate authority the parent lacks.
5. Make handoffs, budget allocation, evidence, verification, and termination
   inspectable from the parent run.

### Stage H: Domain ecosystem

Extend the accepted connector and surface contracts to documents, design tools,
datasets, external APIs, and other builder domains without turning PaneTera
into a permanent dashboard or generic integration catalogue.

---

## Foundation history

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
