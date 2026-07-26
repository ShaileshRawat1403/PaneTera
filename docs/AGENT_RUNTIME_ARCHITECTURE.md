# PaneTera Accountable Agent Architecture

**Status:** Foundation V0.1 implemented  
**Identity:** One PaneTera agent; many interchangeable reasoning engines

PaneTera is not bound to one model vendor. OpenAI, Google, Anthropic, local
models, and OpenAI-compatible endpoints are reasoning engines behind the same
accountable agent. They do not own permissions, execution, evidence, memory,
or product identity.

## Stable agent plane

The provider-independent plane owns:

- durable task/run identity and lifecycle;
- bounded context descriptors and provenance;
- capability inventory and typed schemas;
- policy, approval, cancellation, and execution boundaries;
- operational events suitable for transcript and canvas;
- evidence and verification state;
- provider selection, fallback policy, budgets, and telemetry.

A provider adapter receives instructions, bounded input, tool schemas, and
tool results. It returns text and structured tool calls. It cannot call a
browser extension, shell, filesystem, application, or connector directly.

```text
User → PaneTera runtime → provider adapter → reasoning model
              ↓                    ↑
        capability registry → deterministic adapter
              ↓
     policy → approval → execution → evidence → verification
```

## Provider contract

Every reasoning engine implements `AgentModelProvider`: a stable provider and
model identity, one generation operation, provider-native tool-call parsing
into PaneTera's common type, continuation support, cancellation, bounded
timeout, and explicit errors rather than silent substitution.

The first production adapter uses OpenAI's Responses API. Google
GenerateContent, Anthropic Messages, local/Ollama, and generic
OpenAI-compatible adapters join the same contract in later slices. Existing
legacy chat fallbacks are compatibility paths and must not receive new agent
capabilities.

## Runtime lifecycle

Foundation V0.1 persists:

```text
queued → planning → running → completed
                         ↘ waiting-approval
                         ↘ failed
                         ↘ canceled
restart of active work  → interrupted
```

It records operational truth—context count, provider/model, capability use,
approval need, outcome, and failure—not model-private chain-of-thought.
Attached material remains ephemeral; durable state contains a user-visible
objective and redacted context descriptors.

Authenticated APIs:

- `POST /api/agent/runs`
- `GET /api/agent/runs/:runId`
- `GET /api/agent/runs/:runId/events`
- `POST /api/agent/runs/:runId/cancel`
- `POST /api/agent/runs/:runId/approve`
- `POST /api/agent/runs/:runId/reject`

General chat uses this runtime when a governed provider is configured while
preserving its response contract and adding run identity, status,
provider/model, tool disclosures, and operational events.

Operational SSE frames use the durable agent event ID as their SSE `id`.
Automatic EventSource reconnects send `Last-Event-ID`; PaneTera replays the
subsequent durable events in original order. An unknown or retired cursor
produces an explicit continuity warning instead of silently implying a
complete history.

Browser action records are stored separately under local PaneTera application
data. Dispatch tokens are memory-only and never enter that file. A restart
preserves a fresh unapproved proposal for review but invalidates its prior
preview, and converts approved and dispatched actions to `interrupted`;
neither can dispatch or repeat without fresh authority. Before approval, a
separate memory-only,
single-use preview credential lets only the bound extension revalidate and
highlight the exact target. Preview failure remains authoritative and keeps
approval unavailable.

## Provider routing policy

Provider choice will be explicit and inspectable. Routing may consider task
class, tool support, context limits, latency, cost, privacy boundary, and user
preference. It may not silently switch vendors after a failure. A fallback
must be declared by policy and surfaced as an event before it occurs.

Secrets remain server-side. Prompts, logs, event data, browser observations,
and audit records must never contain API keys.

## Next runtime slices

1. Persist explicit plan steps, observations, evidence links, budgets, and
   verification outcomes.
2. Generalize same-run approval continuation beyond browser actions.
3. Add pause/resume and checkpoint recovery without replaying side effects.
4. Implement Google, Anthropic, local, and OpenAI-compatible adapters with
   contract tests.
5. Move workspace orchestration onto the shared capability registry.
6. Add model routing in Rig with data-boundary, cost, and fallback policy.
7. Add event retention, cursor-expiry policy, and corrupted-state recovery.
