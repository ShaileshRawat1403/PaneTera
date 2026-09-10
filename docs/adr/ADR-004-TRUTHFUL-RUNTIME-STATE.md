# ADR-004: Truthful Runtime State

## Title
A runtime fact in PaneTera comes only from runtime evidence. The connection
state of an integrated application is observed, never assumed, and sample
content never stands in for live state.

## Status
Accepted on 2026-09-10 during stabilisation of the Blender and REAPER
integration (`feat/blender-reaper-integration`).

## Context

The workstation contract already requires truthful states: Headroom must not
show fabricated precision, and a merely reachable application is neutral, not
green. The Blender and REAPER checkpoint broke that rule in four places:

1. Production code carried sample scenes asserting `isConnected: true`: two
   fixtures in `src/App.tsx` and `createDefaultBlenderState()` /
   `createDefaultReaperState()`, used by the start canvas and "open blender".
2. The UI fetched `/api/blender/scene` and `/api/reaper/scene` without the
   authorization header. Those routes sit behind the token gate, so the live
   path could not succeed and the sample scene was always what users saw.
3. "Capture Viewport" set `capturedAt` to the current time without capturing
   anything.
4. The bridges report `isConnected: true` about themselves inside the payload.

## Decision

1. Application connection state is one of `unknown`, `connecting`,
   `connected`, `disconnected`, or `error`.
2. The server shapes every bridge read (`server/creative/observation.ts`).
   `observedAt` is stamped only when the bridge returned state. A refused
   socket means the application or its bridge is not running and is reported
   as `disconnected`, a normal state rather than a PaneTera failure. Timeouts,
   unreadable replies, and empty successes are `error`.
3. The client authenticates observation requests. A failed observation
   changes only the connection state; the last observed scene is kept and
   projects as `snapshot` with its original `observedAt`.
4. Surface presence is `live` only while connected with a current
   observation. Governed actions are offered only while live.
5. Connectivity fields reported by the application are not evidence and are
   discarded when a payload is read.
6. Production code contains no sample application content. Until an
   observation succeeds, the canvas shows the observed connection state and
   how to start the bridge.
7. An affordance with no implementation behind it is not shown.

A future demonstration mode is not part of this decision. If built, it must
carry explicit synthetic provenance and must never produce `live` presence.

## Alternatives Considered and Rejected

- **Keep sample scenes with a "demo" label.** Deferred rather than rejected;
  it needs its own provenance design and is out of scope for stabilisation.
- **Project sample content as `snapshot`.** A snapshot is a real past
  observation; synthetic content would falsify it.
- **Trust the bridge's `isConnected` field.** A component claiming its own
  health is not evidence of it.

## Consequences

- Without a running bridge, Blender and REAPER surfaces show a connection
  notice instead of a scene.
- Losing the bridge mid-session degrades the surface to a dated snapshot.
- Observe actions without an implementation (capture viewport, audit
  geometry, read peaks, check LUFS) were removed from the surfaces.

## Known Limitations

An observation is only as truthful as the bridge that produces it. The
bridge addons still emit some fixed values (for example, the REAPER bridge's
LUFS, time signature, transport flags, and project digest, and the Blender
bridge's `/Untitled.blend` path for unsaved files). Correcting them requires
changes inside the addons and live verification in each application.
