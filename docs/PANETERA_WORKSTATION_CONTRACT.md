# PaneTera Workstation Contract

**Status:** Locked canonical product and design contract
**Product:** PaneTera
**Audience:** Any AI-assisted builder, researcher, creator, analyst, operator,
or decision-maker
**Deployment:** Single-user, local-first, desktop-first V1

## Current implementation checkpoint

The `v0.9.0-alpha-workstation` checkpoint implements the workstation shell,
composer foundation, contextual Activity and Audit surfaces, project selection,
registered local-application routing, governed proposal presentation, and the
strict public web-preview path. The legacy three-column shell is no longer an
alternate product surface.

The following contract capabilities remain deliberate future work and must not
be inferred from the current interface:

- a general Rig registry or arbitrary external MCP connection;
- MCP capability discovery, resource attachment, or invocation;
- durable Headroom capsules or persisted composer context;
- the read model for work, now, attention, and next;
- generic cross-capability proposal and provenance contracts.

See `docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md` for the exact shipped boundary
and verification record.

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

## Canonical implementation sequence

1. Promote the PaneTera workstation to the only shell and remove the legacy UI.
2. Stabilise intent resolution and the unified surface router.
3. Extract shared authentication, Audit, Activity, notifications, and dialogs.
4. Establish Rig as a contextual capability and connection surface.
5. Add the read model for work, now, attention, and next.
6. Add durable Headroom capsules and changed-understanding records.
7. Complete governed proposal, execution, verification, and audit loops.

Each phase must preserve authoritative truth boundaries and pass lint, build,
tests, keyboard checks, and integrated browser verification.
