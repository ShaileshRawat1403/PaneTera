# Composer and Context Contract

**Status:** Approved direction, revisions applied.
**Revision:** 2
**Depends on:** `PANETERA_WORKSTATION_CONTRACT.md` (canonical)
**Scope:** The composer surface, context attachment, and the Headroom envelope.
**Explicitly out of scope:** implementation, file cleanup, registry migration.

## Purpose

The composer is the single door. Everything a user brings into the work and
every intent they express passes through it. This document defines what the
composer accepts, what a context item is, and what is transmitted with a
message.

## Governing principle

> Adding something as context does not grant it authority.

Attaching a folder lets PaneTera read allowed content within it. It does not
let an agent modify it. Connecting an MCP server exposes declared capabilities.
It does not permit invocation. Access and authority are separate fields on
every context item and are never inferred from one another.

## The three input mechanisms

The composer has exactly three, and they are not three systems.

1. **Natural language** is the default path.
2. **`/` actions** are typed shortcuts to explicit intent.
3. **`+` attachments** bring objects into the work.

### Critical constraint: slash actions are not a command system

`/open pruningmypothos.com` and `open pruningmypothos.com` must produce the
identical `IntentEnvelope`. The slash menu is a typed front door to the same
resolver, not a parallel router.

If slash commands get their own handler, PaneTera acquires a fifth intent path
alongside the four that already exist (client web-preview matching, client
general/workspace routing, server orchestrator classification, deterministic
server fallbacks). That is the failure this contract exists to prevent.

The difference between the two forms is where classification happens, not where
execution happens:

| Input | Intent family | Readiness |
|---|---|---|
| `/open <url>` | asserted by the user, classification skipped | still evaluated |
| `open <url>` | resolved by deterministic matcher or model | still evaluated |

A slash action asserts the family. It does not assert readiness. `/run tests`
still resolves to `needs approval` and produces a `ProposedAction`. It never
becomes a shell call because a slash preceded it.

### Slash vocabulary

Initial set, all mapping to existing intent families:

| Command | Intent family |
|---|---|
| `/open` | open a web surface or registered application |
| `/project` | choose, resume, or inspect a project |
| `/inspect` | inspect attached or selected context |
| `/run` | propose a governed action requiring approval |
| `/evidence` | inspect evidence or changed understanding |
| `/rig` | configure or inspect the Rig |
| `/headroom` | inspect or refresh Headroom |
| `/clear-context` | drop context items without deleting source data |
| `/help` | show actions valid in the current state |

`/tool <namespace>.<name>` and `/resource <namespace>/<id>` are a deferred
power-user layer. Raw MCP vocabulary must not become the default interface. It
is added only after the Rig registry exists and only behind an explicit
advanced mode.

### `+` attachment menu

File, folder, project, image or screenshot, webpage, pasted text or note,
recent evidence, MCP resource, live application.

Models, agents, servers, and permanent connections do not appear here. They
belong to Rig. The `+` menu means "bring this into this conversation." Rig
means "this is connected to my workstation." Conflating them is how the
composer becomes a settings panel.

## Context item model

Every attachment becomes a context item with this shape. Chips render a subset
of it.

```ts
interface ContextItem {
  id: string;
  kind: 'file' | 'folder' | 'project' | 'image' | 'web' | 'note'
      | 'evidence' | 'mcp-resource' | 'live-app';
  label: string;              // human-readable, shown on the chip
  source: ContextSource;      // provenance, see below
  access: AccessLevel;        // what PaneTera may read
  authority: 'none';          // V1 invariant, always none
  materialization: Materialization;
  freshness: Freshness;
  included: boolean;          // included in the next message
}

interface ContextSource {
  origin: 'local-fs' | 'workspace-mcp' | 'browser-observation'
        | 'external-mcp' | 'user-input';
  locator: string;            // path, URI, capture id, resource uri
  connectionId?: string;      // when origin is external-mcp
  capturedAt?: string;        // ISO8601, when the content was read
}

type AccessLevel = 'reference-only' | 'read-scoped';
```

`read-full` is removed. It had no precise definition, and in practice it meant
"read-scoped where the scope is large," which is a scope size rather than a
distinct access level. Two levels are sufficient for V1: either PaneTera may
read within a declared scope, or it holds a name and no read authority.

`authority` is typed as the literal `'none'` in V1. Widening it is a contract
change requiring an ADR, not a code change.

### Materialization: the folder problem

A chip is a reference. What is sent to the model is a materialized subset
chosen at send time. These are different things and conflating them is how a
folder attachment silently injects thousands of files.

