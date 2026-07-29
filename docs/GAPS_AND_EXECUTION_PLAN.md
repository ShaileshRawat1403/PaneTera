# PaneTera Gaps and Execution Plan

**Date:** 2026-07-29
**Status:** Review artifact. Not an assignment yet.
**Baseline reviewed:** working tree at `4e5c641` (`master`)
**Roles:** Shailesh executes in small reviewable patches. This document is the
reviewer's standing reference for gaps and gates. Sequencing is deliberately
left open until the register below is accepted.

This plan sits under the canonical product and safety requirements in
`PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md`,
`CURRENT_IMPLEMENTATION_CHECKPOINT.md`, and `PRODUCTION_READINESS.md`. It does
not override them. It organises their open items, adds engineering-foundation
gaps found during review, and proposes a bounded sequence with review gates.

---

## 1. Where PaneTera actually stands

PaneTera is a local-first, single-canvas governed AI workstation. The reviewed
tree carries 252 TypeScript source files and 140 test files across the
workstation shell, governed Rig/MCP connections, Headroom capsules, the Browser
Operator pipeline, an agent runtime, and model selection.

The product's own documents are honest that this is a development baseline, not
a release. That honesty is the strongest asset here and the correct lens for
every gap below.

The core tension is one sentence. PaneTera has built a wide governance surface
but not yet a release spine. `ROADMAP.md` already describes Stages A through H,
a large forward surface, while the current convergence tranche and the P0
blockers written in `PRODUCTION_READINESS.md` remain open. The primary risk to
the product is capability sprawl outrunning convergence.

Guiding principle for this plan: converge and earn one honest release candidate
before opening Stage A. Models generate. Systems govern. Right now the system
has governance surface without a release spine.

---

## 2. Gap register

Each entry names the gap, the evidence, and why it matters. Severity uses the
project's existing P0/P1/P2 language where it maps to `PRODUCTION_READINESS.md`.

### Tier 1. Release blockers (P0, already owned by the project)

**1.1 Mutable runtime state tracked in source.**
`portal.yaml` and `server/myai-workspaces.json` are tracked files that runtime
endpoints can modify, so a normal run dirties its own checkout. Move the
effective catalog into the PaneTera application-data directory, seed from
versioned examples, and migrate existing installs once.

**1.2 Threat-model review incomplete.**
No consolidated table naming each route's principal, authentication mechanism,
allowed origin, payload limit, mutation authority, and audit event, and no
negative integration tests proving unauthenticated callers are refused on every
protected route. Pairing exchange/refresh, audit ingestion, public workbench
metadata, redirects, and token transport in EventSource URLs need explicit
coverage.

**1.3 No release-grade end-to-end journeys.**
No browser-level tests for unlock, project registration, project inspection,
Rig approval/discovery/invocation, Headroom resume, native-selection failure,
and degraded-backend recovery. The isolated shell tests passed in the past
while the integrated app carried two `main` landmarks, which is the exact
failure mode a real E2E suite exists to catch.

### Tier 2. Convergence tranche not closed

The five items that Stages A through H are explicitly gated behind, per
`ROADMAP.md`, are still in flight:

1. responsive conversation/canvas behavior;
2. evidence hierarchy and truthful provenance;
3. useful empty-canvas starts;
4. the paired Browser Operator journey in real Chrome;
5. actor-separated audit and expiring, revocable grants.

No Stage A command surface should be presented as available until these land
with recorded evidence.

### Tier 3. Engineering foundation

This tier is the reviewer's strongest flag, because it undermines the product's
own thesis. PaneTera argues that systems govern. The test and type systems do
not yet govern themselves.

**3.1 The test runner does not scale.**
`npm test` is a single hand-maintained chain of over 100 `&&` commands. It
aborts on first failure, has no isolation, no parallelism, and no coverage, and
every added test edits a fragile string. Migrate to a real runner
(`node:test` or Vitest) with coverage and a glob-based file discovery so tests
are additive, not string-edited.

**3.2 Lint is only type-checking.**
`npm run lint` runs `tsc --noEmit`. There is no ESLint enforcing the theme-token
and import rules that recent commits claim to follow. The rules exist only in
reviewer memory, not in CI.

