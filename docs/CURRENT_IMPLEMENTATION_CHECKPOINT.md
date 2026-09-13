# PaneTera Current Implementation Checkpoint

**Status:** CURRENT DEVELOPMENT BASELINE. NOT A GA RELEASE.
**Baseline:** `dev` at `7f124335624f7277d7a72ff337e86cfed1ea44b2`
**Date:** 2026-09-12
**Previous checkpoint:** [`docs/checkpoints/2026-07-26-bca10da.md`](checkpoints/2026-07-26-bca10da.md) (HISTORICAL)

This is factual authority. It records what exists at the baseline above and the
evidence for each claim. It does not define product scope or sequencing. What
PaneTera must be is defined in
[`docs/PANETERA_WORKSTATION_CONTRACT.md`](PANETERA_WORKSTATION_CONTRACT.md), and
what happens next in [`ROADMAP.md`](../ROADMAP.md). See
[`docs/DOCUMENTATION_AUTHORITY.md`](DOCUMENTATION_AUTHORITY.md).

## Evidence states

| State | Meaning |
| --- | --- |
| VERIFIED | Code exists and an automated test or E2E journey proves the stated contract. |
| PRESENT, NOT ACCEPTANCE-VERIFIED | Code exists, but no suitable acceptance verification was confirmed for the stated behaviour. |
| IMPLEMENTED, NOT ACCEPTED | Code exists but is intentionally outside the accepted normative product contract. |
| LEGACY SUPPORTED | An existing compatibility path remains operational but is not the architecture for new work. |

VERIFIED is an engineering state. It does not mean a capability has met the
contract's release acceptance conditions, which also require real-Chrome UX and
accessibility acceptance and explicit user approval. This checkpoint claims none
of those conditions as satisfied.

Where the cited tests run:

- `test/` runs under `npm test`, the full suite in the CI job
  `lint · test:core · build`.
- `e2e/` runs under `npm run test:e2e`, the CI job `e2e (playwright)`.
- `chrome-extension/test/` runs under the extension's own `npm run test:unit`.
  Neither the root `npm test` nor CI runs it.

## Baseline verification

| Check | Result | Evidence |
| --- | --- | --- |
| CI on `7f12433` (push to `dev`) | All three jobs succeeded | GitHub Actions run 34694807535 |
| Lint (`eslint`, `tsc`) | 0 errors, 205 warnings | Run 34694807535 |
| Unit and integration suite | 1,352 tests in 308 suites: 1,351 passed, 0 failed, 1 skipped (the older-Node refusal test skips when no Node 20 binary is available) | Run 34694807535 |
| E2E journeys | 13 passed | Run 34694807535, `e2e (playwright)` |
| Production build | 1,187 modules transformed | Run 34694807535 |
| Secret scan | gitleaks passed | Run 34694807535 |

## Workstation

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Workstation shell: persistent conversation, one canvas, contextual drawers | VERIFIED | `src/components/workstation/WorkstationShell.tsx` | `test/workstationShell.test.tsx`, `test/workstationLayout.test.ts`, `test/workstationBreakpoint.test.tsx`; `e2e/workstation.spec.ts` (Rig and Headroom drawers, audit log, project switcher, gateway state) |
| Authoritative canvas (one `main` landmark) | VERIFIED | `WorkstationShell.tsx` (`workstation-canvas`) | `e2e/workstation.spec.ts` ("the single authoritative canvas is present") |
| Work, now, attention, and next brief | VERIFIED | `src/components/workstation/ContextBriefPanel.tsx` | `test/contextBrief.test.ts`. Usability for release condition 4 is not acceptance-verified. |
| Cockpit status bar | VERIFIED | `src/components/workstation/CockpitStatusBar.tsx` | `test/cockpitStatusBar.test.ts` |
| Public web preview: untrusted, refuses credentials and private destinations | VERIFIED | `server/index.ts` (`POST /api/web-preview/probe`) | `test/addressSafety.test.ts`, `test/webPreviewOutcome.test.ts` |