```ts
type Materialization =
  | { mode: 'inline'; measurement: Measurement }            // fully sent
  | { mode: 'retrieved'; strategy: RetrievalStrategy;       // sent on demand
      lastRetrieved?: string; itemsRetrieved?: number;
      measurement: Measurement }
  | { mode: 'reference' };                                  // name only

type Measurement =
  | { unit: 'tokens'; value: number; tokenizerId: string }
  | { unit: 'bytes'; value: number }
  | { unit: 'not-measured' };
```

`Measurement` is the same union used by `MaterializedRecord`. An exact token
count is optional because it requires the active model's real tokenizer, and
`tokenizerId` records which one produced it. Bytes may additionally be recorded
as integrity metadata regardless of unit, but a byte count is never presented as
a token count.

Rules:

- A **file** under the inline threshold materializes `inline`.
- A **folder** or **project** materializes `reference` by default and upgrades
  to `retrieved` only when the resolved intent needs its contents.
- Retrieval is performed by the workspace MCP adapter under host policy. The
  composer does not read the filesystem directly.
- What was actually retrieved is recorded in the envelope. A user must be able
  to ask "what did you actually look at" and get a truthful answer.

### What `+ File` and `+ Folder` may reach

Routing retrieval through the workspace MCP adapter only answers the question
for paths inside a registered workspace. A file picker can return anything on
the disk, and the contract must say what happens then.

V1 permits two sources and no others:

1. **Registered workspace paths.** Retrieval through the existing adapter under
   host policy, unchanged.
2. **Explicit temporary attachment scope.** A user-selected file or folder
   outside any registered workspace creates a narrow, named, expiring read scope
   covering exactly the selected path.

```ts
interface TemporaryAttachmentScope {
  scopeId: string;
  root: string;                     // the exact selected path
  recursive: boolean;               // false for a file, user-set for a folder
  createdAt: string;
  expiresAt: string;
  createdBy: 'user-picker';         // never inferred, never model-initiated
}
```

**A file picker never registers a workspace.** Selecting
`~/clients/acme/notes.md` grants a scope over that file. It does not register
`~/clients/acme`, and it does not register `~/clients`. Silent scope widening
from a picker is how an attachment gesture turns into standing filesystem
access, and the user would have no reason to expect it from the gesture they
made.

Temporary scopes expire and are individually revocable. They are subject to the
same host policy path rules as workspace access, so a temporary scope cannot
reach a denied path merely because a user selected it.

**They belong to Headroom and context permissions, not to Rig connections.** A
temporary scope is a bounded read grant attached to conversational context, not
a connected capability. Listing it among connections would imply persistence and
standing capability that it deliberately does not have. Rig may surface active
scopes in a security inspection view, which is a different thing from listing
them as part of the Rig itself.

### Freshness

The workstation contract forbids fabricated precision. Freshness uses the same
three truthful states and nothing finer:

```ts
type Freshness = 'current' | 'needs-review' | 'stale' | 'not-measured';
```

- `current`: revalidated within the item's validity window.
- `needs-review`: the underlying source changed since capture.
- `stale`: past the validity window, or the source is unreachable.
- `not-measured`: no revalidation mechanism exists for this kind yet.

`not-measured` is required. Without it, unmeasurable items get silently labeled
`current`, which is the fabrication the contract prohibits.

Freshness rules differ by kind, according to what PaneTera can actually observe.

**Local files** revalidate on mtime.

**Public web previews** are point-in-time captures and are `not-measured` by
default. PaneTera cannot observe navigation inside a cross-origin public iframe,
so a rule keyed on "subsequent same-origin navigation" would assert an
observation it does not have. The permitted transitions:

- `not-measured` on capture, and it stays there absent a verified observation
  mechanism;
- `stale` on expiry of the item's validity window, which is time-based and
  therefore observable;
- `needs-review` only when a known new capture of the same target exists.

**Browser Operator evidence** may use stronger rules, because it has explicit
capture lineage, a paired extension, and a known capture identity. Same-origin
recapture is observable there and may drive `needs-review` directly.

**MCP resources** are `not-measured` by default. Snapshot on explicit
attachment, refresh explicitly, and use server subscriptions only where the
server supports them and PaneTera has validated the mechanism.

## Chip disclosure

Each chip exposes, on inspect:

- source and provenance;
- access level;
- freshness state and what drove it;
- whether it is included in the next message;
- Headroom impact;
- remove and inspect actions.

Chips are removable and toggleable without deleting source data.
`/clear-context` drops all items and touches nothing on disk.

## Headroom impact, measured only

Report what is actually measurable and label the rest honestly. An exact token
count requires the active model's real tokenizer. PaneTera has that only when
the Rig model record supplies one, which for remote provider models it usually
does not.

The measurement ladder, in descending order of honesty:

