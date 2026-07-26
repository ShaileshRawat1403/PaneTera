# PaneTera production-readiness assessment

**Assessment date:** 2026-07-26
**Baseline reviewed:** `97d71b6` (`master`)
**Decision:** healthy development baseline; not yet a production release

## What is already strong

- TypeScript checking, the complete automated suite, and the production bundle
  pass from a clean dependency install.
- The server binds to loopback, rejects a missing/default master token, limits
  JSON payloads, and keeps governed Rig and Headroom routes behind the master
  token boundary.
- Workspace access is root-bounded and tests traversal, symlink escape, denied
  files, response limits, approval latching, provenance, and untrusted MCP
  material.
- Browser pairing and MCP browser routes enforce their own authentication
  boundaries before the global portal-token middleware.
- The workstation has explicit accessibility, reduced-motion, contrast, and
  semantic-structure tests.

## Improvements completed in this hardening pass

- PaneTera is now the canonical product name across current user-facing copy,
  documentation, the extension, and orchestrator identity.
- The README describes the current workstation instead of the retired
  read-only portal.
- CI now runs install, type checking, the full test suite, and production build
  for every pull request and push to `master`.
- Node.js `20.19+` is declared and pinned for repeatable local and CI builds.
- Vulnerable development and transitive packages were removed or upgraded;
  `npm install` reports zero known vulnerabilities.
- Developer-specific absolute paths were removed from starter configuration and
  tests. Workspace discovery now uses the explicit `WORKSPACE_ROOT` boundary.
- Canonical `PANETERA_APP_DATA` and `PANETERA_LOCAL_APPS_CONFIG` settings were
  added with compatibility fallbacks for existing installations.
- A committed Chrome profile containing 343 generated files (about 21 MiB) was
  removed and permanently ignored.

## Release blockers

### P0 — isolate mutable runtime state

`portal.yaml` and `server/myai-workspaces.json` are still tracked source files
that runtime endpoints can modify. Move the effective workspace catalog into
the PaneTera application-data directory, seed it from versioned examples, and
migrate existing local installations once. A production run should never dirty
its source checkout.

### P0 — complete threat-model review

Document every route's principal, authentication mechanism, allowed origin,
payload limit, mutation authority, and audit event. Add negative integration
tests proving unauthenticated callers cannot reach each protected route. Pay
special attention to pairing exchange/refresh, audit ingestion, public
workbench metadata, redirects, and token transport in EventSource URLs.

### P0 — release-grade end-to-end journeys

Add browser-level tests for unlock, project registration, project inspection,
Rig approval/discovery/invocation, Headroom resume, native selection failure,
and degraded backend recovery. Run the portable subset in CI; retain a signed
macOS release job for native picker and Keychain journeys.

### P1 — configuration and migration

Version configuration schemas, validate them at startup, provide actionable
errors, and add one migration path for former application-data directories and
environment variables. Remove legacy identifiers only in a separately tested
breaking release.

### P1 — observability and recovery

Add bounded structured logs with request/transaction IDs, health/readiness
endpoints, startup diagnostics, retention controls, and a documented backup and
recovery flow for Headroom, Rig, provenance, and audit records.

### P1 — packaging and release integrity

Choose the supported distribution model, produce a signed macOS artifact,
generate checksums and an SBOM, enable dependency update automation and secret
scanning, document rollback, and publish release notes from an explicitly
approved release-candidate commit.

### P2 — product-quality finish

Complete the visual/accessibility pass at the release viewport set, remove
remaining one-off patch/debug scripts from the product root, consolidate the
duplicated extension scratch tree, and run structured usability sessions
against the primary non-developer and developer journeys.

## Suggested release sequence

1. Runtime-state isolation and route threat-model tests
2. Browser-level acceptance suite and macOS native integration job
3. Configuration migration and operational diagnostics
4. Visual/accessibility acceptance at release viewports
5. Signed release-candidate artifact, security review, and user approval

Do not create a production tag until every P0 item passes from a clean checkout
and the release candidate has been accepted in the running product.
