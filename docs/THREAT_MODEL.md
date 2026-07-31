# PaneTera Server Route Threat Model

Canonical threat model for every HTTP route served by `server/index.ts`.
Read this before adding, removing, or re-mounting any route. It is the review
reference for Sprint 2.2 (negative auth integration tests) and the gate for
every future surface.

## 1. Trust boundaries

```
 client (browser UI, Chrome extension, MCP client, operator terminal)
   │   network reachability: server binds 127.0.0.1 only (index.ts:2617)
   ▼
 securityHeaders ──► corsHeaders ──► requestLogger ──► metricsMiddleware
   │
   ├──► express.json({ limit: '2mb' })            (index.ts:64)
   │
   ├──► /api/browser   (browserRouter)            (index.ts:67)
   │         router-level: checkLoopbackBinding (403 non-loopback)
   │         route-level:  requirePortalToken OR requireExtensionToken
   ├──► /mcp/browser    (mcpRouter)               (index.ts:70)
   │         route-level:  validateMcpClient (registry bearer + host + origin)
   ├──► /api/workbench  (workbenchRouter)         (index.ts:73)
   │         route-level:  NONE — open by design (FINDING-001 on /audit)
   │
   └──► [GLOBAL MASTER TOKEN GATE]  (index.ts:75-80)
            authenticatePortalRequest(req, TOKEN, { allowQueryToken: /api/events })
            → 401 on failure; query-token honored ONLY for /api/events
   │
   └──► /api/rig, /api/headroom, /api/native-grants, /api/tessera,
         /api/agent, /api/models, /api/schemas, and every app-level
         /api/* route (index.ts:85-91 and below)
```

Auth primitives:

| Primitive | Where | Semantics |
| --- | --- | --- |
| Global master token | `index.ts:75` | Bearer header (`Authorization: Bearer …`); 401 on missing/mismatch. Query token `?token=` only when `req.path === '/api/events'`. |
| `requirePortalToken` | `browserGateway.ts:90` | Same `authenticatePortalRequest` against `PORTAL_TOKEN`; 401. Used for portal-UI-facing browser routes. |
| `requireExtensionToken` | `browserGateway.ts:70` | In-memory browser-extension session token; 401 if not in `sessions`. |
| `checkLoopbackBinding` | `browserGateway.ts:79` | 403 unless request IP is loopback. Applied to the whole `/api/browser` router. |
| `validateMcpClient` | `mcp/browserMcpAuth.ts:31` | Registry hashed bearer credential; 401 (missing/revoked/invalid/expired), then host 403 (non-loopback), then origin 403 (`chrome-extension://` or remote `http`). |

Payload limit: every route shares `express.json({ limit: '2mb' })`; the MCP
facade additionally re-checks 2 MB and replies 413. Origin control at the
transport level is loopback binding; CORS reflects `ALLOWED_ORIGINS` (or `*`
when unset) for the browser UI and is not an authorization control.

## 2. Route inventory

### Layer A — mounted before the global token gate (own auth)

#### `/api/browser` — all routes under `checkLoopbackBinding`

| Method | Path | Principal | Auth | Mutation authority | Audit |
| --- | --- | --- | --- | --- | --- |
| POST | `/pairing/start` | portal operator | `requirePortalToken` | mints a 2-min pairing code | yes (`browser.pair_requested`) |
| GET | `/pairing/status` | portal operator | `requirePortalToken` | none (read) | — |
| DELETE | `/pairing/pending` | portal operator | `requirePortalToken` | clears active pairing code | yes |
| DELETE | `/pairing/sessions/:sessionId` | portal operator | `requirePortalToken` | revokes a paired session | yes |
| POST | `/pairing/exchange` | browser extension | pairing code (timing-safe compare) + 5-attempt lockout | mints session + refresh tokens | yes (`browser.pair`) |
| POST | `/token/refresh` | browser extension | refresh token + `installationId` match | rotates access token | — |
| GET | `/session` | browser extension | `requireExtensionToken` | none (read) | — |
| DELETE | `/session` | browser extension | `requireExtensionToken` | revokes session | yes |
| POST | `/observations` | browser extension | `requireExtensionToken` | writes observation | yes |
| GET | `/actions/pending` | browser extension | `requireExtensionToken` | none (read) | — |
| POST | `/actions/preview-result` | browser extension | `requireExtensionToken` | records action preview | yes |
| GET | `/actions/claim` | browser extension | `requireExtensionToken` | claims an action | yes |
| POST | `/actions/complete` | browser extension | `requireExtensionToken` | completes an action | yes |
| GET | `/inspections/pending` | browser extension | `requireExtensionToken` | none (read) | — |
| POST | `/inspections/complete` | browser extension | `requireExtensionToken` | writes inspection | yes |
| GET | `/observations/pending` | browser extension | `requireExtensionToken` | none (read) | — |
| POST | `/observations/complete` | browser extension | `requireExtensionToken` | writes observation | yes |
| GET | `/health` | any loopback client | none | none (read) | — |