1. **Tokens**, when the active model's tokenizer is available locally. Reported
   as an exact count.
2. **Bytes**, when it is not. Reported as bytes and labeled as bytes. A byte
   count converted to tokens by a ratio is an estimate wearing a count's
   clothing and is prohibited.
3. **`not-measured`**, when neither applies.

Per materialization mode:

- `inline` items: measured before send, at the best available rung.
- `retrieved` items: measurement of what was actually retrieved on the last
  turn, labeled as historical. No prediction for the next turn.
- `reference` items: the bounded label and locator metadata only, which is
  small but not zero.

Headroom's aggregate state remains `Current` / `Needs review` / `Stale` per the
workstation contract. The measured figure is a supporting detail on inspect, not
a permanent gauge in the composer. A percentage-of-window figure is permitted
only when both the active model's context window and its tokenizer are known.
It is otherwise omitted, not guessed.

## The Headroom envelope

Every message transmits one envelope. It is the audited record of what PaneTera
knew when it acted.

```ts
interface HeadroomEnvelope {
  envelopeId: string;
  createdAt: string;
  projectId: string | null;
  objective: string | null;

  intent: IntentEnvelope;           // see below
  context: ContextItem[];           // items with included === true
  materialized: MaterializedRecord[]; // what was actually sent
  exclusions: Exclusion[];          // what was deliberately withheld

  model: { connectionId: string; modelId: string } | null;
  capabilitiesOffered: string[];    // namespaced tool ids the model could see
}

interface Exclusion {
  itemId: string;
  reason: 'user-excluded' | 'policy-denied' | 'over-threshold'
        | 'stale' | 'unreachable';
}
```

`exclusions` is not optional. A silent omission is indistinguishable from a
missing capability, and the workstation contract requires honest degraded
states rather than blank success.

`capabilitiesOffered` records which namespaced tools were visible to the model
on this turn. This is what makes a later audit answer "why did it try that."

### Envelopes are auditable, not replayable

An envelope records locators, not content. Locators are mutable: a file changes,
a page is edited, an MCP resource is revised. So an envelope answers "what did
PaneTera reference when it acted," which is an audit property, and does not
answer "what exactly did it see," which is reproducibility.

Reproducibility requires immutable material: either content snapshots or
content hashes recorded per materialized item. Hashes are the cheaper default.
They cannot reconstruct the input, but they can prove whether it changed, which
is what most later questions actually need.

Two hashes are required per materialized item, because they answer different
questions:

```ts
interface MaterializedRecord {
  itemId: string;
  sourceDigest: string;             // over the original bytes at the source
  materializedDigest: string;       // over exactly what the model received
  mode: 'inline' | 'retrieved';
  measurement: Measurement;         // tokens, bytes, or not-measured
  truncated: boolean;
}
```

`sourceDigest` detects upstream change: the file was edited, the page was
revised. `materializedDigest` detects change introduced by PaneTera itself
through truncation, normalisation, or retrieval selection. A single digest
conflates the two, and the resulting answer to "did this change" is ambiguous in
exactly the cases where it matters.

**Replay never means automatic re-execution.** Replaying an envelope
reconstructs the context view for inspection. Re-running the work is a fresh
intent, subject to fresh approval.

Envelopes cannot simply persist alongside browser evidence. The existing
`EvidenceGraphResolver` resolves a hardwired capture, extraction, and evidence
triple and fixes trust to `"browser-dom"`. It has no shape for an envelope. This
depends on the generic provenance record interface defined in
`RIG_MCP_CONNECTION_ARCHITECTURE.md`, which is sequenced before registry work
for exactly this reason.

### Envelope storage is sensitive

An envelope containing only locators is still disclosive. Absolute local paths
leak directory structure, usernames, client names, and project names. MCP
resource locators can embed identifiers and occasionally credentials.

Storage requires:

- redaction of credential-shaped values in locators before persistence;
- path presentation relative to a project root, with absolute paths held only
  where genuinely needed;
- a declared retention window;
- exclusion from any export or diagnostic bundle unless explicitly requested.

## Intent envelope

Both natural language and slash actions compile to this. It is the single
resolver output and the seam Codex proposed for staged migration: route the
existing `/api/chat` and `/api/orchestrator/chat` through one intent service
behind compatibility adapters, migrate callers, and remove the redundant route
only after equivalent behavior is proven.

There are **ten** canonical families, listed in the workstation contract.
Composer-local behaviours such as help are expressed as an `action` within a
family, never as an eleventh family, so that the canonical vocabulary does not
grow because the UI needed something.

### Which families have both doors

Equivalence is a claim about specific (family, action) pairs, not about the
whole vocabulary. Each natural-language matcher is added deliberately, because
a loose one swallows real work prompts, which AGENTS.md records as a known
failure.

