# PaneTera v0.9.0-rc1 (proposed release candidate)

**Baseline:** `dev` at `233e875`
**Status:** Release candidate on the P0 blockers. Not a public GA (see Known
limitations). Awaiting explicit approval of the name and tag.

This candidate marks the point where the three P0 release blockers from
`PRODUCTION_READINESS.md` are closed, each verified rather than asserted.

## What closed the release gate

### Runtime state isolation (S2.1)
`portal.yaml` and `server/myai-workspaces.json` no longer live in the tracked
source and no longer dirty the checkout on a run. Effective state moved to the
application-data directory, seeded from committed examples, with a one-time
migration. The migration test is hermetic (temp source and destination via
`TESSERA_LEGACY_DIR` / `TESSERA_APP_DATA`), so it passes in CI, not just on one
machine.

### Route threat model + negative auth tests (S2.2)
`docs/THREAT_MODEL.md` inventories every route across trust layers A/B/C with
principal, auth, mutation authority, and audit event.
`test/authNegativeIntegration.test.ts` boots the real composed app and proves
every protected route refuses missing and wrong credentials, with positive
controls so a blanket-401 cannot pass falsely. Five findings recorded;
FINDING-001 (unauthenticated workbench audit write) is tracked for fix.

### Release-grade E2E + CI (S2.3)
A Playwright suite drives the real app on Chromium and is green (11 tests):
unlock with server-side token verification, the workstation surfaces
(single canvas, Rig, Headroom, audit, project switcher, gateway state), and
degraded-backend behavior (honest unreachable state plus reload recovery). A CI
workflow now gates `lint`, `test:core`, and `build` on every push and PR, with a
separate Playwright job; Node is pinned to 22.

## Also included on this baseline

- Sprint 1 foundation: real `node:test` glob runner (no more fragile `&&`
  chain), ESLint wired with the theme-token and import rules, `as any` removed
  from governance paths, and a triage table with an explicit quarantine for the
  pre-existing failing suites. `test:core` is 1125/1125.
- Operator harness H1 and H2a: one model-agnostic tool loop shared by the Gemini
  and OpenAI paths (fixing three real loop bugs), a stronger agentic system
  prompt, and Rig MCP tools available to the chat operator under risk-based
  gating (observe executes, propose gates).
- Full-operator browser extension (separate deployable): governed capture plus
  an opt-in, live-validated full-operator mode behind a governance toggle with a
  thin safety floor.

## Known limitations (not GA yet)

- P1 hardening outstanding: structured logs with request IDs and a health/
  readiness endpoint, a signed artifact with checksums and an SBOM, and a
  configuration migration path.
- Deferred E2E journeys need test-seeding fixtures: Rig approve-discover-invoke
  against a stub MCP server, and Headroom capsule resume. Native-picker and
  Keychain journeys remain a signed-macOS job by design.
- FINDING-001 should be fixed before GA: `POST /api/workbench/audit` accepts
  unauthenticated writes (spoofable audit).

## To tag (after name approval)

```
git tag -a v0.9.0-rc1 -m "PaneTera v0.9.0-rc1: P0 release blockers closed"
```
