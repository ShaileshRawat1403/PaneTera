# PaneTera Current Implementation Checkpoint

**Checkpoint:** `v0.9.0-alpha-workstation`
**Status:** Verified local alpha baseline
**Date:** 2026-07-20
**Scope:** Workstation, composer foundation, and UI/UX convergence

## What ships

- PaneTera is the only workstation shell; there is no query-string shell fork.
- Conversation remains visible beside one authoritative canvas.
- Project selection, Activity, and Audit open contextually without shrinking
  the canvas.
- The composer supports natural language, `/` commands, transient context
  chips, notes, registered projects/files/folders, and validated public web
  references.
- Attachments do not reach the intent resolver and are not persisted.
- Public website preview rejects credentials, private/loopback destinations,
  unsupported schemes, and carries no PaneTera authority.
- Registered local applications, native project surfaces, proposals, results,
  evidence, and failure states route into the same canvas.
- Approval is explicit and single-fire at the UI boundary; backend policy and
  idempotency remain authoritative.
- The warm graphite design system, contrast rules, reduced motion, landmarks,
  keyboard navigation, and focus return are enforced by tests.

## What does not ship

- Arbitrary external MCP server connections or a general Rig registry.
- MCP discovery, capability enablement, MCP resources, or MCP invocation.
- Durable Headroom capsules, persistent context, token capacity claims, or
  session pinning.
- A complete work/now/attention/next read model.
- Generic capability proposals and provenance records.
- Team, cloud, mobile, marketplace, or unattended-agent operation.

## Verification record

The checkpoint passed:

- `npm run lint`;
- the complete 32-file `npm test` command;
- `npm run build`;
- `git diff --check`;
- integrated Chrome inspection of landmarks, canvas geometry, contextual
  Activity behavior, slash-menu keyboard state, and attachment-menu focus.

The authenticated acceptance journey selected the registered Soothsayer
project, attached `pruningmypothos` as reference context, submitted a
project-aware question, observed the resulting transcript and tool disclosures,
opened Activity without changing canvas width, and opened and closed Audit.

Live Chrome geometry at a 1405×727 content viewport measured approximately
393px conversation and 1012px canvas (72% canvas), with no horizontal overflow.
Opening Activity produced zero canvas-width delta.

The production build reports a non-blocking bundle-size warning at roughly
688kB minified. Code splitting is deferred; it is not represented as a runtime
failure.

## Next phase gate

Do not grow the composer menu with disabled roadmap items. The next product
phase begins only after explicit scope approval. The recommended sequence is:

1. implement the work/now/attention/next read model;
2. add durable Headroom only after its data contract is accepted;
3. begin Rig with read-only connection records and discovery, following
   `RIG_MCP_CONNECTION_ARCHITECTURE.md` and ADR-002;
4. add external invocation only after generic approval and provenance exist.

No future phase may weaken the current truth, authority, web-preview, focus, or
single-canvas boundaries.
