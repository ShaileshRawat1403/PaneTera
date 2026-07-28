# PaneTera Domain Agnosticism Architecture & Proof

## 1. Executive Summary
PaneTera is designed from the ground up as a **domain-agnostic governed workstation**. Rather than hardcoding custom React code for every vertical (legal, healthcare, IT ops, finance), PaneTera relies on a **Schema-Driven Card System** (`server/schema/` & `src/components/schema/`) and a **Collapsible Evidence Feed Drawer** (`src/components/evidence/`).

This guarantees that external agents, plugins, and MCP servers can register new UI card schemas dynamically at runtime without modifying PaneTera core application code.

---

## 2. The 4 Architecture Invariants

1. **Schema-Driven UI Primitives**: All UI cards resolve to 5 generic layout primitives:
   - `status-board` (Kanban pipelines, stage flows)
   - `metric-group` (KPI dashboards, telemetry indicators)
   - `diff` (Side-by-side comparative views)
   - `proposal-gate` (Governed pre-flight rule checks + human sign-off)
   - `form` (Dynamic schema-validated input forms)

2. **Governed Action Pipeline**: Any action with `requiresApproval: true` routes into PaneTera's `ProposedActionCard` / `UnifiedApprovalCard` idempotency boundary. The LLM or UI never executes mutating operations directly.

3. **Collapsible Evidence Drawer**: Multi-source evidence (logs, metrics, traces, alerts, DOM screenshots) is managed via `EvidencePanel.tsx`, preserving 100% of the primary canvas's vertical height until expanded.

4. **Persona Presentation Lens**: Role lenses (Developer, Operator, Auditor, Executive) filter which schemas and cards are highlighted on the canvas without mutating backend authorization or truth.

---

## 3. IT Ops Domain Verification Proof

The IT Ops domain (`server/domains/itops/`) validates this architecture:
- `itops.deployment-pipeline` $\rightarrow$ Instantiated via `status-board`
- `itops.metrics-dashboard` $\rightarrow$ Instantiated via `metric-group`
- `itops.approval-gate` $\rightarrow$ Instantiated via `proposal-gate`

No custom HTML layout code was required for IT Ops; the core `SchemaCardRenderer` renders all cards dynamically from schema definitions.
