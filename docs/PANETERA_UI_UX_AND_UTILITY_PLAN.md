# PaneTera UI/UX Convergence and Utility Plan

**Status:** Canonical planning companion
**Scope:** Visual convergence, interaction quality, accessibility, and
productivity utilities
**Implementation status:** Always comes from
`CURRENT_IMPLEMENTATION_CHECKPOINT.md`, not this plan

## Purpose

PaneTera needs to feel as considered as its authority and evidence model. This
plan defines when visual refinement and utility features should happen, what
they may change, and what they must never weaken.

The work has two distinct tracks:

1. **UI/UX convergence** makes existing truth and actions easier to understand
   and use.
2. **Utility features** shorten repeated workflows by routing to capabilities
   that already exist.

The tracks must not be mixed casually. A visual slice does not add authority or
behavior. A utility slice must define its state, authority, failure, audit, and
accessibility contracts before it receives polished presentation.

## Product outcome

PaneTera should feel like a quiet, capable cockpit:

- the current project and objective are obvious;
- the canvas remains the dominant working surface;
- the conversation and composer form one intentional control plane;
- current, pending, stale, failed, denied, and unavailable never look alike;
- one next action is easier to find than secondary utilities;
- evidence and provenance are available without becoming permanent clutter;
- repeated work is fast by keyboard but remains inspectable and governed;
- visual quality comes from proportion, typography, spacing, surface depth,
  and interaction states rather than decoration.

## Locked invariants

Every aesthetic and utility slice preserves:

- one dominant canvas, one conversation, and one next action;
- at least 60% canvas share at workstation widths;
- contextual drawers that create zero underlying canvas-width delta;
- application and server state as the only source of capability truth;
- explicit loading, empty, stale, unavailable, denied, and error states;
- read-only defaults and proposal-gated consequential action;
- visible provenance and authority boundaries;
- WCAG AA contrast, keyboard operation, visible focus, semantic landmarks, and
  reduced-motion support;
- no secrets in the client, transcript, browser storage, ordinary connection
  records, screenshots, or exported diagnostics.

Visual prominence never grants authority. Convenience never bypasses readiness,
approval, policy, evidence, or audit.

## Sequence and gates

### Gate 1: Truth-bearing components

Complete and review the semantic models for:

- Rig connection and capability states;
- Audit actor, outcome, policy, and correlation;
- Headroom freshness and capacity;
- public-web preview outcomes;
- browser evidence and provenance;
- active-canvas loading, result, degraded, and failure states.

No final aesthetic pass begins while these surfaces still disagree about what
their states mean.

### Gate 2: Cross-surface interaction consistency

Align:

- drawer headers and close/refresh behavior;
- loading, retry, cached, stale, empty, and unavailable treatments;
- primary, secondary, quiet, and destructive action hierarchy;
- progressive disclosure and collapsed summaries;
- focus entry, focus return, and Escape behavior;
- narrow-width contextual navigation.

### Gate 3: Pure aesthetic convergence

Once the semantic and interaction contracts are stable, perform a dedicated
visual pass. This pass may refine tokens and presentation, but not behavior.

### Gate 4: Utility features

Utilities ship individually after the real destination capability exists and
has an accepted state/authority contract. A menu item is not evidence that a
capability is implemented.

## UI/UX convergence phases

### Phase V1: Workstation foundation

Refine:

- product/project/objective hierarchy in the top bar;
- initial canvas and useful empty states;
- conversation-to-composer relationship;
- primary versus secondary start paths;
- pane proportions and responsive behavior.

Acceptance:

- no landing-page hero or duplicate onboarding;
- one primary start action;
- no fabricated project, capability, activity, or health claims;
- no horizontal overflow at the release viewport set.

### Phase V2: Contextual surface consistency

Apply one interaction grammar to Rig, Headroom, Audit, Activity, Evidence, and
project selection:

- shared header rhythm;
- clear current/loading/stale/error states;
- bounded summaries when collapsed;
- details only on demand;
- consistent refresh/retry language;
- quiet destructive actions with explicit confirmation;
- no authoritative counts while data is pending or unavailable.

The surfaces need not look identical. They should behave predictably.

### Phase V3: Active canvas and evidence

Refine the surfaces that replace the initial canvas:

