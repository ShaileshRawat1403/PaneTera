# PaneTera Use Cases and Capability Map

**Status:** Working document. Maps what people do to what exists.
**Companions:** `PANETERA_WORKSTATION_CONTRACT.md` (locked doctrine),
`PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md` (thesis and IA).

This document exists to keep three things honest at once: who PaneTera is for,
what a person actually does with it, and which of those things work today. Every
use case below carries a status, and the statuses are deliberately unflattering
where that is the truth.

## Positioning

> **One pane for your pain.**

PaneTera is a personal AI gateway. One window, one conversation, one
authoritative canvas, with auditability and observability sitting beside the
work rather than behind a settings page.

The useful frame is **a person's eyes and hands**:

- **Eyes.** Read, research, inspect, observe. See what an application is doing,
  what a page says, what changed in a project, what an agent looked at.
- **Hands.** Draft, produce, run, change. Do the work, or have it done.

Governance is what makes the hands lendable. Anyone will let a tool look. Fewer
will let it act. The difference is whether you can see what it did, refuse it
before it happens, and check afterwards.

### Audience

People-agnostic, deliberately. The product does not assume your artifact is
code.

A person stuck on onboarding design and a builder maintaining five repositories
are the same shape of user: both have a goal, some context, and a need to see
what happened. Software is the proving environment because it supplies
observable tools, live applications, diffs and execution boundaries. It is not
the boundary of the audience.

### The two operating modes

One axis, not two products.

| Mode | Initiative | PaneTera's job |
|---|---|---|
| Human executes, agent guides | You | Supply context, evidence, options, and the next useful question |
| Agent executes, human observes | Agent | Run bounded, show what happened, stop at the approval gate |

Both modes need the same substrate: bounded runs, evidence with provenance, an
approval gate, and an audit trail. That shared substrate is why one pane is
coherent rather than a slogan.

### What PaneTera is not

- Not a chatbot with integrations bolted on.
- Not a dashboard of every metric it can reach.
- Not an autonomous swarm.
- Not a developer IDE.
- Not a product whose pitch is "endless possibilities". The interesting claim is
  narrower: whatever it does, you can see it and refuse it.

---

## Status legend

| Status | Meaning |
|---|---|
| **Works** | Verified end to end by a person, in a real browser, recently |
| **Partial** | The path exists but something material is missing or unverified |
| **Planned** | Designed, not built |
| **Deferred** | Deliberately not now |

**"Works" is not inferable from source.** An earlier revision marked several
flows Works because each component along the path existed and had tests.
Components passing in isolation says nothing about whether the handoffs between
them hold.

**Nor is "Planned" inferable from source.** The revision that corrected the
above then made the opposite error: it read the codebase, did not find a
capability, and recorded it as unbuilt. `CURRENT_IMPLEMENTATION_CHECKPOINT.md`
is the canonical record of what has been accepted in the running product, and
it documents completed Chrome acceptance journeys for capabilities this document
called Planned. Both errors have the same cause, which is asserting status from
what one surface shows rather than from the project's own record.

**The rule, both directions:** status comes from the checkpoint's verification
record where one exists. Where it does not, the honest status is Partial, and
the gap is named precisely rather than by guessing which side of the line it
falls on.

---

## A. Eyes: research, reading, inspection

### A1. Dissect a specific article or page

*"Here is a link. What is this actually saying, and what should I take from it?"*

**Status: Partial.** Every component exists; the full chain is unverified.

Attach the address through `+ → Add web link`, or paste it and ask. The web
preview opens as an untrusted surface with no PaneTera authority. Browser
Operator inspects under explicit approval, and the extraction lands as evidence
with source, capture time and provenance.

The address validation *is* verified: credentials, non-web schemes, loopback,
private ranges and link-local targets are refused, at the entry surface and
again in the core, with tests that reproduce each bypass.

*Capabilities:* web link context, web preview surface, Browser Operator MCP
façade, evidence store, provenance validation.

**Observed failure, 21 July 2026, real Chrome.** Attaching
`hpanel.hostinger.com/websites/pruningmypothos.com/advanced` and asking to see it
produced the message "I opened … in the preview" while the canvas showed a blank
frame with a broken-document icon. The site refuses framing. Nothing had opened.

This is the clearest instance of the pattern this document keeps running into:
every component along the path worked, and the flow still failed, because the
claim was composed from the request rather than from a result. A blank canvas
under a success message is worse than an error, because it teaches a person to
distrust what PaneTera says about its own actions, which is the entire product.

