# ADR-005: Intent and Proposal Fidelity

## Title
An approval authorizes one immutable, validated proposal, and that proposal
is derived from the person's resolved intent. Nothing that was not reviewed
can execute.

## Status
Accepted on 2026-09-10. Applies to every Rig capability. The failures below
were found in the Blender and REAPER integration experiment (tag
`integration/blender-reaper-governed-poc-2026-09-11`); the decision is
platform-wide.

Core PaneTera enforces decisions 1-4 and 6-9 for every Rig capability.
Decision 5, routing resolved intent to a proposal, ships with the first
integration that needs it; core adopts that machinery only once a second
consumer proves the abstraction.

## Context

The Rig approval gate was real, but what passed through it was not always
what the person asked for or what the reviewer saw:

1. `handleApproveAction` in `src/App.tsx` built `blender.add_modifier` with a
   hard-coded `objectId: 'Cube'` while the card named a different object, then
   proposed, approved, and invoked from a single click.
2. `App.tsx` produced proposals from keyword matching (`includes('bevel')`)
   rather than from the intent resolver.
3. `POST /api/rig/proposals` stored any object without checking it against the
   capability's input schema, so unexecutable proposals entered the queue.
4. An invocation executed the arguments the caller sent. The approval's
   argument digest had to match, but the server never executed a stored copy,
   and a reviewer in RigPanel was shown an editable field, not the proposal.
5. Surface actions such as "Add Modifier" proposed with no arguments at all.
6. The assistant instruction advertised tools that do not exist and described
   scene contents that had never been observed.

## Decision

1. **Validate at proposal time.** A proposal's arguments are validated against
   the capability's input schema and argument limits before the proposal is
   stored. Invalid proposals return 400, never enter the approval queue, and
   are audited as `rig.invocation.proposal-invalid`. Agent-created proposals
   pass the same validation.
2. **The stored proposal is immutable.** Approval copies the stored arguments
   into the approval record. A proposal can be approved once.
3. **Execute only the approved copy.** An invocation runs the approval's
   stored arguments. Arguments a caller supplies are never executed; if
   present they must match the approved digest. The digest remains a defence,
   not the only guarantee. Invocation still validates defensively.
4. **The reviewer sees the stored arguments.** For this stabilisation pass
   RigPanel is the review surface. It lists pending proposals from the server
   and shows each one's stored arguments.
5. **Intent produces the proposal.** The flow is: request → intent resolver →
   structured intent (`appId`, operation, arguments) → capability resolution →
   schema validation → proposal → human review → approval → invocation.
6. **No invented values.** A missing required argument produces a
   clarification and no proposal. A default is used only when the capability
   schema declares it; PaneTera does not substitute values of its own.
7. **No single-step self-approval.** No client interaction may propose,
   approve, and invoke without an intervening review of the stored proposal.
8. **No unsupported affordances.** A surface action that cannot supply valid
   arguments is not offered.
9. **No invented authority.** Model instructions must not advertise tools,
   application state, or authority that the Rig capability inventory does not
   establish.

## Alternatives Considered and Rejected

- **Digest binding alone.** It proves the caller re-sent matching arguments,
  but the server still executes caller input and the reviewer never sees a
  server-held payload.
- **Validate only at invocation.** Lets proposals that can never run occupy
  the approval queue and consume reviewer attention.
- **Fill missing arguments with sensible defaults.** Executes values the
  person never chose and the reviewer may not notice.

## Consequences

- A request missing a required value produces a clarification, not a
  proposal.
- Editing RigPanel's argument field after proposing has no effect on the
  proposal; a new proposal is required.
- Approvals recorded before this change have no stored arguments and cannot
  be claimed. They expire within five minutes.
- A surface offers a propose action only when it can supply that action's
  arguments.

## Security Implications

A compromised or confused client can no longer change what executes after
review. The execution payload is server-held from proposal to invocation.