## Rig

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Rig registry: approval-first connection records | VERIFIED | `server/rig/registry.ts`, `server/rig/routes.ts` | `test/rigFoundation.test.ts`, `test/appConnectionRegistry.test.ts`, `e2e/rig.spec.ts` |
| Governed stdio MCP connections | VERIFIED | `server/rig/governedStdio.ts`, `server/rig/transportSecurity.ts` | `test/rigIntegration.test.ts` (governed stdio transport), `test/rigGenericRegression.test.ts` (real stdio MCP server), `e2e/rig.spec.ts` (record, review, and approve an arbitrary stdio server) |
| Streamable HTTP MCP connections: private destinations refused, credentials bound to one origin | VERIFIED | `server/rig/transportSecurity.ts` (`isPrivateAddress`), `server/rig/boundFetch.ts` | `test/rigIntegration.test.ts` ("uses a keychain-backed bearer token directly and strips it after a cross-origin redirect") |
| Capability discovery | VERIFIED | `server/rig/runtime.ts` | `test/rigLifecycle.test.ts`, `test/rigDataPlaneHandlers.test.ts`, `e2e/rig.spec.ts` |
| Capability enablement; external declarations disabled and denied by default | VERIFIED | `server/rig/routes.ts` (`PUT /connections/:connectionId/capabilities/:capabilityId`) | `test/rigFoundation.test.ts` ("defaults every external capability to disabled and denied"), `e2e/rig.spec.ts` (enable the echo tool) |
| Capability invocation | VERIFIED | `server/rig/routes.ts` (`handleInvocation`, `POST /invocations`) | `test/rigDataPlaneHandlers.test.ts`, `test/rigProposalBinding.test.ts`, `e2e/rig.spec.ts` (approve and run; result labelled untrusted) |
| Resource and prompt retrieval | VERIFIED | `server/rig/routes.ts` (`POST /resources/read`, `POST /prompts/get`) | `test/rigIntegration.test.ts`, `test/rigGenericRegression.test.ts`, `test/mcpResourceInspector.test.tsx` |
| Proposal-time validation | VERIFIED | `server/rig/routes.ts` (`handleProposal`), `server/rig/canonical.ts` (`validateProposedArguments`) | `test/rigProposalBinding.test.ts`, `test/rigArgumentValidation.test.ts`, `test/rigGenericRegression.test.ts` |
| Immutable approved argument binding; a proposal is approved once | VERIFIED | `server/rig/approval.ts` | `test/rigProposalBinding.test.ts`, `test/rigPanelProposalReview.test.tsx` |
| Defensive invocation validation of the stored payload | VERIFIED | `server/rig/routes.ts` (`handleInvocation`) | `test/rigProposalBinding.test.ts` ("handleInvocation executes only the approved arguments"), `test/rigGenericRegression.test.ts` |
| Agent-originated Rig proposals validated the same way | VERIFIED | `server/agent/rigCapabilities.ts` | `test/rigGenericRegression.test.ts` (agent proposals) |
| Rig provenance: hash chain and rotation | VERIFIED | `server/rig/provenance.ts` | `test/provenanceChainIntegrity.test.ts`, `test/provenanceRotation.test.ts`, `test/rigProvenance.test.tsx` |
| Connection lifecycle ownership | VERIFIED | `server/rig/runtime.ts` (`connect`, `disconnectAll`), `server/index.ts` (`startPaneTeraServer`) | `test/rigLifecycle.test.ts` |
| Explicit stdio launch identity: executable, arguments, working directory, environment, and content of file arguments | VERIFIED | `server/rig/transportSecurity.ts` (`verifyStdioSpec`) | `test/launchIdentity.test.ts` |
| Launch or source drift returns a connection to review | VERIFIED | `server/rig/runtime.ts`, `server/rig/appConnectionRegistry.ts` | `test/launchIdentity.test.ts`, `test/appConnectionRegistry.test.ts` |
| Managed application declarations: `APP_CONNECTIONS` is empty | VERIFIED | `server/rig/appConnectionRegistry.ts` | `test/appConnectionRegistry.test.ts` ("core PaneTera declares no applications") |
| No Blender or REAPER code or managed declarations in core | VERIFIED | No `blender` or `reaper` reference in `server/`, `src/`, or `chrome-extension/` | Repository search at this baseline |
| HTTP bearer credentials held as macOS Keychain references | PRESENT, NOT ACCEPTANCE-VERIFIED | `server/rig/keychain.ts` (compiled helper) | Reference format and origin binding covered by `test/rigFoundation.test.ts` and `test/rigIntegration.test.ts`; real Keychain storage is not exercised in CI |

