# Instructions for the next session's agent

You are picking up PaneTera UI/UX and operator work mid-stream. Read this first,
then `docs/SESSION_HANDOFF.md` for the exact state.

## Step 0: orient before you touch anything

1. Read `docs/SESSION_HANDOFF.md`.
2. Run: `git -C /path/to/PaneTera log --oneline -8` and `git status`.
   Expected: on `feature/ui-provenance-ledger`, clean tree, 8 commits ahead of `dev`.
3. Do not re-derive the design from scratch. The north star is decided (below).

## How this collaboration works

- The user runs the app and the browser on his Mac. You cannot see the UI or run
  the browser. You write code and verify what you can in the Linux sandbox.
- The loop is: you make a contained change, verify it (typecheck + build + any
  relevant unit tests), commit it, then the user runs the app and reports back
  with a screenshot. You iterate from what he actually sees.
- Verify before you hand off. In the sandbox you CAN run:
  - `npx tsc --noEmit -p tsconfig.json` (typecheck)
  - `npx vite build` (production build; ~5s)
  - `node --import tsx --test --test-timeout=20000 test/<file>.test.ts` (unit tests)
  Never hand the user a change you have not at least typechecked and built.
- The full `npm run test:core` (1140+ tests) block-buffers in the sandbox and may
  not flush; run the targeted tests instead, and have the user run `test:core`
  before a merge.

## Repo conventions

- One feature branch per piece; commit style `type(scope): summary` with a short
  body. Keep commits small and reversible.
- Typecheck and build clean before every commit. Fix or update tests you break;
  do not delete a test to make it pass, update it to the new intended behavior.
- Guard UI rendering. A prior crash (blank screen) came from a card dereferencing
  an undefined field. Always default-guard `status`, `events`, `reply`, etc.

## Environment gotchas (tell the user, do not fight them)

- `npm run dev` runs vite (client 5173) and tsx (server 4000). tsx hot-reloads
  server files automatically. Vite HMR is flaky here; when a client change does
  not appear, the fix is a clean restart, not `npm run build`:
  `pkill -f tsx; pkill -f vite; lsof -ti:4000,5173 | xargs kill -9` then `npm run dev`,
  then hard-refresh (Cmd+Shift+R).
- Server-only changes just need the user to re-send a message (tsx reloads).
- Do NOT tell the user to `npm run build` to see dev changes; that is production.

## Design north star (do not relitigate)

- Warm identity: espresso graphite (`#181614`, `#1B1917`), parchment (`#F2EDE4`),
  lavender interaction (`#B9A5E8`), brass attention (`#D6A756`), green only when
  earned. Never cold/neon. Tokens live in `src/theme/tokens.ts` / `cssTokens.ts`.
- Core principle: the left conversation is the answer (the what); the right pane
  is the receipt for how it was made (timing, grounding, context, governance,
  provenance). They never show the same content. No duplication across planes.
- No emojis, no em dashes, no AI slop in UI copy. Sentence case. Plain, honest,
  anti-hype.

## First tasks, in order

1. Get the user to run `npm run test:core && npm run build`, then merge
   `feature/ui-provenance-ledger` into `dev` (`git checkout dev && git merge --no-ff`).
2. UI-4 Cockpit status bar (this was next). An always-on strip under the top bar
   in `src/components/workstation/WorkstationShell.tsx`: session, run status,
   approvals waiting, Headroom as an ambient context gauge. Additive; keep the
   shell layout intact. Build it, typecheck + build, hand to the user to verify.
3. Then: trust surface (UI-2), web-preview canvas fix, token count in the readout,
   wire save-to-Headroom / re-run quick actions, editorial pass, em-dash sweep.
   See `docs/SESSION_HANDOFF.md` for detail on each.

## Working style the user expects

- Discuss before large execution; for complex work he uses an "I-7" loop and
  likes to confirm direction at an inspect checkpoint before you build a lot.
- Plain words when discussing options. Give a clear recommendation, not just a
  menu.
- Concise. No em dashes, no motivational filler, no teaser endings.
- Ship contained, verifiable pieces. Do not attempt a large blind refactor at the
  tail of a long session.

## Key files

- Run card / readout / ledger: `src/components/workbench/AgentRunCard.tsx`
- Streaming turn (left): `src/components/transcript/TranscriptTurn.tsx` (StreamingReply)
- Markdown renderer: `src/components/MarkdownText.tsx`
- Chat send + canvas routing: `src/App.tsx` (search `useWorkspaceOrchestrator`, `AgentRun`)
- Intent routing: `src/composer/intentResolver.ts`, `src/utils/paneteraIntent.ts`
- Streaming run server: `server/operatorRun.ts`, `server/index.ts` (`/api/chat/stream`,
  `buildOpenAIOperator`, `askOpenAIAsRun`), `server/openaiStream.ts`
- Run SSE + store: `server/agent/routes.ts` (`handleRunEvents`), `server/agent/runStore.ts`,
  `server/agent/operatorSink.ts`
