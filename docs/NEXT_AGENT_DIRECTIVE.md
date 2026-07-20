# Next Agent Directive

> **Superseded:** This file records the completed Shell 3A correction history.
> It is not the current assignment. Follow
> `docs/PANETERA_WORKSTATION_CONTRACT.md`,
> `docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`, and `AGENTS.md`.

**Owner:** Codex coordination
**Assigned agent:** Antigravity
**Current phase:** Workstation Shell 3A — opt-in structural prototype
**Release base:** `249513d`, tagged `v0.8.3-alpha-phase-2b.2a-final`
**Product name:** PaneTera
**Status:** Round-two handoff rejected; finish the existing correction pass

## Codex rejection: integrated Chrome verification

The latest reconstruction is also rejected. Chrome verification showed that
the entire legacy workstation was mounted inside the V2 conversation slot while
the V2 canvas remained empty. The application therefore regressed to the
three-column layout that Shell 3A exists to replace.

Before editing again, inspect the current dirty tree and make a bounded recovery
plan. Do not use `git checkout`, `git restore`, reset, stash, bulk regex rewrite
scripts, or generated search-and-replace programs. Do not overwrite another
agent's or the user's uncommitted work. Make small reviewable patches.

Correct these integrated defects:

1. `conversation` must contain only the reused transcript/current-run content,
   compact suggestions affordance, and composer. Never pass
   `mainWorkbenchContent` or the legacy `WorkbenchShell` into conversation.
2. `WorkstationShellV2` owns the only `main` landmark. Pass canvas content, not
   another element with `component="main"`.
3. Route active workspace, active component, empty state, and all local-app
   states exclusively into that one V2 canvas.
4. Remove the permanent legacy workspace rail, infrastructure list, mode bar,
   governance band, and Intelligence Feed from V2. The top workspace popover and
   Activity drawer must not duplicate permanently visible copies.
5. Replace `localAppStatus === 'reachable' || true` with the authoritative
   backend health signal. Never fabricate a healthy governance value.
6. Make the compact Suggestions control open in a real browser, expose expanded
   state correctly, preserve every existing action, and close after selection.
7. Preserve the shared authentication path and prove that the locked shell is
   both visually and interactively blocked.
8. Keep the Activity drawer's accessible close path, which Chrome confirmed is
   functional, while avoiding duplicate visible feed headings.

Add an integration-level assertion or browser check against the actual V2 App
wiring. The isolated `WorkstationShellV2` static-render test is necessary but
insufficient: it passed while the application contained two `main` landmarks
and mounted the legacy shell in conversation.

Before handoff, Antigravity must personally test the clean application in a
browser as a user. A handoff is forbidden until all of the following have been
observed and recorded:

- exactly one `main` landmark in the integrated V2 application;
- conversation remains within 340-400px and contains no infrastructure rail or
  workspace workbench;
- active native workspace content renders in the canvas;
- local-app reachable or honest failure content renders in the same canvas;
- workspace popover opens and closes without duplicating permanent navigation;
- Suggestions opens, supports keyboard use, preserves actions, and closes;
- Activity opens over the canvas and its own close action closes it;
- opening Activity produces zero underlying pane-width delta;
- no runtime errors or failed hot reloads appear after a clean reload;
- legacy shell remains unchanged when `?shell=v2` is absent.

Recreate the screenshot evidence from these actual states. Do not label a file
`unlocked`, `activity-open`, `native`, or `live` unless the pixels visibly prove
that state. Do not expose or invent tokens in evidence. Record actual browser
bounding boxes, not CSS calculations.

The next handoff must begin with failures found during Antigravity's own browser
review and how they were corrected. Passing lint, build, or isolated tests does
not constitute Shell 3A acceptance without integrated behavioral and visual
proof.

## Codex rejection: Shell 3A round two

The round-two handoff is rejected. It claimed completion without providing a
mandatory acceptance artifact and misstated several implementation facts. Do
not begin another feature phase. Correct the remaining defects below and return
only when every item is supported by actual evidence.

