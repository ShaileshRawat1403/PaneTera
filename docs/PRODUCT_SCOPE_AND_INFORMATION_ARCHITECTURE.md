# Product Scope and Information Architecture

**Product name:** PaneTera
**Repository name:** `PaneTera`
**Status:** Canonical product scope

> **PaneTera gives your rig the headroom to work, with one clear pane for
> context, action, evidence, and judgment.**

## Current product boundary

PaneTera currently ships the workstation foundation: one conversation, one
authoritative canvas, contextual project/Activity/Audit controls, a governed
composer with transient attachments, strict public website preview, registered
local-application viewing, and existing proposal/evidence paths.

The full capability list later in this document is the V1 destination, not a
claim that every item is already implemented. In particular, arbitrary MCP
connections, a general Rig registry, MCP-resource attachment, durable Headroom
capsules, and the work/now/attention/next read model remain deferred. Their
absence must be represented honestly rather than as disabled menu rows.

The executable checkpoint is recorded in
`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`.

## Canonical naming

**PaneTera** is the locked product name. Preserve this spelling and
capitalisation in product-facing UI and documentation. The name combines the
single-window **pane** with the energy of **Pantera** and the scale suggested by
**tera**. The wordplay is intentional; do not restyle it as Pantera, PanTera,
Panetera, or Pane Terra.

PaneTera is the containing product. The supporting vocabulary describes how it
works and must not be promoted into competing product names:

- **your rig:** the user's configured models, agents, applications, tools, and
  MCP-style connections;
- **headroom:** bounded capacity for relevant context, human judgment, and safe
  experimentation;
- **signal chain:** evidence and provenance across inputs, actions, and results;
- **soundcheck:** validation before consequential use or execution;
- **Stage:** the dominant live canvas;
- **Control Room:** attention, approval, governance, and audit surfaces.

Use plain-language companion labels until the metaphor is self-explanatory. The
metaphor must reduce cognitive load, not turn the interface into themed jargon.
Tessera, Soothsayer, Rook, and DAX remain connected instruments or products in
the wider stack; none is the parent brand of PaneTera.

## Product thesis

PaneTera is a local-first, domain-agnostic human–AI workstation for anyone
who builds, researches, creates, operates, analyses, or makes decisions across
multiple projects.

Software development is an important proving environment because it supplies
observable tools, live applications, tests, diffs, and execution boundaries. It
is not the product boundary. The same workstation model must support a founder,
researcher, designer, writer, analyst, operator, educator, or other AI-assisted
builder without assuming that their primary artifact is code.

The scarce resource is human attention and retained understanding, not agent
output. The product optimises the time from returning to a project to taking the
next confident action.

## Primary information architecture

Every active project or task must be able to answer six questions:

1. **What am I working on?**
   - Project, objective, current task, context capsule, and active surface.
2. **What is happening now?**
   - Human or agent activity, run state, current operation, elapsed time, and
     live output when available.
3. **What needs my attention?**
   - Ambiguities, approvals, failures, conflicts, stale context, weak evidence,
     and degraded integrations.
4. **What should happen next?**
   - Recommended action, rationale, consequences, authority required, and safe
     alternatives.
5. **What evidence lets me trust this?**
   - Source material, previews, observations, tests or checks where applicable,
     provenance, independent review, and audit history.
6. **What changed in my understanding?**
   - New facts, assumptions, relationships, decisions, risks, constraints,
     dependencies, contradictions, and unresolved questions.

These are not six permanent panels. They are six required answers distributed
through a progressive attention hierarchy.

## Attention hierarchy

### Glance

The default view answers work, now, attention, and next in a compact brief. A
healthy system stays quiet.

### Work

Persistent conversation and one dominant active canvas hold the current task,
interactive artifact, native UI, live application, document, research surface,
proposal, or result.

### Inspect

Evidence, history, audit, detailed health, provenance, memory, and past runs are
available on demand without permanently reducing the work surface.

## Locked workstation UX doctrine

The workstation is governed by one sentence:

> **One dominant surface, one conversation, one next action.**

Only conversation and the authoritative canvas are permanently visible. Every
other surface must earn visibility through present relevance. Healthy systems
stay quiet; empty drawers, integrations, metrics, and status summaries must not
consume permanent space.