Launch identity digests the files named in a connection's arguments, not their
full import graph (ADR-002).

## Headroom and grants

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Durable Headroom capsules: create, edit, resume, delete | VERIFIED | `server/headroom/store.ts`, `server/headroom/routes.ts` | `test/headroom.test.ts` ("Headroom capsules are durable and editable"), `e2e/headroom.spec.ts` |
| Headroom envelopes persist hashes and measurements, not material, with redaction | VERIFIED | `server/headroom/store.ts` | `test/headroom.test.ts` |
| Local selection scopes: expiring and revocable | VERIFIED | `server/headroom/localScopeStore.ts` | `test/headroom.test.ts` |
| Native file and folder grants: 15-minute expiry, digest, revocation, traversal refusal | VERIFIED | `server/native/picker.ts`, `server/native/routes.ts`, `src/components/workstation/NativePickerModal.tsx` | `test/nativePicker.test.tsx`. The operating-system picker journey is not automated. |

## Browser Operator (governed path)

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Governed browser actions: preview, operator approval, then extension claim | VERIFIED | `server/browserActionStore.ts` (approval requires a successful preview), `server/browserGateway.ts` (`/actions/pending`, `/actions/claim`, `/actions/complete`), `server/agent/routes.ts` (`approve-browser`, `reject-browser`) | `test/browserActionStorePersistence.test.ts`, `test/browserAgentJourney.test.ts`, `test/browserGatewayActorAudit.test.ts`. The real Chrome journey is not automated in CI. |
| Browser Operator MCP facade and evidence tools | VERIFIED | `server/mcp/browserOperatorServer.ts`, `server/mcp/browserMcpRoute.ts` | `test/mcpV0.test.ts`, `test/mcpV0OfficialClient.test.ts` |

## Agent runtime and models

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Agent runtime, run store, and queue | VERIFIED | `server/agent/runtime.ts`, `server/agent/runStore.ts`, `server/agent/runQueue.ts` | `test/agentRuntime.test.ts`, `test/agentLoop.test.ts`, `test/agentRunQueue.test.ts`, `test/agentRunStore.test.ts` |
| Model selection and provider routing | PRESENT, NOT ACCEPTANCE-VERIFIED | `server/modelStore.ts`, `server/modelRoutes.ts`, `src/hooks/useModelSelection.ts` | `test/modelFallback.test.ts` and `test/openaiResponsesProvider.test.ts` cover fallback and one provider; live provider calls are not exercised |

## Platform and engineering baseline

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Master-token authentication on protected routes | VERIFIED | `server/index.ts` | `test/authNegativeIntegration.test.ts` |
| Workspace filesystem policy | VERIFIED | `server/mcpAdapter.ts`, `server/workspaceReader.ts`, `server/myai-policy.json` | `test/workspaceReader.test.ts`, `test/staticStructureScan.test.ts`, `test/mcpAdapterAudit.test.ts` |
| Workspace command execution (`POST /api/execute`) disabled outside tests | PRESENT, NOT ACCEPTANCE-VERIFIED | `server/features.ts` (`commandExecution: isTest`), `server/index.ts` | Enforced in code; no test covers the production refusal |
| Node 22 baseline | VERIFIED | `.nvmrc`, `package.json` (`engines`), `scripts/check-node-version.mjs` | `test/nodeVersionPreflight.test.ts` (its older-Node refusal case skips where no Node 20 binary exists, including CI); CI `node-version: '22'` |
| Test and app-data isolation | VERIFIED | `test/support/isolatedAppData.mjs`, `server/appData.ts`, `server/audit.ts`, `server/agent/runHistory.ts` | `test/testIsolation.test.ts` |
| Git worktree and submodule detection | VERIFIED | `server/repoSetup.ts` (`detectGitRepository`) | `test/repoGitDetection.test.ts` |
| CI baseline: lint, full suite, build, SBOM, secret scan, Playwright on PRs and pushes to `dev` and `master` | VERIFIED | `.github/workflows/ci.yml` | Run 34694807535 |