1. Capture the eight required browser screenshots. CSS calculations are not
   browser measurements and are explicitly forbidden as a substitute. Use the
   already available Chrome or Playwright environment and actual
   `getBoundingClientRect()` results at exactly 1440x900 and 1280x800.
2. Extract or reuse the token prompt once. The current implementation copied the
   authentication markup into a second `tokenPromptNode`; that is not the shared
   authentication path required by section B. Preserve interactive blocking,
   including pointer-event behavior, and prove Enter, Unlock, and error display.
3. Preserve every existing compact suggestion action. The V2 menu currently
   drops at least `Find entry points` and `Find TODOs`. Move the existing action
   set behind the compact affordance without inventing or silently removing
   commands.
4. Give the existing `PreviewPanel` close control an explicit accessible name
   and prove in a browser that it closes the V2 Activity drawer. Static markup
   does not prove this state transition.
5. Fix whitespace errors in files changed by this pass and report the real
   result of a path-scoped `git diff --check` over the permitted files. Also
   report any full-tree failure separately without editing an unrelated dirty
   file merely to make the global command green. Do not claim a clean result
   while the command being reported fails.
6. Remove `capture.mjs` from the repository root after using an ephemeral copy
   under `/tmp`; it was created by this pass and is not a deliverable. Do not
   delete or clean any other pre-existing untracked artifact.
7. Perform a clean browser reload before evidence capture and confirm there is
   no blank-screen runtime error. The observed `Button is not defined` failure
   was repaired by the import, but runtime health must be demonstrated rather
   than assumed.

The canonical UX doctrine is now locked in the product-scope and shell
architecture documents: **one dominant surface, one conversation, one next
action**. Do not broaden this correction into the context-brief phase or a
visual redesign. In this pass, remove duplicate empty-state instruction and
replace `ORCHESTRATOR MODE: READ-ONLY` with concise human language only if doing
so remains a presentation-only edit. Keep healthy systems quiet and keep
Activity, evidence, audit, workspace selection, and detailed health contextual.

## Assignment boundary

This directive is the complete assignment. Correct exactly the eight rejected
items below, verify them, and stop. Do not begin the context-brief phase or make
adjacent improvements merely because they appear useful.

The expected implementation scope is limited to these files unless a test
fixture or screenshot artifact is strictly required:

- `src/App.tsx`
- `src/components/workstation/WorkstationShellV2.tsx`
- `src/components/PreviewPanel.tsx` only for the existing Activity close
  control or its accessible name
- `test/workstationShellV2.test.tsx`
- screenshot evidence under `docs/evidence/shell-3a-round-two/`

Do not edit `package.json` unless the existing test command cannot execute the
new structural test. Do not add dependencies. If another production file seems
necessary, stop and report why before changing it.

## Codex review: Shell 3A round one

The prototype compiles and the full test suite passes, but it does not yet meet
the structural or behavioral acceptance contract.

Correct only these items:

1. Add actual structural tests for the conversation landmark, one canvas
   landmark, Activity closed by default, and both native/live stub content
   rendering inside the same canvas. Query-parser-only tests are insufficient.
2. Preserve V2 authentication/unlock behavior. The current early V2 return skips
   the token prompt contained in the legacy shell.
3. Route the existing local-app/live-iframe branch into the V2 canvas. The
   current `canvasNode` handles only workspace, active component, and empty state.
4. Replace the permanent horizontal prompt-chip row with one compact suggestions
   affordance.
5. Make the Activity content's own close control close the V2 drawer. The current
   `PreviewPanel onClose={() => {}}` is a no-op. Avoid duplicate Activity headers.
6. Add semantic/accessibility landmarks and state: conversation label, canvas
   label, Activity toggle `aria-expanded`, workspace selector keyboard activation,
   and an accessible Activity close action.
7. Use the locked product label **PaneTera** in V2, preserving that exact
   spelling and capitalisation. Keep wording domain-agnostic. Do not add
   developer-only dashboard language or expose the supporting metaphor as
   unexplained navigation jargon.
8. Supply the required 1440×900 and 1280×800 screenshots and measured pane widths,
   including canvas width before and after opening Activity.