Note: `/pairing/exchange` and `/token/refresh` are intentionally portal-token
free — the extension has no master token. Their compensating controls are
loopback binding, short-lived codes, the attempt lockout, and the refresh-token
bind to `installationId`.

#### `/mcp/browser`

| Method | Path | Principal | Auth | Mutation authority | Audit |
| --- | --- | --- | --- | --- | --- |
| POST | `/` | registered MCP client | `validateMcpClient` (registry credential + loopback host + origin deny-list) | invokes MCP tools with scoped capabilities | yes (`mcp.*` facade audit) |
| GET | `/` | — | none | 405 (Allow: POST) | — |
| DELETE | `/` | — | none | 405 (Allow: POST) | — |

#### `/api/workbench`

| Method | Path | Principal | Auth | Mutation authority | Audit |
| --- | --- | --- | --- | --- | --- |
| GET | `/apps` | any loopback client | none | none (read) | — |
| GET | `/apps/:appId/status` | any loopback client | none | probes a loopback app (read-only, redirects bounded to loopback) | yes (`workbench.app.probe`) |
| POST | `/audit` | portal operator | `requirePortalToken` | writes audit records | yes (FINDING-001 fixed) |

### Layer B — app-level routes behind the global master token

Payload limit 2 mb on all; audit column shows verified events, otherwise the
requestLogger HTTP line is the only record.

| Method | Path | Mutation authority | Audit |
| --- | --- | --- | --- |
| GET | `/api/events` | opens an SSE stream (query token permitted) | — |
| GET | `/api/health` | none (read) | — |
| POST | `/api/memory/remember` | writes memory via rook bridge (feature-gated) | — |
| GET | `/api/memory/recall` | none (read) | — |
| GET | `/api/workspaces` | none (read) | — |
| POST | `/api/local-selection` | opens native dialog, creates 8h grant | yes (`local_context_selected`) |
| GET | `/api/local-selection/scopes` | none (read) | — |
| POST | `/api/local-selection/scopes/:grantId/revoke` | revokes a grant | yes (`local_context_revoked`) |
| POST | `/api/workspaces/browse` | native folder dialog | — |
| POST | `/api/workspaces/add` | mutates `portal.yaml` + workspace catalog | yes (`workspace.enabled`) |
| GET | `/api/files` | none (read) | — |
| GET | `/api/read` | none (read, allowlisted extensions + size cap) | — |
| GET | `/api/search` | none (read) | — |
| GET | `/api/git/history` | none (read) | — |
| POST | `/api/execute` | **runs allowlisted commands** (feature-gated, dry-run first) | requestLogger |
| POST | `/api/execute/kill` | kills a running process | requestLogger |
| POST | `/api/flowright/runs` | creates a governed run via flowright kernel | requestLogger |
| POST | `/api/flowright/runs/:id/drive` | advances a run | requestLogger |
| GET | `/api/flowright/runs/:id` | none (read) | — |
| POST | `/api/flowright/runs/:id/review` | resolves a human-review gate | requestLogger |
| GET | `/api/flowright/runs/:id/evidence` | none (read) | — |
| GET | `/api/desktop/apps` | none (read, `pgrep`) | — |
| POST | `/api/web-preview/probe` | SSRF-guarded probe of a public URL | — |
| POST | `/api/browser-observation` | writes a read-only browser observation (feature-gated) | requestLogger |
| GET | `/api/myai-workspaces` | none (read) | — |
| POST | `/api/myai-workspaces/register` | registers a workspace | yes |
| POST | `/api/myai-workspaces/toggle` | enables/disables a workspace | yes (`workspace.enabled` / `workspace.disabled`) |
| GET | `/api/myai-workspaces/scan` | scans directories (read) | — |
| POST | `/api/myai-workspaces/query` | queries workspace metadata | — |
| GET | `/api/myai-workspaces/audit` | none (read) | — |
| POST | `/api/orchestrator/chat` | LLM + governed tool orchestration | requestLogger |
| POST | `/api/chat` | LLM Q&A | — |
| POST | `/api/classify-intent` | intent routing (LLM) | — |
| GET | `/api/workflow-suggestions` | none (read) | — |
| GET | `/api/evidence` | none (read) | — |