## Implemented but not accepted

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Full Operator (browser extension) | IMPLEMENTED, NOT ACCEPTED (EXPERIMENTAL) | `chrome-extension/operator/` (`mode.js`, `dispatch.js`, `guards.js`), `chrome-extension/messageRouting.js`, `chrome-extension/popup.html` | `chrome-extension/test/operator-mode.test.js`, `operator-dispatch.test.js`, `operator-guards.test.js` passed when run directly on 2026-09-12; not run by root `npm test` or CI |

- The implementation exists on `dev`.
- The default mode is governed. A missing, unknown, or unreadable setting
  resolves to governed (`operator/mode.js`).
- Ungoverned mode requires an explicit, persisted user opt-in in the extension
  popup, which shows a warning.
- When ungoverned, the extension executes navigation, script evaluation, direct
  input, and diagnostic operations without PaneTera approval
  (`operator/dispatch.js`).
- Ungoverned dispatch produces no persistent PaneTera audit or provenance
  record. The extension's audit callback terminates at
  `console.debug('[operator]', event)` (`messageRouting.js`), and the PaneTera
  server has no reference to this lane.
- A thin safety floor (`operator/guards.js`) applies to some page-acting
  operations even when ungoverned, and fails open when a tab URL cannot be
  resolved. It does not make the lane governed.
- Full Operator is therefore EXPERIMENTAL and NOT GOVERNANCE-ACCEPTED. Whether it
  is removed, build-gated, brought under Rig, or connected to PaneTera audit is
  an open security and product decision.

## Legacy supported paths

| Capability | State | Code | Verification |
| --- | --- | --- | --- |
| Soothsayer live-app integration | LEGACY SUPPORTED | `server/liveApp.ts`, `server/workflowIntents.ts`, `server/index.ts` (`SoothsayerWorkbench` routing) | `test/liveAppWorkbench.test.ts`, `test/workflowIntent.test.ts` |

- Soothsayer is implemented and tested as a bespoke, preview-only live-app
  integration: `show soothsayer ui` and `show soothsayer workflows` open its
  workbench in the canvas, using embed URLs signed with a timestamped HMAC whose
  secret stays on the server.
- This path predates Rig. It does not use the Rig registry, approval, lifecycle
  ownership, or launch identity.
- It is not the architectural template for new application integrations. New
  integrations use governed Rig contracts.

## Release history

| Field | Value |
| --- | --- |
| Tag | `v0.9.0-rc1` |
| Tagged | 2026-07-31 |
| Tag target | `80b436fa0ea153a4c928cdeba0938853b1141ece` |
| Standing | HISTORICAL SUPERSEDED RELEASE CANDIDATE |
| GA | No. The annotated tag message says "Not GA". |
| Current development baseline | `7f124335624f7277d7a72ff337e86cfed1ea44b2` |

PaneTera has no GA release. Release acceptance conditions are defined in the
Workstation Contract; this checkpoint does not claim that they are met.

## Known limitations at this baseline

- Ungoverned Full Operator actions have no persistent PaneTera audit.
- Launch identity does not digest a connection's full import graph.
- The Rig review surface approves and runs in one interaction; execution uses
  the stored payload.
- Importing `server/index.ts` initialises module-scope stores against the
  selected app-data location; tests isolate that location.
- Real Chrome, native picker, and Keychain journeys are not automated in CI.
- Open findings are recorded in section 4 of `docs/THREAT_MODEL.md`.

## Keeping this checkpoint valid

A PR that materially changes the shipped capability boundary states
`Checkpoint: updated` or `Checkpoint: still valid` in its description. A new
frozen snapshot is cut under `docs/checkpoints/` at meaningful milestone merges.
See rule 5 in `docs/DOCUMENTATION_AUTHORITY.md`.
