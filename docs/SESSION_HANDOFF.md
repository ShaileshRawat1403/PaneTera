# PaneTera session handoff

Written at the end of a long UI/UX and operator-behavior session. Everything is
committed; the working tree is clean.

## Git state

- `dev` is at `8d8a652` (merge: close the PaneTera harness, H3a-H3d + rich streaming UI).
- Active branch: `feature/ui-provenance-ledger`, 7 commits ahead of `dev`, not yet merged.
  1. `7f7a64c` feat(ui): Provenance Ledger, run steps as a connected warm spine
  2. `a287ac6` fix(operator): no project selected acts as a personal operator, not a gate
  3. `71eeee7` feat(ui): approval as ceremony (brass gate in the run card)
  4. `90a1ab3` fix(operator): orchestrator answers as personal operator when no project
  5. `23ffb22` chore(ui): drop actor emoji and the run-card filler line
  6. `fd125df` feat(ui): right pane is a run readout, not an echo
  7. `6a8e367` fix(ui): a finished run still delivers its steps to the readout

Next housekeeping step: run `npm run test:core && npm run build`, then merge
`feature/ui-provenance-ledger` into `dev` with `--no-ff`.

## What shipped this session (on the branch)

- Personal-operator behavior: with no project selected, general questions answer
  conversationally instead of bouncing with "needs project context." Fixed in
  two layers: client routing (`src/composer/intentResolver.ts`, both artifact
  producers gated on `hasWorkspace`) and a server guarantee (`/api/orchestrator/chat`
  answers via `askOpenAI` when `!workspaceId`).
- Provenance Ledger: the run card's flat event list is now a warm connected
  vertical spine (`src/components/workbench/AgentRunCard.tsx`, `EventTimeline`).
  Shown only when the turn did something governed (a tool or an approval).
- Approval as ceremony: brass-accented gate showing the exact action and risk.
- Run readout (the right pane's identity): the right pane is the receipt for HOW
  the answer was made, never the answer itself. Shows timing + step count, a
  grounding line ("Answered from model knowledge, no tools or files" vs "Grounded
  in N tool results"), the context it worked from (project or none, Headroom,
  attachments, threaded from the client in `App.tsx`), and a Copy answer action.
- No duplication: the answer lives only in the left conversation; the right is
  the governance/readout view. Actor emoji and filler copy removed.

## Design north star (agreed)

- Identity stays warm: espresso graphite (`#181614`, `#1B1917`), parchment text
  (`#F2EDE4`), lavender interaction (`#B9A5E8`), brass attention (`#D6A756`),
  green only when earned. Not cold/neon.
- Layered system: Provenance Ledger is the governance spine, Editorial Atelier is
  the reading/writing voice, a pinned evidence rail is an optional density mode.
- Signature moments: the trust surface (hover a claim, see the node that produced
  it), approval as ceremony (done), a scrubbable ledger, and Headroom as an
  ambient context gauge.
- Principle: left = the answer (what), right = how it was made (receipt,
  provenance, governance). They never show the same thing.

## Open threads / what's next

Pending tasks (UI enrichment):
- UI-4 Cockpit status bar: an always-on strip under the top bar (session, run
  status, approvals waiting, Headroom as an ambient gauge). Biggest visible win;
  touches `src/components/workstation/WorkstationShell.tsx`. This was the next
  piece being started when the session ended.
- UI-2 Trust surface: provenance marks on claims linking to ledger nodes. Needs a
  little provenance plumbing from the run's tool events.
- UI-5 Editorial typography pass.

Also queued:
- Web-preview canvas fix: when the operator fetches a page (fetchWebPage), show
  that page on the canvas instead of the run readout card, so "you can view it
  directly" is actually true. The streaming branch in `App.tsx` currently sets
  the AgentRun card and clears the web preview.
- Token count in the readout: not captured yet. Add `stream_options: { include_usage: true }`
  to the OpenAI stream call and surface usage into the readout.
- Wire the two stubbed quick actions: "save this answer to Headroom" and "re-run
  with a project attached" (Copy is done).
- Em-dash / AI-slop sweep: high-visibility copy is clean; deeper panels
  (`PreviewPanel.tsx`, `EvidenceContent.tsx`) still have some em dashes.
- Event vs token stream: working as designed (both put the answer on the left;
  token types it out, event lands it whole). If wanted, make event mode emphasize
  the right-side ledger. Discuss.

## Environment notes

- Run with `npm run dev` (vite client 5173 + tsx server 4000). Vite HMR is flaky
  in this repo; when a change does not appear, do a clean restart:
  `pkill -f tsx; pkill -f vite; lsof -ti:4000,5173 | xargs kill -9` then `npm run dev`.
  You do NOT need `npm run build` for dev; that is for production.
- Browser Operator extension: load unpacked from `chrome-extension/` via
  `chrome://extensions` (Developer mode). If `pairing.html` 404s, the installed
  copy is stale, reload or re-load unpacked. Pairing: Rig generates an 8-char
  code (XXXX-XXXX, 2 min); either click Approve on the auto-opened tab, or enter
  the code in the extension popup.
- Leftover `e2e-fixture-*` and `fixture` connections in Rig are test cruft; remove
  with their Remove buttons.
- Sandbox can run `node --import tsx --test ...` and `vite build` for verification;
  it cannot run the browser. The user runs the app and verifies UI live.