Do not implement context-capsule storage or fabricate answers to the six product
questions in this shell correction. The shell should establish their future
locations; the context brief is the next product slice.

Do not commit, tag, push, modify backend contracts, or delete the legacy shell.

## Locked product language

PaneTera is the product. In future phases, **your rig** may describe the user's
configured models, agents, applications, tools, and connections, while
**headroom** may describe bounded context and judgment capacity. **Signal
Chain**, **Soundcheck**, **Stage**, and **Control Room** are supporting concepts.

For this correction pass, change only the V2 product label and empty-state copy
needed by item 7. Do not introduce rig configuration, headroom calculation,
context storage, new navigation sections, or themed status panels.

## Required correction details

### A. Structural tests, not parser assertions

Replace the current query-only coverage with tests that render or exercise the
actual V2 shell. Keep the query activation assertions, but additionally prove:

- a labelled conversation landmark is present;
- exactly one labelled main canvas landmark is present;
- the Activity toggle reports `aria-expanded="false"` initially and Activity
  content is not visibly open by default;
- a native stub renders inside `workstation-canvas`;
- a live-surface stub renders inside that same `workstation-canvas`, not in a
  second main region, Activity, or conversation.

Use the dependencies already present in the repository. A static-markup test is
acceptable for structural invariants; use a browser-level check where stateful
open/close behavior cannot be proven statically. Do not call a query-parser test
"structural" evidence.

### B. Authentication equivalence

The `?shell=v2` branch must preserve the existing `showTokenPrompt`,
`tokenInput`, `tokenError`, Enter-key submission, and `handleTokenSave` behavior.
Reuse the existing authentication UI or extract it once; do not fork auth state
or create a V2-only token path. While locked, the underlying shell must remain
visually and interactively blocked as it is in the legacy flow.

### C. One canvas for native and live work

Build the V2 canvas selection from the existing state without copying business
logic. When `workbenchMode === 'local-app'`, route the existing local-app branch
into the V2 canvas, preserving all three states:

1. no selected app → existing `WorkbenchEmptyState`;
2. selected but unreachable → existing `WorkbenchFailureState`;
3. reachable → existing `LiveWorkbenchToolbar` plus `LiveWorkbenchSurface`.

When not in local-app mode, preserve the existing active-workspace,
active-component, and empty-canvas selection. All variants must be children of
the single `main[data-testid="workstation-canvas"]` region.

### D. Compact suggestions

Remove the permanently visible horizontal chip strip. Preserve the existing
suggestion actions behind one keyboard-accessible compact button, menu, or
popover near the composer. Do not change `handleSend` or invent new prompts.

### E. One Activity header and a real close path

The Activity drawer remains temporary, overlays the canvas, and is closed by
default. The existing `PreviewPanel` close control must receive the V2 drawer
close callback; a no-op is forbidden. Render only one visible Activity/feed
header. It is acceptable for the shell to provide a close callback through a
render prop or another presentation-only interface; do not lift drawer state
into application business state.

### F. Semantic and keyboard contract

- Conversation: semantic region (`aside` or equivalent) with an accessible
  PaneTera conversation label.
- Canvas: exactly one `main` with an accessible PaneTera canvas label.
- Activity toggle: accessible name, `aria-expanded`, and `aria-controls`.
- Activity drawer: labelled dialog/region and an accessible close action.
- Workspace selector: a native button or button-equivalent with Enter/Space
  activation, an accessible name, `aria-haspopup`, and expanded state.
- Audit icon: retain an accessible name rather than relying on tooltip text.

Do not remove visible focus treatment.

### G. PaneTera wording

Replace `MyAI Portal` and `MyAI Workbench` in V2-only product labels with
`PaneTera`. The empty state should describe the domain-agnostic loop in plain
language: ask, work on the authoritative surface, inspect evidence, and choose
the next action. Do not rename the repository, API paths, local-storage keys,
environment variables, or legacy-shell labels in this correction.

### H. Screenshot and measurement evidence

Capture actual browser screenshots at exactly 1440×900 and 1280×800. At minimum
provide, for each viewport:

