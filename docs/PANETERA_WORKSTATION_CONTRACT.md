# PaneTera Workstation Contract

**Status:** CANONICAL product, governance, and design contract
**Product:** PaneTera
**Audience:** Any AI-assisted builder, researcher, creator, analyst, operator,
or decision-maker
**Deployment:** Single-user, local-first, desktop-first V1

## Authority and implementation status

This contract states what PaneTera must be. It does not record what any
particular commit implements. Implementation status, its evidence, and the
standing of experimental and legacy capabilities belong to
`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`. Authority between documents is
defined in `docs/DOCUMENTATION_AUTHORITY.md`.

A capability named here is required, governed, prohibited, or outside V1. Its
presence in this contract is never a claim that it exists today.

Choosing a project, choosing a file, and choosing a folder are three different
grants and must not be cosmetic variants of one flow. File and folder selection
use explicit native selection from the local system while preserving least
authority, provenance, and auditability.

## Product promise

PaneTera helps a person resume any project, direct or observe AI work, see the
authoritative result, approve consequential actions, and retain enough context
and evidence to choose the next confident action.

The scarce resource is human attention and retained understanding, not agent
output. PaneTera is not an IDE, developer dashboard, infrastructure monitor, or
generic chatbot with integrations.

## Product model

- **PaneTera** is the product and single workstation.
- **Rig** is the user's connected projects, models, agents, tools,
  applications, MCP capabilities, adapters, and permissions.
- **Headroom** is bounded working context: goals, decisions, evidence,
  assumptions, unresolved questions, freshness, and memory capacity.
- **Canvas** is the one authoritative interactive surface.
- **Activity, Evidence, and Audit** are plain-language contextual surfaces.

Stage, Signal Chain, Soundcheck, and Control Room may guide internal design but
must not become unexplained primary navigation.

## Workstation invariant

> **One dominant surface, one conversation, one next action.**

Only conversation and canvas are permanently visible. Project selection, Rig,
Headroom, Activity, Evidence, Audit, approvals, and detailed health open
contextually and never permanently reduce the canvas.

```text
PaneTera · Project · Objective                 Rig · Evidence · Activity · Audit
──────────────────────────────────────────────────────────────────────────────
Conversation (340–400px)       │ Authoritative Canvas (flexible remainder)
Intent and transcript          │ Web · App · MCP UI · Document · Proposal
Current bounded run            │ Evidence · Diff · Result · Verification
Attention when necessary       │
One recommended next action    │
Composer                       │
```

At workstation widths the canvas receives at least 60% of usable width. At
narrow widths, conversation becomes contextual rather than crushing the canvas.

## Required information architecture

PaneTera must answer progressively, not through six dashboard panels:

1. What am I working on?
2. What is happening now?
3. What needs my attention?
4. What should happen next?
5. What evidence lets me trust this?
6. What changed in my understanding?

The default state answers work and now. Attention interrupts only for an
approval, ambiguity, failure, conflict, stale context, weak evidence, security
boundary, or missing required capability. Evidence and changed understanding
remain contextual.

## Intent contract

Intent resolution is a product capability. It must identify both what the user
wants and what context is missing before choosing a tool or surface.

Canonical intent families:

- converse or explain generally;
- choose, resume, or inspect a project;
- open, reload, close, or externalise a web surface;
- open a registered live application;
- render or inspect an artifact;
- inspect evidence or changed understanding;
- start, observe, or stop a bounded run;
- propose, approve, reject, or verify an action;
- configure or inspect the Rig;
- inspect or refresh Headroom.

An intent may be **ready**, **needs clarification**, **needs context**,
**needs capability**, or **needs approval**. PaneTera must ask the smallest
useful clarification. It must not convert a missing URL into a workspace error,
or a general question into repository inspection.

Deterministic routing owns safety-critical and explicit surface intents. Model
classification may assist ambiguous language, but may never invent authority,
application state, evidence, or capabilities.

## Web-surface contract

PaneTera distinguishes two web surfaces:

1. **Registered live application** — configured origin, known sandbox profile,
   authoritative application integration, and governed capabilities.
2. **User-requested public website preview** — untrusted visual surface with no
   PaneTera authority, credentials, storage, or execution capability.

Public preview rules:

- require an explicit user request and a valid public HTTP(S) URL;
- reject credentials, non-web protocols, localhost, loopback, link-local, and
  private-network targets from this path;
