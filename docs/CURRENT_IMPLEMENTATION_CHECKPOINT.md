# PaneTera Current Development Baseline

**Commit:** `a4a1664` (development baseline; not a release)
**Status:** In development — not release-ready
**Date:** 2026-07-21
**Scope:** Workstation, native context, governed Rig/MCP, durable Headroom, and UI/UX convergence

No release tag is associated with this baseline. The temporary local tag
`v0.9.0-alpha-workstation` was removed after product review. A clean build and
test run establish an engineering checkpoint; they do not establish that the
product is ready to release.

## What currently works

- PaneTera is the only workstation shell; there is no query-string shell fork.
- Conversation remains visible beside one authoritative canvas.
- Project selection, Activity, and Audit open contextually without shrinking
  the canvas.
- The composer supports natural language, `/` commands, transient context
  chips, notes, registered-project references, and validated public web
  references.
- Attachments do not reach the intent resolver. Native file/folder access is
  represented by explicit, expiring, revocable grants; Headroom stores redacted
  metadata and digests rather than source material.
- File and folder context use the operating system picker and remain distinct
  from durable registered-project selection.
- Rig is visible and supports approval-first local stdio and Streamable HTTP
  MCP connections, bounded discovery, per-capability policy, exact single-use
  tool approval, resource/prompt retrieval, health, provenance, and audit.
- Authenticated Streamable HTTP stores bearer credentials as macOS Keychain
  references, binds them to one validated origin, and removes them when the
  connection is deleted; credential material never enters connection records.
- Enabled MCP resources can be explicitly retrieved into the composer context;
  external declarations remain untrusted and disabled by default.
- Headroom records every submitted intent before work begins, measures exact
  material bytes without inventing token precision, records exclusions and
  freshness, and provides durable editable capsules for resumption.
- `/rig` and `/headroom` open their actual governed surfaces; they are not
  placeholder commands.
- Public website preview rejects credentials, private/loopback destinations,
  unsupported schemes, and carries no PaneTera authority.
- Registered local applications, native project surfaces, proposals, results,
  evidence, and failure states route into the same canvas.
- Approval is explicit and single-fire at the UI boundary; backend policy and
  idempotency remain authoritative.
- The warm graphite design system, contrast rules, reduced motion, landmarks,
## UX Enhancement Initiatives (Completed)

### Initiative C: Richer MCP UI & Schema Cards
- `RichSchemaFormView.tsx`: Expanded field types (boolean, number, select, textarea, code, url, date, file, array)
- `StatusBoardView.tsx`: Interactive verification checkboxes
- `ProposedActionCard.tsx`: Inline diff viewer and evidence links
- `NativeWorkbenchRenderer.tsx`: View prioritization and smart routing

### Initiative D: Browser Evidence Split-Pane Canvas
- `BrowserEvidenceCanvas.tsx`: Split-pane layout (300px list + detail)
- `ExtractionCard.tsx`: Type-specific rendering for extractions
- `BrowserLiveSurface.tsx`: "Capture as evidence" button
- Server: `getRecentExtractions()` method and `browser_list_extractions` tool

### Initiative B: Interactive Canvas Markup Pen
- `CanvasSelectionProvider.tsx`: Selection state management
- `MarkupToolbar.tsx`: Explain/Search/Annotate actions
- `FilePreviewPanel.tsx`: Line-range selection
- `headroom/store.ts`: Annotations array in HeadroomCapsule

### Initiative A: Canvas Start & Surface Polish
- `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`, `SuccessState.tsx`: State component library

## Remaining release-candidate work

- Complete the final visual/accessibility pass across the remaining legacy
  canvas cards and test the primary journeys at the release viewport set.
- Generic capability proposals and provenance records.
- Team, cloud, mobile, marketplace, or unattended-agent operation.

## Verification record

The latest engineering verification passed:

- `npm run lint`;
- the complete 36-file `npm test` command;
- `npm run build`;
- `git diff --check`;
- integrated Chrome inspection of the Rig and Headroom drawers, both transport
  forms, authenticated HTTP lifecycle, backend-interruption recovery, the
  one-line work/now/attention/next guidance, and `/rig` and `/headroom`
  dispatch into their real surfaces.

Automated integration uses real MCP protocol sessions over governed stdio and
Streamable HTTP, and exercises tool, resource, and prompt discovery/use. It
also proves external declarations default to denied, approvals bind exact
arguments and digests, resources require explicit retrieval and provenance,
and Headroom persists hashes/measurements without raw material.

The authenticated MCP acceptance journey recorded a Keychain-backed HTTP
connection, approved and connected it, discovered and enabled tool/resource/
prompt capabilities, performed an exact approved invocation, retrieved a prompt
and resource, inspected provenance, attached that resource to the composer, and
verified that the assistant treated its material as available but untrusted.
The connection and credential were then removed and the same deterministic
connection identifier was successfully recreated, proving lifecycle cleanup.

The Headroom acceptance journey inspected the exact envelope source and byte
accounting, pinned it into a capsule, edited and saved its objective and
decisions, resumed it, deleted it, and cleared the composer context. No
acceptance connection, capsule, or attached context remains; immutable audit
and provenance records are intentionally retained.

Live Chrome geometry at a 1405×727 content viewport measured approximately
393px conversation and 1012px canvas (72% canvas), with no horizontal overflow.
Opening Activity produced zero canvas-width delta.

The production build splits React, UI, general vendor, Rig, and Headroom chunks;
no generated chunk exceeds Vite's warning threshold.

## Release gate

Do not create a release tag until all of the following are true and have been
accepted in the running product:

1. File and folder attachment use distinct native local-system selection and
   explicit, auditable scope grants; project selection remains a durable
   workspace operation.
2. Rig provides governed MCP connection records, discovery, capability review,
   resource attachment, approval, invocation, health, and audit according to
   `RIG_MCP_CONNECTION_ARCHITECTURE.md` and ADR-002.
3. Headroom provides durable bounded context, provenance, freshness, inclusion
   controls, capacity accounting, and session/project resumption without
   fabricated token precision.
4. The work/now/attention/next read model is usable without dashboard clutter.
5. The primary journeys pass automated checks and real Chrome UX/accessibility
   verification, with no known critical or high-severity defects.
6. The user explicitly approves a named release candidate.

Intermediate commits may record reversible engineering progress. They are not
releases and must not be tagged as though they were.

No future phase may weaken the current truth, authority, web-preview, focus, or
single-canvas boundaries.