**3.3 Type-safety erosion in trust-critical paths.**
39 `as any` casts and 165 TODO/FIXME/HACK markers across `src`, `server`, and
`shared`. In a provenance product, `as any` at a governance or audit boundary is
a silent hole in the trust spine. Burn these down where they touch audit,
grants, provenance, and approval first.

**3.4 Stray tracked scripts in the product root.**
`fixApp.js`, `patchApp.js`, `test-hono.js`, and the `test-mcp-*.js` set are
tracked debug/patch scripts sitting in the product root. Remove them. Separately,
132 local `tessera-test-*` scratch directories and a duplicated extension tree
are ignored by git but are disk and attention noise worth clearing.

### Tier 4. Operational spine (P1)

**4.1 Observability.** No structured logs with request or transaction IDs, no
health/readiness endpoint, no startup diagnostics, no retention controls.

**4.2 Backup and recovery.** No documented backup and recovery flow for
Headroom, Rig, provenance, and audit records.

**4.3 Configuration lifecycle.** No config-schema versioning, startup
validation with actionable errors, or migration path for former application-data
directories and environment variables.

**4.4 Packaging and release integrity.** No signed macOS artifact, checksums,
SBOM, dependency-update automation, secret scanning, or rollback documentation.

### Tier 5. Missing self-verification

**5.1 The agent runtime does not verify itself.**
Intent classification and provider routing have no eval or acceptance harness.
For a product whose claim is verification, the agent layer verifies everything
except its own behavior. A small golden-set eval over intent classification and
routing would close this and reinforce the product's positioning.

---

## 3. Proposed execution sequence

Five bounded sprints. Each ends at a reviewer gate. Patches stay small and
reviewable, with no bulk regex rewrites or history-destroying resets, consistent
with the project's standing directive. Sequencing across sprints is not fixed by
this document. The dependency note after each sprint states what it unblocks.

### Sprint 0. Clean baseline
Remove ten tracked files verified as unreferenced: the nine ad-hoc root scripts
(`fixApp.js`, `patchApp.js`, `test-hono.js`, and the six `test-mcp-*.js` probes)
and one tracked backup, `server/browserGateway.ts.bak`. Add `*.bak` to
`.gitignore`. Clear the 132 empty local `tessera-test-*` scratch directories,
which are already gitignored and touch nothing in git.

Do not delete `chrome-extension/test/`. Review confirmed it holds 14 real
extension test files, not scratch. The "duplicated extension tree" item in
`PRODUCTION_READINESS.md` P2 does not map to any top-level duplicate found in
review; treat it as an investigation item, not a Sprint 0 deletion.

*Gate:* diff is deletions plus one `.gitignore` line only, and `npm run lint`,
`npm test`, and `npm run build` all pass from a clean state.
*Unblocks:* a clean surface to measure every later change against. Fast, low
risk.

### Sprint 1. Foundation
Runner decision (2026-07-29): node:test now, Vitest as a later dedicated sprint.
Review found the tests already use `node:test` + `node:assert` on Node v22, so
the fragile `&&` chain is the only real defect. The built-in runner fixes it
with a near-zero diff and no silent-drop risk. Vitest's watch mode and DOM
matchers are deferred to their own sprint.

Four ordered sub-steps, each a separate reviewable patch with its own gate.
Infra first, code changes only after the runner is trustworthy.

**S1.1 Runner.** Replace the `test` script with
`node --import tsx --test 'test/**/*.test.ts' 'test/**/*.test.tsx'` plus a
`--experimental-test-coverage` variant (wired, not threshold-gated yet). Risk:
`pretest` currently runs audit-migration tests first, implying seeded state; the
built-in runner runs files in parallel, so watch for state races and fall back
to `--test-concurrency=1` if needed.
*Gate:* discovered file count equals the old chain, full suite passes, a planted
failing test does not abort the others, coverage report generates.