- preserve a public site's own cross-origin identity when required for normal
  rendering, while remaining cross-origin from PaneTera;
- never expose PaneTera tokens, cookies, local storage, headers, or filesystem;
- clearly label the surface as an untrusted web preview;
- provide reload, close, and open-in-browser controls;
- if framing is prohibited or fails, show an honest failure and browser/evidence
  fallback rather than a blank canvas or false success.

Browser observations are evidence and never application authority.

## Governed execution contract

- Consequential actions, including tool invocation through Rig, run only
  through a proposal that a person reviews and explicitly approves. An approval
  authorizes one execution.
- A proposal is validated against the capability's declared input contract when
  it is created. Invalid arguments never reach approval.
- The approved arguments are the reviewed execution payload. Execution uses that
  stored payload; a caller cannot substitute different arguments after approval.
- Invocation validates the stored payload again before execution.
- An approved external process connection is bound to its launch identity: the
  executable, arguments, working directory, environment, and the content of the
  files it runs. Any change to that identity requires review and approval again.
- External capability declarations are untrusted and disabled until a person
  enables them.
- Governed actions produce audit and provenance records attributed to the acting
  principal.
- A capability that can act outside this contract is not part of the accepted
  governed product surface until it is brought under the contract or explicitly
  accepted.

The underlying decisions are recorded in ADR-002 (external MCP transport
security, lifecycle, and launch identity) and ADR-005 (intent and proposal
fidelity).

## V1 capabilities

- Multi-project selection and resumption.
- General conversation plus context-aware intent routing.
- One canvas renderer contract for live web, registered apps, structured MCP
  UI, artifacts, proposals, evidence, diffs, results, and verification.
- Rig inspection and configuration for projects, models, agents, tools, apps,
  capabilities, and permissions.
- Durable, user-editable Headroom capsules with provenance and freshness.
- Human-led, agent-assisted, and agent-running bounded work.
- Conditional attention, one recommended next action, and explicit approvals.
- Evidence, provenance, decisions, verification, and audit.
- Read-only defaults and adapter-mediated governed execution.

Headroom must not show fabricated precision. Until real capacity measurements
exist, use truthful states such as **Current**, **Needs review**, and **Stale**.

## Design language

- Warm graphite surfaces, parchment-white text, restrained violet interaction
  accent, and brass attention colour.
- Green denotes meaningful success, not continuous healthy decoration.
- Humanist typography; monospace only for code, paths, identifiers, and logs.
- Comfortable density based on an 8px spacing system.
- WCAG AA contrast, semantic landmarks, visible focus, keyboard operation, and
  reduced-motion support.
- Contextual drawers overlay the canvas and cause zero underlying width delta.
- No infrastructure lists, permanent feeds, duplicate onboarding, internal
  intent codes, decorative metrics, or unexplained icon-only controls.

## V1 boundaries

V1 is single-user, local-first, desktop-first, adapter-based, and explicitly
governed. Cloud multi-tenancy, team collaboration, mobile authoring, an MCP
marketplace, unattended autonomous swarms, arbitrary shell execution, and
infrastructure monitoring are outside V1.

## Release acceptance conditions

PaneTera must not receive a GA or release designation until every condition
below is satisfied and accepted in the running product. This contract does not
record whether a condition is currently satisfied; the checkpoint does.

1. Project, file, and folder selection are distinct grants. File and folder
   attachment use explicit native local-system selection with least authority,
   expiry, revocation, and audit; project selection remains a durable workspace
   operation.
2. Rig provides governed connection records, discovery, capability review,
   resource attachment, approval, invocation, health, lifecycle ownership, and
   audit, according to `RIG_MCP_CONNECTION_ARCHITECTURE.md`, ADR-002, and
   ADR-005.
3. Headroom provides durable bounded context, provenance, freshness, inclusion
   controls, capacity accounting, and session and project resumption without
   fabricated precision.
4. The work, now, attention, and next read model is usable without dashboard
   clutter.
5. Every capability presented as supported operates within the governed
   execution contract. Experimental capabilities outside it are removed,
   disabled, or explicitly accepted first.
6. The primary journeys pass automated checks and real Chrome UX and
   accessibility verification, with no known critical or high-severity defects.
7. The user explicitly approves a named release candidate.

Work toward these conditions preserves authoritative truth boundaries and
passes lint, build, tests, keyboard checks, and integrated browser
verification. Delivery sequencing is owned by `ROADMAP.md`.
