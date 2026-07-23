# Handoff: web preview fallback surface

**From:** Claude, continued by Codex · **Updated:** 22 July 2026 · **Branch state:** uncommitted, nothing tagged
**Status of A1 (dissect a page):** Partial, release blocker

## Execution ownership from 22 July

- **Claude is the implementer.** Continue product and UI/UX work in the existing
  shared working tree; do not start a second implementation or discard changes.
- **Codex is the reviewer.** After each coherent Claude change set, provide the
  diff, tests run, browser evidence, and any unresolved product decision to
  Codex for an independent correctness, security, regression, and UX review.
- Keep changes uncommitted until the review is clear or the user explicitly
  requests a commit.
- Do not report a capability as working from source inspection or unit tests
  alone. For browser-facing behavior, include a real Chrome journey.

## Codex continuation — current interaction contract

The timed-assist work described below has since been completed, along with the
Browser Operator evidence surface and the extension pairing/recovery fixes.

The permitted-page experience is now **choice-first**. A missing refusal header
does not automatically give an unverified iframe the canvas. PaneTera presents:

1. Browser Operator evidence (primary, approval-gated);
2. an explicit “Try embedded preview” action;
3. open in browser.

This is a deliberate UX correction. Cross-origin rendering cannot be observed,
so auto-embedding could still produce the giant blank canvas that started this
work. A person may still choose the fast iframe route, and a permanent sibling
status remains beside it, but the ambiguity is no longer the default visual.

Other continuation changes:

- conversation width now starts at 400px with a 340px workstation floor;
- the empty conversation and empty canvas no longer ask the same question;
- Browser Operator status is confirmed by the extension, not inferred from a
  stale server session;
- an extension reload restores its access token from the persisted refresh
  token;
- one pairing request opens one approval tab, and stale duplicates close when
  another tab resolves the request;
- BFCache port closure is recoverable and consumes Chrome's `runtime.lastError`.

All of this remains uncommitted in the shared dirty tree.

---

## 1. What is done

The original defect — PaneTera saying "I opened <url>" over a blank canvas — is
closed at the source. Claims are now composed from an observed outcome, and no
outcome can produce a success sentence.

Files changed this session, all uncommitted:

| File | Change |
|---|---|
| `src/components/workbench/webPreviewOutcome.ts` | New. Outcome model, presentation, claim composition |
| `src/components/workbench/WebPreviewSurface.tsx` | Probe on mount, degraded states, assist strip |
| `server/workbench/webPreviewProbe.ts` | New. Server-side framing probe |
| `server/workbench/addressSafety.ts` | New. SSRF allowlist, pinned lookup |
| `server/index.ts` | `POST /api/web-preview/probe`, error logging |
| `src/App.tsx` | Claim composed from outcome via `onOutcome`; operator status polling |
| `src/context/contextBrief.ts` + test | Context Brief read model, 55 tests |
| `src/components/workstation/paneSizing.ts` + test | Canvas 60% floor, 21 tests |
| `package.json` / `package-lock.json` | `ipaddr.js` as a direct dependency |
| `docs/PANETERA_USE_CASES.md` | Capability map reconciled against the checkpoint |

Test suites: `addressSafety` 71, `webPreviewOutcome` 32, `contextBrief` 55,
`paneSizing` 21. Lint, build, `git diff --check` clean. 44 suites pass.

---

## 2. Completed after the original handoff

The original next task is complete. The timed assist was replaced with a
permanent status surface, and Browser Operator evidence is available as the
approval-gated fallback.

The current interaction contract is:

- Header refusal keeps its immediate full degraded state. That path is
  authoritative and already correct.
- A page without an authoritative refusal is not embedded automatically.
  PaneTera first offers Browser Operator evidence, an explicit “Try embedded
  preview” action, and “Open in browser.”
- Once embedding is explicitly chosen, the frame gets a slim, permanent status
  strip. No timer.
- The strip always offers **Inspect with Browser Operator** (or **Connect** when
  it is not paired) and **Open in browser**.
- Inspection stays approval-gated. After approval, its bounded screenshot and
  evidence render in the canvas as the fallback surface.
- Never describe an iframe as verified. "Placed in canvas; rendering unverified"
  is the honest register.