### Layer C — routers mounted behind the global master token

#### `/api/rig`

| Method | Path | Mutation authority |
| --- | --- | --- |
| GET | `/portal-manifest` | none (read) |
| GET | `/connections` | none (read) |
| POST | `/connections` | creates an MCP connection (process/network) |
| GET | `/connections/:connectionId/review` | none (read) |
| POST | `/connections/:connectionId/approve` | approves a connection |
| POST | `/connections/:connectionId/stop` | stops a connection |
| DELETE | `/connections/:connectionId` | removes a connection |
| POST | `/connections/:connectionId/refresh` | refreshes connection credentials |
| PUT | `/connections/:connectionId/capabilities/:capabilityId` | updates a capability |
| POST | `/proposals` | creates a governed proposal |
| POST | `/proposals/:proposalId/approve` | approves a proposal → execution |
| POST | `/invocations` | invokes a connected tool |
| GET | `/resources` | none (read) |
| POST | `/resources/read` | reads a resource |
| POST | `/prompts/get` | fetches a prompt |
| GET | `/provenance` | none (read) |

All rig routes emit typed audit records. Rig spawns processes and opens
connections, so it must never be mounted with the public routers above it.

#### `/api/headroom`

| Method | Path | Mutation authority |
| --- | --- | --- |
| POST | `/envelopes` | creates an envelope |
| GET | `/envelopes` | none (read) |
| GET | `/envelopes/:envelopeId` | none (read) |
| POST | `/envelopes/:envelopeId/pin` | pins an envelope |
| GET | `/capsules` | none (read) |
| PUT | `/capsules/:capsuleId` | updates a capsule |
| POST | `/capsules` | creates a capsule |
| DELETE | `/capsules/:capsuleId` | deletes a capsule |
| POST | `/capsules/:capsuleId/annotations` | writes an annotation |

#### `/api/native-grants`

| Method | Path | Mutation authority |
| --- | --- | --- |
| POST | `/file` | mints a 15-min file grant |
| POST | `/folder` | mints a 15-min folder grant |
| GET | `/:token` | none (verify) |
| DELETE | `/:token` | revokes a grant |

#### `/api/tessera`

| Method | Path | Mutation authority |
| --- | --- | --- |
| POST | `/sessions` | creates a session |
| GET | `/sessions/:id` | none (read) |
| POST | `/sessions/:id/evidence` | writes evidence |
| POST | `/analysis/synthesize` | runs analysis synthesis |

#### `/api/agent` — `POST /run` additionally under `agentRunLimiter` (10/min)

| Method | Path | Mutation authority |
| --- | --- | --- |
| POST | `/run` | launches a governed agent run |
| GET | `/runs` | none (read) |
| GET | `/run/:runId` | none (read) |
| GET | `/run/:runId/events` | none (read, SSE) |
| POST | `/run/:runId/cancel` | cancels a run |
| POST | `/run/:runId/approve-browser` | approves a browser action |
| POST | `/run/:runId/reject-browser` | rejects a browser action |
| GET | `/queue/status` | none (read) |
| POST | `/queue/config` | reconfigures the run queue |
| GET | `/history` | none (read) |
| GET | `/history/:runId` | none (read) |
| GET | `/history/:runId/replay` | none (read) |
| GET | `/history/stats` | none (read) |
| GET | `/capabilities` | none (read) |
| GET | `/capabilities/stats` | none (read) |
| POST | `/capabilities/:capId/health` | probes a capability |
| GET | `/models/stats` | none (read) |

#### `/api/models`

| Method | Path | Mutation authority |
| --- | --- | --- |
| GET | `/` | none (read) |
| GET | `/active` | none (read) |
| POST | `/active` | switches the active model |

#### `/api/schemas`

| Method | Path | Mutation authority |
| --- | --- | --- |
| GET | `/` | none (read) |
| POST | `/` | creates a schema |
| GET | `/:id` | none (read) |
| PUT | `/:id` | updates a schema |
| DELETE | `/:id` | deletes a schema |
| POST | `/:id/validate` | validates against a schema |

