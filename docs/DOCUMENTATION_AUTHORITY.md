# PaneTera Documentation Authority

**Status:** CANONICAL for documentation authority, status vocabulary, and
synchronisation rules
**Established:** 2026-09-12, against `dev` at
`7f124335624f7277d7a72ff337e86cfed1ea44b2`

PaneTera's implementation moved faster than its documentation. Documents that
agents were told to trust described capabilities as missing after they shipped,
and several directives kept claiming authority after their work was done. This
file says which documents are allowed to describe PaneTera, what each one owns,
and how they stay in step with the code.

A document is current authority only if this file names it as such. The
absence of a status banner does not make an older document current.

## How to read the documentation

1. This file: which document owns which truth.
2. [`docs/PANETERA_WORKSTATION_CONTRACT.md`](PANETERA_WORKSTATION_CONTRACT.md):
   what must be true.
3. [`docs/PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md`](PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md):
   who PaneTera is for, its object model, and its information architecture.
4. [`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`](CURRENT_IMPLEMENTATION_CHECKPOINT.md):
   what exists at a named development baseline, with evidence.
5. [`docs/adr/`](adr/) and [`docs/THREAT_MODEL.md`](THREAT_MODEL.md): why
   architectural decisions were made, and route-level security.
6. [`ROADMAP.md`](../ROADMAP.md): what happens next.

**The contract defines what must be true. The checkpoint defines what exists.
The roadmap owns what next.** Handoffs, directives, plans, and historical
documents never override these.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| CANONICAL | Normative authority for its stated domain. |
| CURRENT | Accurate current-facing reference, but not normative authority. |
| EXPERIMENTAL | Implemented or actively evaluated, but not accepted as a supported normative product capability. |
| DEFERRED | Intentionally not current scope. May be planned later. |
| SUPERSEDED | Replaced by a named current document or operating rule. |
| HISTORICAL | Preserved record of an earlier state. No longer current authority. |
| RETIRED | Former product, interface, or concept intentionally no longer active. |

These statuses describe documents and product capabilities. The checkpoint
uses its own factual states (such as VERIFIED or LEGACY SUPPORTED) to describe
implementation evidence; see that file.

## Authority model

Normative and factual authority are peers, not rungs on one ladder. They answer
different questions and must not restate each other.

```text
          NORMATIVE                          FACTUAL
  what must be true                  what exists at a commit
  ┌─────────────────────────────┐    ┌──────────────────────────────┐
  │ Workstation Contract        │    │ Current implementation       │
  │ Product Scope and IA        │    │ checkpoint                   │
  │ ADRs                        │    │ Frozen checkpoint snapshots  │
  │ Threat Model                │    └──────────────────────────────┘
  └─────────────────────────────┘
                     │
                     ▼
           PLAN: ROADMAP.md (what next)
                     │
                     ▼
     DERIVED: AGENTS.md, SECURITY.md, README.md, docs/DEVELOPER.md
                     │
                     ▼
           REFERENCE: design, architecture, and API documents
                     │
                     ▼
           HISTORICAL: preserved evidence, never authority
```

### Normative

**`docs/PANETERA_WORKSTATION_CONTRACT.md`** (CANONICAL)

- Owns product invariants, governance requirements, the workstation contract,
  and release acceptance conditions.
- Must not contain moving commit baselines, implementation inventories, or
  temporary implementation status.

**`docs/PRODUCT_SCOPE_AND_INFORMATION_ARCHITECTURE.md`** (CANONICAL)

- Owns the product thesis, audience, object model, information architecture,
  and long-term product boundary.
- Must not describe what happens to be implemented at the current commit.

**`docs/adr/*`** (CANONICAL for each recorded decision)

- Own architectural decisions and the reasons behind accepted technical
  invariants.
- A decision is changed by a new or amended ADR, never by editing another
  document around it.

**`docs/THREAT_MODEL.md`** (CANONICAL)

- Owns the route-level security model, trust boundaries, route security
  inventory, and security findings history.

### Factual

**`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`** (CURRENT)