The six product questions are an information architecture, not six dashboard
panels. Use progressive disclosure:

| Product question | Canonical presentation |
| --- | --- |
| What am I working on? | Top bar: current project or workspace and objective |
| What is happening now? | Compact run-state line near conversation |
| What needs my attention? | Conditional interruption shown only when action is required |
| What should happen next? | One recommended action near the composer or canvas |
| What evidence lets me trust this? | Contextual Activity or Evidence surface |
| What changed in my understanding? | Contextual session brief or change record |

The default view should answer work and now. Attention appears only for an
approval, blocking ambiguity, failure, conflicting or stale evidence, security
boundary, or a required disconnected capability. Evidence, history, audit, and
changed understanding remain available on demand.

Conversation and canvas must not compete with duplicate onboarding. Conversation
invites intent; the canvas identifies the authoritative surface or offers one
concise way to choose it. Empty canvas design must feel intentionally ready for
work rather than like an empty dashboard or unfinished webpage.

## Domain-agnostic object model

- **Project:** durable container for goals, people, agents, tools, artifacts, and
  knowledge.
- **Goal:** desired outcome and success conditions.
- **Task:** bounded unit of work with an owner, state, and next action.
- **Context capsule:** curated, bounded summary required to resume confidently.
- **Surface:** the active interactive representation of an artifact or system.
- **Run:** bounded human or agent attempt with identity, authority, and state.
- **Evidence:** source-backed material supporting an observation or decision.
- **Decision:** accepted judgment with rationale and consequences.
- **Attention item:** condition requiring human judgment or intervention.
- **Next action:** explicit recommended continuation with required authority.

Code files, documents, designs, datasets, plans, applications, campaigns, and
research collections are domain-specific artifact types beneath this model.

## Context capsule

Context is compiled, not accumulated. Each active project or task should maintain
a bounded capsule containing:

- objective and success criteria;
- current state and active surface;
- important facts and assumptions;
- decisions and rationale;
- artifacts and systems touched;
- current human and agent activity;
- evidence and confidence;
- risks, blockers, and ambiguities;
- pending approvals;
- next actions;
- freshness and provenance.

Raw chat, logs, and event history remain available as evidence. They are not the
default memory presented to a returning user or agent.

## Human–agent operating model

Humans and agents participate in one lifecycle rather than separate modes:

```text
intent → context → plan → bounded run → evidence → attention/approval
       → result → verification → decision → updated context capsule
```

The UI may allow human-led, agent-assisted, or agent-running work. Those choices
change initiative and authority, not application truth or policy.

## Product capabilities

- Persistent conversational control plane.
- Dominant interactive canvas for structured and live surfaces.
- Multi-project context and resumption.
- Bounded agent/run observation.
- Attention routing and approvals.
- Evidence, provenance, and audit.
- Context capsules and decision history.
- Pluggable domain connectors and MCP-style structured surfaces.
- Delegated governed execution through adapters rather than arbitrary client or
  model authority.

## Non-goals

- A developer-only IDE replacement.
- A generic chatbot with integrations.
- A dashboard showing every available metric and system.
- Infinite transcript storage presented as memory.
- An orchestration engine embedded in the frontend.
- A promise that agent review alone constitutes independent assurance.
- Maximum agent, task, or output throughput as the primary success metric.

## Product sequence

1. **Workstation shell:** persistent conversation, dominant canvas, contextual
   drawers, and quiet governance.
2. **Context brief:** read model answering work, now, attention, and next.
3. **Evidence and understanding:** attach evidence and changed-understanding
   records to tasks and decisions.
4. **Context capsules:** bounded resumption for humans and agents.
5. **Governed action:** proposals, authority, execution, verification, and audit.
6. **Domain ecosystem:** reusable connectors, surface renderers, and templates
   for different kinds of builders.

## Success measures

- Time from project return to confident next action.
- Reduction in repeated context explanation.
- Percentage of consequential claims with inspectable evidence.
- Percentage of runs with an explicit outcome and next action.
- Time spent resolving attention items rather than searching for them.
- User ability to explain the current system/project after agent-led work.