| Family | Action | Slash | Natural language |
|---|---|---|---|
| `web-surface` | open | `/open <url>` | yes |
| `web-surface` | close, reload | not yet | yes |
| `run` | propose | `/run <target>` | yes, leading verb only |
| `project` | select | `/project <name>` | yes, requires the word "project" |
| `artifact` | inspect | `/inspect <target>` | yes, leading verb only |
| `live-app` | open | `/open <app name>` | not yet |
| `evidence`, `rig`, `headroom` | — | yes | not yet |

Pairs absent from the natural-language column are slash-only. That asymmetry is
recorded here rather than implied, and `DUAL_DOOR_FAMILIES` in
`naturalLanguageSelectors.ts` is its machine-checkable counterpart.

`/open` covers both public pages and registered applications, so a non-URL
argument routes to `live-app` rather than reporting a missing URL. An argument
that was URL-shaped but rejected — credentials, a private address, a non-web
scheme — stays a refused `web-surface` intent. Rejection must not become
reinterpretation, or a security refusal silently turns into a different action.

```ts
interface IntentEnvelope {
  family: IntentFamily;             // the ten canonical families
  readiness: 'ready' | 'needs-clarification' | 'needs-context'
           | 'needs-capability' | 'needs-approval';
  assertedBy: 'user-slash' | 'deterministic-matcher' | 'model-classifier';
  confidence: number | null;        // null when assertedBy is user-slash
  missing: MissingRequirement[];    // drives the smallest useful question
  surface: CanvasSurface | null;    // which renderer, when ready
}
```

Deterministic routing owns safety-critical and explicit surface intents. Model
classification assists ambiguous language only. `assertedBy` makes that
boundary auditable rather than assumed.

`missing` exists so PaneTera asks the smallest useful clarification. A missing
URL is a `needs-context` with one missing requirement. It must never surface as
a workspace error.

## Composer layout

```
┌───────────────────────────────────────────────────┐
│ [PaneTera project ×] [App.tsx ×] [pruningmypothos ×] │
│                                                   │
│ Ask PaneTera, type / for actions…                 │
│                                                   │
│  [+]  Headroom: Current                  [Send]   │
└───────────────────────────────────────────────────┘
```

No permanent panel for files, context, shortcuts, or MCP tools. The composer
reveals these contextually. One dominant surface, one conversation, one next
action.

## Acceptance criteria

A composer implementation is acceptable when:

1. For every (family, action) pair marked dual-door above, the slash form and
   the natural-language form produce identical decision-bearing fields:
   `family`, `readiness`, `missing`, `surface`, and `args`. The three fields
   that legitimately differ are `assertedBy`, `confidence`, and `rawInput`,
   which are precisely the record of which door was used. `intentDecision()`
   projects an envelope onto the decision-bearing subset for this comparison.
2. No slash command reaches an execution path without passing readiness
   evaluation.
3. Attaching a folder of 5,000 files adds zero materialised file-content tokens
   to the next message. Its bounded label and locator metadata do enter the
   envelope, and that is the only permitted contribution.
4. Every message produces a persisted envelope whose `materialized` record
   matches what was actually transmitted.
5. `exclusions` is populated whenever an included item is withheld.
6. No context item can be constructed with `authority` other than `'none'`.
7. Freshness never reports `current` for a kind with no revalidation mechanism.
8. Removing a chip mutates no source data.
9. Headroom never reports a token count derived from a byte-to-token ratio.
10. Envelope persistence redacts credential-shaped values in locators.
11. Replaying an envelope performs no invocation.

## Resolved questions

1. **Inline threshold.** Host policy owns the hard maximum. The composer may
   choose a lower working threshold, never a higher one. Policy is authoritative
   and the composer's choice is a preference within it.
2. **Envelope retention.** Session-scoped by default, with explicit pin to
   retain. Redacted audit metadata persists longer than the envelope itself, so
   the durable record answers who did what without holding a durable map of the
   user's filesystem.
3. **Unconnected slash capability.** `needs-capability`, followed by an explicit
   Rig connection offer. PaneTera never automatically installs or connects
   anything, and the offer is a user decision surfaced in the right place rather
   than an error.
4. **Content hashes.** Both. `sourceDigest` over original bytes and
   `materializedDigest` over exactly what the model received.

## Open questions

1. Does a temporary attachment scope survive a session, or expire with it?
   Session-scoped is safer and will annoy anyone re-attaching the same external
   folder repeatedly.
2. When a folder is attached as `reference` and later retrieved, does the
   retrieval selection itself need provenance beyond the materialized record?
   Arguably yes, because "which files did it choose and why" is a different
   question from "what did it read."