- Owns what exists at one named development baseline, the evidence for each
  implementation claim, acceptance-verification status, the standing of
  implemented-but-not-accepted capabilities, and release and tag standing.
- Does not define product scope.

**`docs/checkpoints/*`** (HISTORICAL)

- Frozen snapshots of earlier checkpoints, preserved as found. A snapshot only
  ever gains a status banner; its body is never repaired or rewritten.

### Plan

**`ROADMAP.md`** (CURRENT)

- The sole owner of "what next". Other planning documents may hold detailed
  requirements or acceptance criteria, but they do not set sequencing and do
  not override the roadmap.

### Derived

These documents are written from the normative and factual sources and must
not introduce product truth of their own.

- **`AGENTS.md`**: agent operating rules.
- **`SECURITY.md`**: the current high-level security summary, indexing the
  Threat Model, ADR-002, the contract, and the checkpoint.
- **`README.md`**: public introduction and navigation.
- **`docs/DEVELOPER.md`**: setup and testing.

### Reference

Detailed design, architecture, and API documents, for example
`docs/RIG_MCP_CONNECTION_ARCHITECTURE.md`, `docs/COMPOSER_CONTEXT_CONTRACT.md`,
`docs/WORKSTATION_SHELL_ARCHITECTURE.md`, `docs/AGENT_RUNTIME_ARCHITECTURE.md`,
and `docs/API.md`. They are useful technical reference. Where one describes
itself as canonical or current, that claim is limited to its detail and never
overrides the normative or factual layers.

### Historical

Earlier MyAI Portal, Tessera, and PaneTera records stay at their existing
paths as evidence. A historical document may gain a status banner; its body is
not rewritten. It is never current authority.

## Resolving conflicts

- **What exists:** the code and tests at the named baseline decide. If the
  checkpoint disagrees with them, the checkpoint is wrong and must be corrected.
- **What must be true:** the contract and the ADRs decide. Code that contradicts
  them is either a defect or needs a new ADR; it does not silently change the
  contract.
- **What next:** the roadmap decides.
- **Anything else:** a document not named in this file is reference or
  historical material at most.

## Legacy names

Old names are not automatically stale. MyAI Portal is a retired product name and
Tessera a transitional one, but several identifiers that carry those names are
live runtime contracts and must not be renamed for brand consistency, including
`TESSERA_APP_DATA`, `TESSERA_LEGACY_DIR`, the `Tessera` application-data
directories, `getTesseraAppDataDir`, `/api/tessera`, the "Tessera Browser
Operator" MCP server name, `myai-workspaces.json`, `myai-policy.json`,
`myai-manifest.json`, `/api/myai-workspaces/*`, `SOOTHSAYER_PORTAL_EMBED_SECRET`,
and `SOOTHSAYER_LIVE_URL`. Renaming any of them is a versioned code migration,
not a documentation edit.

## Synchronisation rules

1. **ADR and contract.** When an ADR creates or changes a product or runtime
   invariant that a canonical contract represents, that contract is amended in
   the same PR.
2. **Routes and Threat Model.** Adding, removing, or remounting an HTTP route
   changes `docs/THREAT_MODEL.md` in the same PR.
3. **Authority and AGENTS.** When the authority model, a canonical contract,
   the checkpoint path, or the operating model changes, `AGENTS.md` changes in
   the same PR.
4. **Directives.** Agent directives and handoffs carry a status. When their work
   is completed or replaced, they are marked SUPERSEDED and name the replacement
   authority.
5. **Checkpoint.** Every PR that materially changes the shipped capability
   boundary states one of these lines in its description:

   ```text
   Checkpoint: updated
   Checkpoint: still valid
   ```

   A new immutable checkpoint snapshot is cut at meaningful milestone merges,
   not after every small commit.
6. **Code comments.** Code comments that refer to normative documentation cite
   current authority, not retired MyAI Portal contracts. Recorded follow-up:
   `server/execution/localShellAdapter.ts` and `server/execution/types.ts`
   still cite `docs/MYAI_PORTAL_CONTRACT.md`; they are corrected in a separate
   code change.