## 3. Special-attention surfaces

- **Pairing exchange/refresh** (`/api/browser/pairing/exchange`,
  `/api/browser/token/refresh`): no portal token by design. Compensating
  controls: loopback-only, short-lived code, timing-safe compare, 5-attempt
  lockout, refresh token bound to `installationId`. Negative tests verify
  validation (400) and rate limit (429) paths, not master-token 401.
- **Audit ingestion** (`POST /api/workbench/audit`): see FINDING-001.
- **Health probes** (`GET /livez`, `GET /readyz`): unauthenticated by design,
  mounted ahead of the token gate for process managers. They expose no sensitive
  data: `/livez` returns `{status:'ok'}`; `/readyz` returns readiness plus a
  boolean `appDataWritable` check and a 503 when not ready. Loopback-bound.
- **Public workbench metadata** (`GET /api/workbench/apps`,
  `GET /api/workbench/apps/:id/status`): open by design — the browser UI has
  no login and must render live-app tabs. Compensating control: loopback
  binding. `status` probes stay bounded to loopback apps.
- **EventSource token transport** (`GET /api/events`): the only route that
  accepts the master token in the query string (`?token=`). This is a
  deliberate exception for `EventSource` (no headers in SSE). It must never
  be widened; query tokens leak into logs and proxies.
- **Redirects**: `GET /api/workbench/apps/:appId/status` follows at most 3
  redirects and only to valid loopback URLs (remote redirects → invalid). The
  `portal-embed` signed iframe path is served by the remote app itself
  (Soothsayer), not by this server; this model covers only PaneTera routes.

## 4. Findings

| ID | Finding | Risk | Recommended fix |
| --- | --- | --- | --- |
| FINDING-001 (FIXED) | `POST /api/workbench/audit` previously accepted unauthenticated audit writes from any loopback client, a spoofable audit ledger. | medium (loopback-only, single-operator POC) | Fixed: `requirePortalToken` now guards the write path and the negative auth test asserts 401. No active caller existed, so the fix broke nothing. |
| FINDING-002 | `apiLimiter` and `strictLimiter` are defined in `middleware/rateLimiter.ts` and `apiLimiter` is imported in `index.ts`, but no global `app.use(apiLimiter)` exists. Only `agentRunLimiter` is mounted (`/api/agent/run`). There is no general request-rate limit. | low (master token already gates Layer B/C) | Decide whether to mount a global limiter behind the token gate, or remove the dead import. |
| FINDING-003 | `GET /api/browser/health` and `POST /api/browser/pairing/exchange` are reachable without any credential (loopback-bound). `health` is harmless; `exchange` is code-gated by design. | low | Documented, not a defect. Revisit if the server ever binds beyond loopback. |
| FINDING-004 | `GET /api/events` accepts the master token in the query string. Token-in-URL risks are accepted for SSE; revisit if an SSE-with-headers transport becomes available. | low | Keep the exception scoped to exactly this one path. |
| FINDING-005 | `express.json` parses bodies (up to 2 mb) before the global token gate, so unauthenticated callers can cost a bounded body parse. | low | Optionally move the JSON parser behind the token gate; note the browser/MCP routers need it earlier. |

## 5. Reserved routes — operator drive-path (Phase 2)

The operator drive-path extension queue must enter this model as a first-class
protected route from the start. Reserved slot:

| Method | Path | Principal | Auth | Mutation authority |
| --- | --- | --- | --- | --- |
| POST | `/api/queue` | operator | global master token (Layer B/C semantics) | enqueues an operator drive-path task |

Any implementation must sit behind the global token gate, never in Layer A,
and must emit typed audit records on enqueue and every drive step.

## 6. Test coverage map

`test/authNegativeIntegration.test.ts` boots the real composed app and asserts:

- Every route in Layers A (own-auth), B, and C refuses a missing credential
  with 401 (exceptions: `/mcp/browser` GET/DELETE → 405, `health` → 200).
- A representative route per layer refuses a wrong credential with 401.
- Query-token is honored on `/api/events` and rejected everywhere else.
- Documented-open surfaces keep their classified behavior, including the
  FINDING-001 audit write, so a fix that moves them into the 401 sweep is
  visible when it lands.

## 7. Verification

```bash
npm run lint
npm run build
npm test            # includes test/authNegativeIntegration.test.ts
```