*Fixed, in two passes.* The first replaced the request-time claim with a
server-side header probe. Review then found that this had reproduced the same
error one level down: absence of a blocking header became an outcome named
`framed`, which downstream read as "it rendered". It is not. Headers can permit
framing while a page refuses from inside itself.

What holds now:

- a header refusal is authoritative and renders an explicit degraded state
  naming the cause, with Browser Operator inspection or open-in-browser;
- the permissive outcome is named `permitted` and no message may claim the page
  opened, because that is not observable across origins. PaneTera reports what
  it did, which is place the page in the canvas;
- if nothing appears after six seconds, an assist strip appears *beside* the
  frame asking whether anything is visible and offering a way out. An earlier
  design flipped to a refusal verdict on that timer, which would have blanked
  any site slower than the budget;
- the probe validates the resolved destination, not just the URL text, and pins
  the connection to the validated address. A public hostname resolving to
  loopback or cloud metadata was previously a request-forgery route.

Covered by `test/webPreviewOutcome.test.ts` and `test/addressSafety.test.ts`.

**Chrome verification, 21 July 2026.** Two findings, one fixed and one structural.

*Fixed:* the SSRF pinning broke every probe. Node 20+ defaults
`autoSelectFamily` to true, which calls `lookup` with `all: true` and expects an
array of addresses; the pinned lookup always answered in the single-address
form. Node read the address string as the array and rejected it with
`ERR_INVALID_IP_ADDRESS`, so no probe ever succeeded. It surfaced as "did not
respond" for every site, including ones that frame perfectly well. The unit
tests passed `{}` as lookup options and so only exercised the shape Node never
uses in practice.

*Structural, and not fixed:* **the header probe does not catch
`hpanel.hostinger.com`.** It returns `permitted`, PaneTera frames the page, and
Chrome blocks it anyway. The reason is a limit of the technique rather than a
bug: the probe's request is not the browser's request. It carries a different
user agent, no cookies and no session, and an authenticated dashboard can answer
it differently from the browser. A header probe can prove a refusal; it cannot
prove the absence of one.

So the original screenshot case still produces a blank canvas, now for about two
and a half seconds until the assist strip offers Browser Operator and
open-in-browser. The transcript no longer claims the page opened, and it
discloses the blank-canvas possibility up front. That is mitigation, not a fix.

*Verified working:* `example.com` renders; the transcript says "I put … in the
canvas" rather than claiming it opened; the operator remedy correctly reads
"Connect Browser Operator in Rig" against a disconnected operator.

*Open:* whether the assist belongs on a timer at all. It currently appears on
pages that rendered perfectly, which is noise. Since cross-origin rendering is
not observable from the embedding page, the alternative is a permanent quiet
control in the preview toolbar rather than a timed prompt. Worth deciding before
this flow is called Works.

*Still unverified, and each is a handoff rather than a component:*

- the fix itself, in a real browser against a site that refuses framing;
- URL attachment actually reaching Browser Operator extraction;
- extraction actually landing as evidence the assistant can read;
- the assistant answering **from the page** rather than replying that it has no
  browser access.

**Deliberately not scheduled.** You hand it an article; it does not go looking.

### A2. Research a topic across sources

*"What is the current thinking on X?"*

**Status: Partial.**

The research pipeline exists with provenance-gated claims and an evidence pack
builder, so a claim that reaches you should be traceable to a source. What is
missing is the loop from research output into something you keep. See C1.

*Capabilities:* research session store, analysis provider, provenance validation
service, evidence canonicaliser.

*Gap:* no durable artifact at the end.

### A3. Inspect a project you have not opened in weeks

*"What is this, and what state is it in?"*

**Status: Partial.**

The project explorer is hierarchical, searchable and keyboard-operable. Static
structure scan and dependency mapping work for JS, TS and Python. File preview
and inspection trace exist.

*Gap:* no answer to "what changed since I last looked". That is the Context
Brief, section D.

### A4. Watch a live application while you use it

*"Show me the app and tell me what it is doing."*

**Status: Partial.**

A registered local application opens in the canvas through a signed embed.
Status reads Connected, Refuses embedding, Not configured or Unavailable in
plain language, never as an internal code, and this is covered by behavioural
tests. Guide mode is explicit: PaneTera observes, it does not act inside the
application.