*S1.1 outcome (2026-07-29, gate passed):* runner is
`node --import tsx --test --test-concurrency=1 --test-timeout=30000
'test/**/*.test.ts' 'test/**/*.test.tsx'`. Reviewer verified against `d9759d1`:
old chain ran 106 unique files, disk has 127, zero old-chain files dropped
(clean `comm`), so the migration surfaced 21 previously-unrun test files without
losing any. 288 ok, 5 not ok. All 5 failures are in never-run files and are
pre-existing, not regressions:
`mcpV0`, `mcpV0OfficialClient`, `openaiResponsesProvider`, `canvasHeader`,
`transcriptDrawerPolish`. Carry-forward: these 5 must be fixed or explicitly
quarantined with a tracked reference in S1.4 before the suite can become a CI
gate. `--test-concurrency=1` is required because 3 files bind port 4000.

**S1.2 ESLint.** No config exists; `eslint` and the react/hooks plugins are
installed but unused, and `lint` is only `tsc`. Add a flat `eslint.config.js`,
enable the plugins, encode the theme-token and import rules, and change `lint`
to `eslint . && tsc --noEmit`.
*Gate:* `npm run lint` runs both and passes, config committed, a planted
theme-token violation is caught.

**S1.3 `as any` burn-down.** 35 remain (Sprint 0 removed 4 with the `.bak`):
2 in `server/headroom`, 12 in `src`, the rest elsewhere in `server`. Order by
trust-criticality: audit, provenance, grants, headroom, Rig before UI. Real
types or narrowed guards, no behavior change.
*Gate:* zero `as any` in governance/audit paths, total down to target, lint and
suite green, diff is types only.

**S1.4 TODO triage.** ~125 markers (119 server, 6 src). Classify, do not
blanket-fix: each becomes a tracked backlog entry or is deleted. Commit a triage
table.
*Gate:* every remaining TODO has an owner or reference, or is gone.

*Unblocks:* trustworthy test and lint gates. Without this, no later gate can be
vouched for.

### Sprint 2. P0 release blockers
Isolate mutable runtime state into the app-data directory with a one-time
migration. Write the route threat-model table plus negative auth tests. Stand up
release-grade E2E journeys (Playwright) for the primary flows.
*Unblocks:* the release gate in `CURRENT_IMPLEMENTATION_CHECKPOINT.md`.

### Sprint 3. Convergence close
Finish the five convergence-tranche items with recorded evidence, ending on
actor-separated audit and expiring, revocable grants.
*Unblocks:* Stage A of `ROADMAP.md`.

### Sprint 4. Release spine
Add observability (request IDs, health endpoint, backup and recovery), config
migration, signed artifact, and SBOM. Then name a release candidate for explicit
approval.
*Unblocks:* the first honest release candidate. Stage A opens only after this.

---

## 4. Review protocol

The split is executor and reviewer, aligned to the I-7 loop.

- **Intent, Inform, Interpret:** captured in this document.
- **Initiate:** Shailesh opens a sprint with a bounded patch set.
- **Inspect:** reviewer checks each patch against the gate for that sprint. A
  gate passes only with the evidence named in the sprint, not on lint or build
  alone. Passing isolated tests is necessary and insufficient.
- **Intervene:** reviewer returns specific corrections. Scope stays bounded.
- **Iterate:** repeat within the sprint until the gate passes, then advance.

Gate evidence must be real. Do not label a screenshot or record a state that the
artifact does not actually prove. Record actual browser bounding boxes and
real run output, not calculated or assumed values.

---

## 5. Open decisions

1. **Sprint order.** The register is written foundation-first because later
   gates depend on a trustworthy test and lint base. A release-blocker-first or
   convergence-first order is possible if the goal is a demo-able slice sooner.
   This is the next decision to make before work starts.
2. **Test runner choice.** `node:test` (zero new dependency, closer to the
   current `tsx` model) versus Vitest (richer watch, coverage, and DOM testing
   for the `.tsx` suite). A short spike can settle this in Sprint 1.
3. **Release candidate definition.** Which named commit and which primary
   journeys constitute the first RC, so Sprint 4 has a fixed target.

Nothing in this plan may weaken the current truth, authority, web-preview,
focus, or single-canvas boundaries.
