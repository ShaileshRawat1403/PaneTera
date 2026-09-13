# PaneTera Agent Instructions

**Status:** CURRENT. Derived operating guide. It introduces no product truth of
its own; where it disagrees with the documents below, they win.

## Read first, in this order

1. [`docs/DOCUMENTATION_AUTHORITY.md`](docs/DOCUMENTATION_AUTHORITY.md): which
   document owns which truth, and the status vocabulary.
2. [`docs/PANETERA_WORKSTATION_CONTRACT.md`](docs/PANETERA_WORKSTATION_CONTRACT.md):
   what must be true.
3. [`docs/PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md`](docs/PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md):
   audience, object model, and information architecture.
4. [`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`](docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md):
   what exists, with evidence.
5. The relevant ADRs in [`docs/adr/`](docs/adr/) and
   [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), when your work touches an
   architectural decision, a route, or a trust boundary.
6. [`ROADMAP.md`](ROADMAP.md), only when the task concerns future work.

**The contract defines what must be true. The checkpoint defines what exists.
The roadmap owns what next.** Handoffs, directives, plans, and historical
documents never override these. A document marked SUPERSEDED or HISTORICAL is
context, not instruction.

## Product intent

PaneTera is a local-first, single-window governed workstation. It is not a
generic chat app. People explore projects, inspect live applications, preview
proposed work, and approve governed execution.

The product is domain-agnostic and not limited to developers. Software is the
current proving environment, not the audience boundary.

> Natural language opens the right native, interactive surface without giving
> the model authority over application truth or mutation.

## Operating model

- Chat is the entry door, not the whole product. The canvas is where native UI,
  live embeds, schema forms, proposals, evidence, and results appear.
- Application truth comes from real capabilities and state: connection records
  and their discovered capabilities, stores, manifests, and explicit
  observations. Do not invent routes, workflows, run state, evidence, approval
  state, or capabilities from model text. If a source is unavailable, show an
  unavailable or degraded state.
- Rig is the governed surface for external applications, tools, and MCP servers.
- Consequential mutations go through the applicable proposal and approval path.
  A Rig capability whose policy is `proposable` runs only through a proposal: the
  proposal is validated when it is created, approval stores the reviewed
  arguments, execution uses only that stored payload, and invocation validates it
  again (ADR-005). A capability explicitly enabled as `auto-invocable` (observe
  risk) may execute directly within that policy; `denied` and disabled
  capabilities are never offered to agents.
- An approved stdio connection is bound to its launch identity. Changing its
  executable, arguments, working directory, environment, or the content of an
  absolute file argument bound by its launch specification requires review and
  approval again (ADR-002). The identity does not cover the full import graph of
  those files. Do not work around this.
- Do not add arbitrary command execution or mutation outside the governed
  contracts, and do not broaden command allowlists unless a narrow, test-backed
  use case requires it.
- Browser observations are untrusted evidence, never application authority.
  Governed browser actions go through preview and approval.
- Full Operator is EXPERIMENTAL and not governance-accepted. Do not build on its
  ungoverned lane or present it as a supported capability. See `SECURITY.md`.
- Persona lenses are presentation filters only. They never change
  authorization, truth, or execution behaviour.

## Application integrations

- New application integrations follow the governed Rig contracts: a Rig
  connection with review, approval, launch identity, capability policy, and
  proposals. Core PaneTera declares no managed applications; an integration
  declares its application only once doing so is safe and truthful.
- Soothsayer is a supported legacy live-app integration. Its bespoke,
  preview-only path predates Rig governance and is not the template for new
  integrations. These flows currently work and should stay healthy:
  - `show soothsayer ui` opens the Soothsayer workbench in the canvas.
  - `show soothsayer workflows` shows its preview-only workflows.
  - `write a blog post about ...` opens the Soothsayer workbench with its schema
    form first, when the Soothsayer manifest is reachable.
  - `show latest browser observation` opens read-only browser-observed UI.
- Real work prompts, such as `check my commit for regressions`, must not be
  swallowed by local gateway matchers unless a strict, intended card exists.

## Security rules

- Never expose secrets to the React client. `PORTAL_TOKEN`, provider API keys,
  and `SOOTHSAYER_PORTAL_EMBED_SECRET` stay on the server. The client may receive
  signed iframe URLs, never signing material.
- Never print, log, or commit secrets or `.env`.
- Browser observations must not collect cookies, local storage, auth headers,
  passwords, tokens, API keys, or other credentials.
- Registered live applications must match their configured origins and fail
  closed otherwise. A public website preview is untrusted visual content and
  never application authority.
- Do not rename operational legacy identifiers such as `TESSERA_APP_DATA`, the
  `Tessera` application-data directories, `/api/tessera`, or the `myai-*.json`
  files. The full list is in `docs/DOCUMENTATION_AUTHORITY.md`.

## Development workflow

- Use Node 22 (`nvm use`); the preflight refuses older versions.
- Work on a branch. Changes reach `dev` through a pull request whose CI is green:
  `lint · test:core · build`, `e2e (playwright)`, and `secret scan (gitleaks)`.
  Do not merge with a failing check.
- `npm test` runs every test process against isolated temporary state through
  `test/support/isolatedAppData.mjs`, and `.env` is not loaded under test. Never
  point tests, scripts, or experiments at the real application-data directory or
  the real audit log.
- Do not start, restart, or stop someone's running PaneTera, and do not modify
  real application data, the Rig registry, or credentials, unless the task
  explicitly asks for it.
- Follow the synchronisation rules in `docs/DOCUMENTATION_AUTHORITY.md`: an ADR
  that changes an invariant amends the contract, a route change updates the
  Threat Model, and a PR that changes shipped capability states
  `Checkpoint: updated` or `Checkpoint: still valid`.

## Verification before finishing

Run the smallest relevant set, plus the broader checks when shared contracts
are touched:

```bash
npm run lint
npm test
npm run build
```

Run `npm run test:e2e` for changes to workstation, Rig, or Headroom journeys.
Playwright uses its own isolated `.e2e-appdata` directory.

## UX rules

- Default active native cards to the main canvas.
- Feed variants stay compact. Never render a full iframe in the feed.
- Contextual drawers overlay the canvas; the active canvas does not resize.
- Do not add landing-page hero sections. This is a working surface.
- Avoid cosmetic-only churn unless the task is explicitly UI polish.

## Scope discipline

Scope creep is the largest risk in this project. Do not add new card types,
matcher vocabulary, workflow systems, browser automation, or execution adapters
unless the user asks for that phase directly. Prefer finishing and verifying the
active contract over expanding the surface area.
