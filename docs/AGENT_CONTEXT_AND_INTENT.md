# Agent Context and System Intent

**Status:** Active project guidance  
**Audience:** Coding agents, reviewers, and future maintainers  

---

## One-Sentence Intent

MyAI Portal is a governed single-door workbench where natural language opens
the right interactive project or application surface, while verified systems
own truth and humans approve execution.

---

## Suggested System Instruction for Project Agents

Use this when starting an agent on MyAI Portal work:

```text
You are working on MyAI Portal, a governed single-window workbench. Chat is the
entry door, but the product is the native workbench surface: live app embeds,
schema-driven forms, proposal cards, browser observations, and workspace
inspection panels.

Do not treat the LLM as the authority for app state. App truth must come from
deterministic sources such as /api/portal-manifest, /api/portal-workbench,
workspace APIs, signed live iframe URLs, or explicit browser-observation
payloads. If a source is missing, show degraded/unavailable state instead of
inventing data.

Never expose secrets to the client. Never collect cookies, localStorage,
passwords, auth headers, tokens, or API keys. Mutating work must be proposed
and approved before execution. Keep Soothsayer live embeds, app-native views,
and browser observations separate and clearly labeled.

Keep scope narrow. Improve the current contract and verify it before adding
new systems, card types, matchers, or execution adapters.
```

---

## Product Philosophy

ChatGPT-style chat is useful but too abstract for project and enterprise work.
MyAI Portal reduces friction by letting a user enter through natural language
and then immediately land in the right structured, interactive experience:

- a live deployed app
- a workflow starter form
- a workspace/repo proposal
- a command approval card
- a browser-observed page preview
- a compact evidence/history feed

This is closer to an MCP UI or app-store-like native experience than a plain
chat transcript. The model can guide and explain, but it must not own UI truth.

---

## Core Contract

The portal has three responsibilities:

1. **Explore:** Read workspaces, live apps, manifests, browser observations, and
   configured systems.
2. **Preview:** Render native cards and app-owned UI surfaces in the main
   workbench.
3. **Propose:** Prepare explicit approval cards for actions that may mutate
   local or remote state.

The portal should not silently execute, publish, deploy, mutate, or infer hidden
state.

---

## Live UI Contract

Soothsayer is the reference implementation for app-native sync.

Sources:

- `GET /api/portal-manifest`: static app facts and capabilities
- `GET /api/portal-workbench`: dynamic app-native views and schema forms
- `GET /portal-embed`: signed iframe auth bridge for the real live web UI

Rules:

- The live iframe belongs in the main workbench only.
- Feed cards should show compact summaries and an "open in workbench" path.
- Signed iframe URLs are short-lived and generated server-side.
- `SOOTHSAYER_PORTAL_EMBED_SECRET` must remain server-side.
- The portal must fail closed if embed origin does not match the configured app
  origin.
- iframe rendering is visual/interactive inspection, not source-of-truth
  extraction.

---

## Browser Observation Contract

Chrome/browser observation is "eyes", not authority.

Allowed:

- page title
- URL
- visible DOM outline
- screenshot preview
- selected non-secret visible text

Rejected:

- cookies
- localStorage/sessionStorage
- auth headers
- passwords
- tokens
- API keys
- hidden credential values

Browser observations must be labeled as browser-observed and remain read-only.

---

## Persona Lenses

Persona modes such as Engineer, PM, BA, QA, and Exec may reshape presentation:

- Engineer: routes, logs, source telemetry, build/test signals
- PM/BA: workflows, ownership, status, forms, decisions
- QA: verification, checks, risks, evidence
- Exec: summary, readiness, governance, blockers

They must not change authorization, backend filtering, secret access, execution
permission, or truth source selection.

---

## Anti-Patterns to Avoid

- Building another generic chat UI
- Adding cards that duplicate existing app-native views
- Making the feed the main place for rich UI
- Treating screenshots or LLM summaries as authoritative state
- Expanding matchers until real work prompts are hijacked
- Adding mutation buttons to preview-only cards
- Passing secrets to React
- Adding "temporary" arbitrary shell execution
- Hiding failures behind friendly copy

---

## Done Means

A change is done when:

- The intended natural-language flow opens the right workbench view.
- The source of truth is deterministic and visible.
- The feed remains secondary and compact.
- Mutation, if any, is behind explicit proposal/approval.
- Tests cover the contract or parser boundary touched.
- Manual verification confirms the UI is usable in the local portal.
