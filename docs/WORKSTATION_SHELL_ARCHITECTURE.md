# PaneTera Workstation Shell Architecture

**Status:** Canonical PaneTera shell; legacy UI retired
**Scope:** Presentation shell and operator interaction model
**Preserves:** Existing host policy, MCP, evidence, research, proposal, iframe,
and audit truth boundaries

The canonical workstation opens at `/`. There are no shell-selection query
flags or parallel legacy experiences.

## Product statement

PaneTera is a local-first, governed human–AI workstation for anyone
building, researching, creating, operating, analysing, or deciding across
projects. Its primary loop is:

> Ask → render the authoritative surface → inspect evidence → propose an action
> → approve execution → observe the result → retain an audit record.

It is not a developer-only application, monitoring dashboard, generic chat
application, or collection of permanently visible capability panels.

The shell must provide places for the six questions defined in
`PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md`, but must not render them as six
permanent panels. Work, now, attention, and next belong in the compact context
brief; evidence and changed understanding belong in contextual inspection.

## Shell invariant

Only two surfaces are permanent:

1. **Conversation** — the operator's persistent command and explanation plane.
2. **Canvas** — the dominant surface for native UI, live iframe UI, evidence,
   proposals, diffs, logs, and results.

Workspace selection, system health, activity, evidence history, and audit logs
are contextual drawers or popovers. They must not permanently reduce the canvas.

The governing UX rule is **one dominant surface, one conversation, one next
action**. The default shell may expose the current workspace and objective plus
a compact current-run state. It must not render the six product questions as
six panels, duplicate onboarding between conversation and canvas, continuously
announce healthy integrations, or use unexplained implementation language such
as `ORCHESTRATOR MODE` as primary user-facing hierarchy.

The canvas should be intentionally calm: current context at the upper edge, one
clear action when empty, and a subtle work boundary. It must not be filled with
decorative metrics or permanent status cards merely to occupy space. Icon-only
top-bar controls require accessible names and tooltips; exceptional attention
may add a small badge or short label without creating another status band.

```text
┌──────────── project · policy · active run · audit ──────────────────┐
│ Conversation (340–400px) │ Active canvas (remaining flexible width) │
│ history and tool trace   │ Native UI | Live App | Evidence          │
│ approvals                │ MCP surface / iframe / diff / result     │
│ persistent composer      │ contextual actions                       │
├──────────────────────────────────────────────────────────────────────┤
│ Drawers: Workspaces · Activity · Evidence · Audit · System health   │
└──────────────────────────────────────────────────────────────────────┘
```

## Operator state model

The UI should describe work, not implementation modes. The canonical lifecycle
is:

```text
idle → inspecting → proposal-ready → awaiting-approval → executing
     → verifying → completed | failed | cancelled
```

`Chat`, `Split`, `Focus`, and `Local App` are presentation mechanics and should
not be the primary navigation model.

## Canvas surface contract

Every canvas-renderable result should be represented by one surface envelope:

```ts
interface WorkbenchSurface {
  surfaceId: string;
  kind: string;
  title: string;
  source: { type: string; id?: string };
  trustLevel: string;
  lifecycle: string;
  capabilities: string[];
  evidenceRefs: string[];
  availableActions: string[];
  payload: unknown;
}
```

One renderer registry maps `kind` to a renderer. Compact conversation previews,
drawer entries, and the full canvas must derive from the same envelope rather
than separate feed/chat/main implementations of business logic.

## Governance presentation

- Show one compact governance indicator in the top bar.
- Expand detailed auth, adapter, manifest, and policy status only when requested
  or degraded.
- Associate consequential audit events with the work item or execution session.
- Keep UI telemetry such as panel resizing separate from the execution audit
  trail.
- Browser observation remains evidence, never application authority.
- An iframe is a visual surface, never an authority bypass.

## Canonical shell implementation

1. Maintain one stable `WorkstationShell`.
2. Keep conversation visible at the left and canvas dominant at the right.
3. Convert Intelligence Feed into a closed-by-default Activity drawer.
4. Convert workspace navigation into a drawer or command-palette surface.
5. Replace the large read-only banner with a compact governance bar.
6. Render local/live applications inside the same canvas shell.
7. Remove hardcoded unavailable systems; obtain integrations from authoritative
   configuration or discovery.
8. Preserve all current reference flows listed in `AGENTS.md`.

## Non-goals for the first slice

- No new execution adapter.
- No widened command allowlist.
- No new MCP tools or card vocabulary.
- No backend research or evidence changes.
- No cosmetic redesign detached from the operator loop.
- No migration of existing truth into client-side or model-generated state.

## Acceptance criteria

- At 1440px width, the active canvas receives at least 60% of usable width.
- Conversation remains available without changing application modes.
- Empty Activity, Audit, and Health surfaces consume no permanent canvas width.
- Native UI and live iframe UI open in the same canvas location.
- Governance state is visible but consumes no more than one compact bar.
- Keyboard and pointer navigation remain usable.
- Existing lint, build, and test suites pass.
- A screenshot comparison demonstrates materially less persistent chrome.