- registered live applications;
- public web previews and degraded fallback;
- browser evidence;
- documents and artifacts;
- proposal, approval, execution, result, and verification;
- research and provenance views;
- file and project inspection.

Every active canvas surface must answer:

1. What am I looking at?
2. Is it live, observed, cached, derived, proposed, or authoritative?
3. When was it obtained or changed?
4. What can I safely do next?
5. Where is the supporting evidence or provenance?

### Phase V4: Pure aesthetics

This is the deliberate look-and-feel pass requested for PaneTera.

#### Typography

- Establish a compact, humanist hierarchy for title, section, body, helper,
  metadata, identifier, and code roles.
- Keep identifiers and paths monospace; keep prose humanist.
- Avoid oversized hero typography and excessive all-caps.
- Keep line lengths readable in canvas documents and evidence.

#### Surface depth

- Use warm graphite tonal steps, borders, and restrained elevation.
- Reserve overlays for menus, dialogs, and genuinely elevated content.
- Preserve calm empty space, but give it alignment and purpose.
- Never use ambient glows, glass effects, or decorative gradients.

#### Color

- Violet communicates interaction, selection, and focus.
- Brass communicates attention, ambiguity, approval, and stale evidence.
- Green communicates a completed meaningful success only.
- Danger communicates refusal or failure.
- Text and structure carry meaning when color is absent.

#### Density and spacing

- Base spacing on the existing 8px system.
- Keep the default comfortable rather than sparse or dashboard-dense.
- Align headers, controls, and card content across surfaces.
- Do not solve hierarchy by adding containers around everything.

#### Iconography

- Use one icon family and consistent optical size.
- Pair unfamiliar icons with text.
- Decorative icons remain hidden from assistive technology.
- State icons reinforce explicit state words rather than replacing them.

#### Motion

- Use short motion for orientation, disclosure, and focus continuity.
- Respect reduced motion.
- No looping, pulsing, or ambient animation.
- Motion must not be the only evidence that state changed.

#### Light appearance

A light appearance is optional, not a release requirement. It should be
considered only after semantic tokens cover every existing dark-surface use. A
second appearance must not introduce a parallel hardcoded theme.

### Phase V5: Responsive and accessibility convergence

Verify:

- the release viewport set and browser zoom to 200%;
- keyboard-only primary journeys;
- screen-reader names, states, relationships, and live regions;
- focus trapping and return for drawers, dialogs, and menus;
- touch-target sizing where narrow layouts expose controls;
- reduced-motion and high-contrast behavior;
- meaningful order when conversation becomes contextual.

## Utility feature sequence

### U1: Navigation and invocation

#### Capability-backed command palette

The palette is a searchable router to real capabilities, not a second intent or
policy engine.

Initial eligible destinations:

- choose or switch project;
- open Rig, Headroom, Activity, Audit, and Evidence;
- inspect attached context;
- open implemented goal, plan, compact, continue, and model surfaces.

Requirements:

- keyboard shortcut is discoverable and remappable later;
- unavailable commands are absent or explicitly unavailable, never inert;
- readiness and approval are evaluated by the destination capability;
- recent commands store identifiers and presentation metadata, not secrets.

#### Quick project switcher

- Search registered projects by stable metadata.
- Show recent projects only from local, explicit history.
- Distinguish registered projects from temporary file/folder grants.
- Preserve the same project-selection authority as the existing chooser.

### U2: Session and context continuity

#### Goal

- Read and update a durable objective and success conditions.
- Record changes and provenance.
- Never infer a goal merely from recent conversation.

#### Plan

- Show steps, required capabilities, authority, expected evidence, checks, and
  decision points.
- Keep a plan proposed until the applicable execution gates are satisfied.

#### Compact

- Create an inspectable Headroom capsule.
- Name retained and excluded material.
- Preserve raw history as evidence.
- Allow edit, accept, reject, and delete without pretending hidden context was
  transferred.

#### Continue

- Resume or fork from an identified capsule.
- Show source capsule, freshness, excluded material, and unresolved questions.
- Never imply deterministic continuation.

#### Context inspector

- Show attachments, grants, sources, scope, freshness, expiry, and revocation.
- Provide a direct route to remove or refresh context.
- Keep untrusted material visibly untrusted.

### U3: Retrieval

#### Unified search

Search may span:

- registered projects and files;
- conversation and Headroom summaries;
- evidence and provenance;
- Audit records;
- artifacts and runs when those records exist.

Results must retain source type, project, freshness, trust, and access boundary.
Search snippets never become application truth merely because they match.

### U4: Personal workspace preferences

Eligible local preferences:

- conversation pane width;
- comfortable or compact density;
- reduced discretionary motion;
- preferred startup project or no automatic project;
- remembered drawer disclosure;
- keyboard shortcut mapping.

Preferences remain local, reversible, and separate from capability policy.
They must not hide attention, approvals, failures, or security boundaries.

### U5: Attention and notification utilities

Build only on the accepted work/now/attention/next read model.

- One bounded attention inbox for approvals, failures, conflicts, stale context,
  missing capabilities, and weak evidence.
- Deduplicate repeated signals.
- Preserve source project and governing action.
- Quiet healthy and dormant work.
- Never turn general activity into notification noise.

### U6: Export and sharing

Defer until the generic provenance record and shared redaction policy are
accepted.

- Preview the exact artifact and redactions.
- Separate artifact content from provenance sidecars where appropriate.
- Record source evidence, actor, grant, and export receipt.
- Require explicit destination and scope.
- Never make a local artifact public as an implicit convenience.

## Explicitly deferred utilities

These do not belong in the current convergence tranche:

- arbitrary terminal access;
- unattended agent swarms;
- a generic integration marketplace;
- hidden automatic model switching;
- automatic approval;
- remote database mutation;
- public sharing without a governed export contract;
- decorative desktop companions;
- permanent infrastructure dashboards.

## Slice protocol

Every UI or utility slice follows this order:

1. Write the state/authority truth table.
2. Identify the existing handlers and backend constraints.
3. Define one bounded visual or utility outcome.
4. Implement a pure presentation/readiness model where state interpretation is
   non-trivial.
5. Add behavior and accessibility tests.
6. Prove important guards fail when the correction is reverted.
7. Run lint, build, `git diff --check`, relevant suites, and the complete suite
   when shared contracts changed.
8. Verify the real browser journey where representative state exists.
9. Disclose states that were fixture-verified but not browser-verified.
10. Review, then create one coherent commit.

Do not combine:

- backend authority changes with visual restyling;
- unrelated surfaces in one visual commit;
- a new capability with a whole-product reskin;
- generated screenshots or local credentials with source control.

## Release viewport and interaction set

Minimum browser review:

- 1440 × 900 window;
- 1280 × 800 window;
- 1024 × 768 window;
- 200% zoom at a supported workstation width;
- keyboard-only traversal;
- reduced-motion preference.

Record the actual content viewport when reporting geometry, because browser
chrome reduces the page height.

## Aesthetic acceptance questions

An aesthetic slice is ready only when the answer to each is yes:

- Is the primary action apparent without reading every control?
- Do current, pending, stale, failed, denied, and unavailable remain distinct?
- Does the canvas remain dominant?
- Is meaning preserved without color?
- Are empty areas purposeful rather than abandoned?
- Are details available without becoming permanent clutter?
- Are focus, hover, selected, disabled, and destructive states clear?
- Does the change still feel like one product across conversation, canvas, and
  contextual surfaces?
- Did the slice avoid adding unsupported capability claims?

## Utility acceptance questions

A utility is ready only when:

- its destination capability already exists;
- readiness and authority come from the canonical backend contract;
- unavailable, denied, expired, and failed states are explicit;
- keyboard and pointer journeys reach the same result;
- the action is auditable where consequential;
- no secret or raw sensitive material is stored in recents or preferences;
- cancellation and recovery behavior are defined;
- browser verification covers the primary journey.

## Success measures

Measure convergence through:

- fewer duplicated state interpretations;
- fewer false-current, false-empty, and false-success defects;
- completion time for repeatable primary journeys;
- keyboard completion of the same journeys;
- reduced need to open multiple contextual surfaces for one decision;
- zero horizontal overflow at release viewports;
- zero critical/high accessibility defects;
- user recognition of the next action without explanation;
- stable visual tokens with declining one-off style additions.

Visual polish is successful when PaneTera feels more coherent and easier to
operate while saying exactly the same truthful thing. Utility is successful
when repeated work becomes faster without becoming less governed.