- initial/empty V2 shell;
- active native/workspace surface;
- Activity open over the canvas;
- live local-app surface when the configured app is reachable; otherwise record
  the honest failure state and explain the unavailable dependency.

Record measured bounding-box widths for conversation and canvas before and
after Activity opens. Because Activity is a temporary overlay, opening it must
not change the underlying grid widths. Report viewport, conversation width,
canvas width, canvas percentage, and before/after delta. Do not substitute CSS
intent for browser measurements.

## Read first

Read `AGENTS.md`, `docs/PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md`, and
`docs/WORKSTATION_SHELL_ARCHITECTURE.md` completely before editing. The product
scope is authoritative for naming and audience; the architecture document is
authoritative for shell intent and layout invariants.

## Objective

Build an opt-in workstation shell that proves the new information architecture:

- persistent conversation on the left;
- dominant active canvas on the right;
- compact governance state at the top;
- workspace, activity, evidence, audit, and health as contextual surfaces rather
  than permanent columns or stacked status bands.

This is a shell restructuring, not a capability phase.

## Safety and scope

- Do not modify `server/research/**`, evidence contracts, MCP contracts, proposal
  authority, execution allowlists, iframe security, or audit truth semantics.
- Do not add new tools, card types, matchers, providers, or backend routes.
- Preserve every existing dirty file and unrelated change.
- Do not delete the current shell. The new shell must be opt-in for review.
- Do not commit, tag, push, or rewrite existing history.
- Do not perform broad visual restyling. Establish hierarchy and space first.

## Implementation requirements

### 1. Opt-in entry

Activate the prototype only with `?shell=v2`. Without that parameter, the current
shell must render exactly as it does today.

### 2. Stable two-plane layout

Create a bounded workstation component area, preferably under
`src/components/workstation/`:

- conversation width: clamp between 340 and 400px;
- canvas: flexible remainder, at least 60% of usable width at 1440px;
- no permanently open right feed;
- no permanent infrastructure/workspace left rail in V2.

### 3. Conversation plane

- Reuse the existing transcript and `ChatInput`; do not fork chat behavior.
- Keep the composer persistently accessible.
- Put contextual prompt suggestions behind one compact affordance instead of a
  permanently scrolling chip row.

### 4. Canvas plane

- Reuse the existing active workspace, active component, and live-app renderers.
- Native UI and local/live iframe UI must occupy the same canvas location.
- Do not render full interactive applications inside Activity or conversation.
- Provide a useful empty canvas that explains the ask → render → inspect loop
  without dashboard metric cards.

### 5. Contextual surfaces

- Workspace selector: drawer or popover.
- Activity/Intelligence Feed: closed-by-default drawer reusing existing feed data.
- Audit: existing audit viewer, launched contextually.
- Health/governance: one compact top-bar indicator; detailed statuses expand on
  request or degradation.
- Remove the hardcoded DAX status from the V2 presentation. Integrations must be
  derived from authoritative configuration or omitted.

### 6. State discipline

- Do not create a second copy of workbench business state.
- Pass the minimum existing state and callbacks into extracted presentation
  components.
- Keep mode compatibility internally if required, but do not expose `Chat`,
  `Split`, `Focus`, and `Local App` as the primary V2 navigation language.

## Required verification

1. Add focused structural tests for:
   - V2 activation only with `?shell=v2`;
   - conversation and canvas both present;
   - Activity closed by default;
   - native and live surfaces target the same canvas region.
2. Run `npm run lint`, `npm run build`, and `npm test`.
3. Run `git diff --check` on in-scope files.
4. Capture screenshots at exactly 1440×900 and 1280×800 showing:
   - empty/initial state;
   - active workspace/native surface;
   - live-app iframe surface if locally available;
   - Activity drawer open.

## Required handoff

Return, without committing:

1. Exact files changed.
2. A short component/state diagram.
3. Before/after screenshots and measured pane widths.
4. Verification commands with exit codes.
5. Any reference flow that is not yet equivalent.
6. Remaining dirty files classified as in-scope or pre-existing.

Codex will review behavior, visual hierarchy, and diff scope. V2 will not become
the default shell until that review is accepted.