The conversation pane now starts at 400px with a 340px floor, the duplicated
empty-state question is removed, and the trust treatment is condensed to
“External · untrusted.” New transcript claims say the source was prepared in
the canvas and explicitly disclose that its contents were not read.

Focused web-preview verification is 34/34. The full repository test command,
lint, build, and `git diff --check` passed after these changes. Chrome was used
to verify both a refused Hostinger frame and an explicitly embedded
`example.com` page.

## 3. Next execution priorities for Claude

Work in small, reviewable slices, in this order:

1. **Responsive workstation layout.** The 340px conversation floor improves
   desktop use but is not a narrow-window strategy. Design and implement the
   conversation/canvas relationship below 1024px without hiding the active
   task, composer, or current evidence. Verify desktop and narrow Chrome
   journeys.
2. **Browser evidence hierarchy.** Refine the evidence canvas so screenshot,
   source URL, capture time, approval state, provenance, and available actions
   are visually scannable without weakening the untrusted-content boundary.
3. **Useful empty-canvas starts.** Replace decorative empty space with a small
   set of functional actions derived from capabilities that actually work.
   Avoid invented priorities and do not advertise unverified flows.
4. **End-to-end extension journey.** Re-pair/reload the unpacked extension and
   verify approval, evidence capture, BFCache navigation recovery, revocation,
   and duplicate-pairing prevention in the user's Chrome. Record observed
   results rather than expected results.
5. **Then revisit the larger product gaps:** Context Brief rendering,
   actor-separated audit, and grant expiry/revocation.

For each slice, Claude should stop after implementation and verification and
give Codex the exact changed files and evidence. Codex reviews only; Codex does
not silently repair the submitted slice unless the user changes this role split.

---

## 4. Why Hostinger cannot be solved by the probe alone

`hpanel.hostinger.com` passes the header probe and is then blocked by Chrome.
This is a limit of the technique, not a bug to find: **the probe's request is not
the browser's request.** Different user agent, no cookies, no session. An
authenticated dashboard answers a bare server-side GET differently from a
browser carrying a session. A header probe can prove a refusal; it cannot prove
the absence of one.

That is exactly why the fallback surface, not a better probe, is the answer. Do
not spend effort making the probe cleverer. It will keep being wrong for
session-dependent sites, and every increment of cleverness adds a way to be
confidently wrong.

---

## 5. Feedback worth carrying forward

Five review rounds on this feature, and the defect was one level beneath the fix
every single time:

| Round | I fixed | The defect was actually |
|---|---|---|
| 1 | claim composed from intent | URL *text* validated, not the destination |
| 2 | header probe added | "no blocking header" read as "it rendered" |
| 3 | IPv6 ranges listed | spellings compared, not address bytes |
| 4 | more ranges added | denylist was the wrong contract |
| 5 | allowlist adopted | `lookup` answered in the shape Node never uses |

The pattern: **I verified the layer I had just changed, and assumed the layer
underneath it.** Each fix was correct about its own concern and wrong about its
foundation.

Two practices that would have caught most of it, now added to my sweep:

1. **Boot both processes.** Lint, tests and build all pass with a server that
   cannot start and a client that never renders. Three of these defects were
   integration failures invisible to all three checks. `npm run dev` is cheap.
2. **Exercise the shape the runtime actually uses.** The `pinnedLookup` tests
   passed `{}` as options and so only ever tested the branch Node never takes.
   A test that agrees with the implementation's assumptions confirms nothing.

A related note on mutation testing, which I have been reporting as though it
proves coverage. It does not. It proves a guard is not vacuous. Injecting
mutations I thought of cannot find defects I did not think of, and twice a
mutation passed cleanly against a guard that turned out to be checking an import
line or a spelling. Worth reading my mutation counts as "these guards bite", not
"this is covered".

---

## 6. Also outstanding

- `test/repoSetupProposal.test.ts` hardcodes `/Users/Shailesh/MYAIAGENTS`, so it
  runs on one machine only.
- Context Brief read model is built and tested but not rendered. Deliberate;
  sequenced after the verification work.
- Actor-separated audit (human / agent-approved / agent-autonomous) is still the
  highest-value gap for the product's differentiator.
- Grant expiry and revocation for file and folder context is documented but
  absent from the verification record.