*Capabilities:* live workbench surface, app registry, workbench toolbar.

*Gap:* asking for a live application does not automatically open the preview in
the canvas. The surface works once open; the intent does not reach it. Until
that lands, this is a thing you can do rather than a thing that happens.

### A5. See what the AI actually did

*"What did it read? What was refused? Why did it say that?"*

**Status: Partial.**

Every allowed and denied operation is written to an append-only audit log. The
transcript discloses inspected files, tools used with outcomes, citations, and
policy warnings.

*Gap:* the audit stream does not separate actors. See E1. This is the single
most important gap in the product, because observability is the differentiator.

---

## B. Hands: doing the work

### B1. Get unstuck on a design or product decision

*"I cannot figure out onboarding for my app."*

**Status: Partial.**

Converse with project context attached. Attach the relevant files or folders as
references. The assistant reasons over what you gave it and says what it
inspected.

*Gap:* retained understanding depends on the person pinning a capsule. Capsules
exist and resume (C1), so "ask again next week and you re-explain" is no longer
accurate as written. What is true is narrower: nothing carries understanding
forward unless you deliberately capture it, and a tool that only remembers when
asked will mostly be used by people who remember to ask.

### B2. Review a change before you commit to it

*"Is this diff safe? What does it touch?"*

**Status: Partial.**

Governed dry-run proposals exist. Commands are allowlisted, classified by risk,
and reach an approval gate that fires once on explicit approval.

*Gap:* proposals are shell-command shaped. A non-developer has no equivalent
"review this before it happens" surface.

### B3. Run something, with a gate in front of it

*"Run the tests."*

**Status: Partial.**

Resolves to a proposal, never a direct execution. The card names the command,
the project, the environment in plain language, and the risk classification.
Approve and run fires once, guarded against double submission, and the
single-fire latch is covered by behavioural tests rather than by inspection.

*Capabilities:* intent resolver readiness, submission plan boundary, proposal
card, execution adapters, audit.

*Gap:* the gate is well tested as a unit; the journey from typing "run the
tests" through to seeing output has not been driven by a person in a browser.
Backend idempotency, not the front-end latch, is the real boundary, and that has
not been exercised under a double submission in anger.

This one is closest to Works of anything in this document. It is held at Partial
for consistency with the standard above rather than because of a known defect.

### B4. Produce an asset from what you learned

*"Turn this into a brief / a page / a document."*

**Status: Planned.**

`DraftPreviewView` and `SchemaFormView` can render a draft in the canvas. What
does not exist is the loop: research evidence in, artifact out, artifact kept,
artifact traceable to its sources.

Shailesh named "research plus create an asset" as a representative non-developer
flow. He did not rank it. An earlier revision of this document called it "the
priority gap", which promoted an example into a priority without being asked.
Its position in the build order is now set by the priority list below rather
than by this section.

---

## C. Cross-cutting: context and memory

### C1. Resume a project without re-explaining

**Status: Partial.**

This document previously called capsules unbuilt. That was wrong. The checkpoint
records durable editable capsules for resumption, and a Chrome acceptance
journey that pinned an envelope into a capsule, edited and saved its objective
and decisions, resumed it, then deleted it.

*Verified:* capsule creation from a context envelope, editing objective and
decisions, resumption, deletion, and that deletion leaves no residual context
while immutable audit and provenance records are deliberately retained.

*Remaining:* capsules resume a session. Section B1's complaint, that project
understanding does not survive across sessions, is narrower than it was but is
not closed until capsules are routinely reached for rather than available.

### C2. Carry context deliberately, not accidentally

**Status: Partial.**

The `+` menu offers notes, projects, local files, local folders, web links and
MCP resources. Every attachment is a reference with `authority: 'none'`. Folders
are not enumerated. Files are not read at attach time. Chips disclose source,
access level, authority, freshness and inclusion state, and can be excluded
without being removed.

Attachments never pass through the intent resolver. Adding context and
expressing intent are separate inputs that meet only at submit. That separation
is verified by tests, as is the web link validation.

Per the checkpoint, file and folder context use the operating system picker and
stay distinct from durable registered-project selection. Native access is
represented by explicit, expiring, revocable grants, and Headroom stores redacted
metadata and digests rather than source material. An earlier revision of this
document called the picker unverified; the checkpoint contradicts that.

*Remaining:* the grant lifecycle at expiry and revocation is documented but its
behaviour in the running product is not recorded in the verification record.
That is the part still worth driving by hand.

### C3. Know how much context is loaded

**Status: Partial.**

Headroom is a real governed surface, not a placeholder. `/headroom` dispatches to
it. It records every submitted intent before work begins, measures exact material
bytes without inventing token precision, records exclusions and freshness, and
persists hashes and measurements rather than raw material. The composer likewise
never invents a token count or capacity percentage, because the tokenizer and
window are not known.

A Chrome acceptance journey inspected the exact envelope source and byte
accounting. An earlier revision of this document said Headroom lacked a real
surface; that was wrong.

*Remaining, per the checkpoint's release gate:* capacity accounting and
session/project resumption completeness. Headroom is item 6 of the pre-release
priorities because it is close, not because it is absent.

---

## D. Project and task status: the Context Brief

*"What is going on across my projects?"*

**Status: Partial. Read model built, not rendered.**

`src/context/contextBrief.ts` derives the brief as a pure function, with 55
tests. It is deliberately not wired to any surface yet.

Note that the checkpoint already records one-line work/now/attention/next
guidance verified in Chrome. This read model is the fuller form of that answer,
not its first appearance.

The read model encodes the restraint rather than leaving it to the renderer:

- only the active project and explicitly tracked projects can go stale, so a
  long list of dormant repositories stays silent;
- an unreachable project yields one honest `missing-capability` item instead of
  instructions to act inside something that cannot be opened;
- attention is bound to its containing project during derivation, so a nested
  item cannot redirect an action elsewhere;
- every action states its effect as a discriminated union, so the renderer never
  infers behaviour from a magic string;
- attention and running-project lists are bounded and reported with totals;
- malformed run counts, thresholds and future timestamps are normalised rather
  than propagated.

This is what a status dashboard should be in a product with one dominant
surface. It answers the four questions the information architecture already
requires:

1. What am I working on?
2. What is happening now?
3. What needs my attention?
4. What should happen next?

**Placement rules, from the locked contract.** It renders in the canvas when
asked, or opens as a contextual surface. It does not become a permanent third
pane, and it does not show every metric it can reach. Healthy projects stay
quiet. Attention appears only for an approval, an ambiguity, a failure, stale
context, weak evidence, a security boundary or a missing capability.

The distinction from the forbidden dashboard is selectivity and placement, not
existence.

*Remaining:* the canvas surface. Not started, and deliberately blocked until the
read model corrections above were verified, which they now are.

---

## G. Rig: external MCP connections

*"Connect a tool I already use, and govern what it is allowed to do."*

**Status: Partial, and further along than an earlier revision of this document
claimed.** It was listed as unbuilt and last in the build order. That was wrong:
roughly 1,700 lines of server implementation exist across fourteen routes, with
two test suites.

**What works today:**

| Piece | State |
|---|---|
| Rig panel surface | Built. Connection list, add form, stdio and HTTP transports |
| Connection lifecycle | Add, review, approve, refresh, stop, delete |
| MCP client runtime | Real transports; `listTools` with cursor paging, `callTool` |
| Capability permissions | Three-valued: denied, proposable, auto-invocable |
| Proposal and approval gate | Proposals created and approved before invocation |
| Transport security | Destination binding, governed stdio launch, keychain-backed secrets |
| Resources and prompts | Read and fetch routes |
| Provenance | Invocation provenance route |

**What remains:**

- End-to-end verification with a real third-party MCP server in a real browser.
  The routes have tests; the journey does not.
- `sourceClass` distinctions from `RIG_MCP_CONNECTION_ARCHITECTURE.md`
  (panetera-managed, local-user-installed, remote-external) reflected in the UI.
- Structural versus presentation digest handling on capability re-approval.
- ADR-002 stdio launch governance fully reconciled with the implementation.

---

## E. Auditability and observability

### E1. Separate human, approved and autonomous activity

**Status: Planned. Highest-value gap.**

Three categories, not two:

| Actor | Meaning |
|---|---|
| Human | You did it directly |
| Agent, approved | The agent did it, you authorised that specific action |
| Agent, autonomous | The agent did it within a capability granted earlier |

Two buckets loses the distinction between "I did this" and "I authorised this",
which is the one that matters when you look back and ask who decided.

The audit record already carries correlation IDs. It needs an actor field and
the authority under which the action ran, which `ApprovedCapabilityCall`
already supplies.

### E2. Trace a claim to its source

**Status: Partial.** Provenance-gated research claims and a browser evidence
graph exist. The graph is browser-specific by construction and needs the generic
provenance record interface before it can hold MCP invocations or context
envelopes.

---

## F. Deliberately deferred

| Feature | Why |
|---|---|
| Scheduled monitoring and news feeds | Not wanted. Article dissection is on demand |
| Autonomous multi-agent swarms | Contract non-goal |
| Infinite transcript as memory | Contract non-goal |
| Cloud multi-tenancy, mobile authoring | Outside V1 |
| Sub-agents | After governed delegation exists, not before |

**On sub-agents.** The end goal is a master orchestrator with sub-agents helping
manage context. The framing that matters: sub-agents must inherit the same
governance the main agent has, so delegation does not create a hole. A sub-agent
that can exceed a capability it was not granted is not a feature, it is a
bypass. That is why the generic provenance record and the capability registry
come first.

---

## Pre-release priorities

From the handoff, superseding any ordering implied by the sections above.
Reliability is the frame, not an eighth item: each of these is a thing that
exists and does not yet hold consistently.

1. Browser Operator reliable end to end.
2. Local file and folder selection actually usable.
3. Live preview activating automatically on request.
4. Adjustable panes.
5. Rig and MCP completeness.
6. Headroom completeness.
7. Robust auditability.

The shape of this list is the useful part: none of the seven is new capability.
All seven are completion, verification, or reliability of something already
built. That is consistent with what reconciling this document against the
checkpoint showed, in both directions. The remaining distance is not between
nothing and something, it is between something and something dependable.

## Release boundary

This document does not own the release gate. `CURRENT_IMPLEMENTATION_CHECKPOINT.md`
does, and an earlier revision here reduced its six conditions to two, which is
how a gate quietly loosens. Reproduced in full so the two cannot drift:

No release tag until all of the following are true **and have been accepted in
the running product**:

1. File and folder attachment use distinct native local-system selection and
   explicit, auditable scope grants; project selection remains a durable
   workspace operation.
2. Rig provides governed MCP connection records, discovery, capability review,
   resource attachment, approval, invocation, health, and audit according to
   `RIG_MCP_CONNECTION_ARCHITECTURE.md` and ADR-002.
3. Headroom provides durable bounded context, provenance, freshness, inclusion
   controls, capacity accounting, and session/project resumption without
   fabricated token precision.
4. The work/now/attention/next read model is usable without dashboard clutter.
5. The primary journeys pass automated checks and real Chrome UX and
   accessibility verification, with no known critical or high-severity defects.
6. Shailesh explicitly approves a named release candidate.

Additionally required by the current handoff: Browser Operator reliability,
automatic live-preview activation, adjustable panes, and governed invocation with
audit and provenance.

Intermediate commits may record reversible engineering progress. They are not
releases and must not be tagged as though they were.

## Build order

Sequenced to serve the priorities above, so each item is independently useful.

| # | Item | Serves | State |
|---|---|---|---|
| 1 | Canvas width floor | Contract invariant, priority 4 | Done |
| 2 | Context Brief read model | D, A3 | Done, not rendered |
| 3 | Browser Operator end-to-end verification | A1, priority 1 | Next. Needs a real browser |
| 4 | File and folder grant expiry and revocation | C2, priority 2 | Picker verified; grant lifecycle not |
| 5 | Automatic live-preview activation | A4, priority 3 | Not started |
| 6 | Rig completion and verification | G, priority 5 | Partial, see section G |
| 7 | Headroom capacity accounting and resumption | C3, priority 6 | Partial, surface exists |
| 8 | Actor-separated audit | E1, A5, priority 7 | Half-built |
| 9 | Context Brief rendering | D | Sequenced after verification, not blocked |
| 10 | Generic provenance record | E2 | Named in the checkpoint's remaining work |
| 11 | Research to artifact | B4, A2 | Example flow, not ranked |

Items 3, 4 and 5 need a browser and a person.

Context capsules are no longer in this list. They were item 12 on the assumption
they were unbuilt; the checkpoint records them as accepted in the running
product. Their remaining work is folded into item 7.

## Success measures

From the product scope, unchanged and worth restating because they resist
vanity metrics:

- Time from returning to a project to taking the next confident action.
- Reduction in repeated context explanation.

Not: number of agents, tasks completed, or tokens processed.
