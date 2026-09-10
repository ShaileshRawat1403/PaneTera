# ADR-003: Surface Source Taxonomy

## Title
`SurfaceDescriptor.kind` classifies the class of upstream source. A concrete
application is identified by `appId`, presentation by `renderer.type`, and
transport is not part of surface classification.

## Status
Accepted on 2026-09-10 during stabilisation of the Blender and REAPER
integration (`feat/blender-reaper-integration`). Amends the frozen
SurfaceHost contract in `src/surfaces/types.ts`.

## Context

The Blender and REAPER checkpoint widened `kind` from
`'browser' | 'local-app' | 'mcp' | 'artifact' | 'workspace'` to also include
`'blender' | 'reaper'`. That turned a category into an application
enumeration. Every further integration would add a member, and any handling
of `kind` would drift from per-category to per-application dispatch.

The repository already has an application identity. `appId` keys the
workstation app registry (`src/composer/appRegistry.ts`), local app source
definitions, and `local-app:<appId>` surface ids. For Rig-backed applications
the Rig `connectionId` uses the same key (`blender`, `reaper`).

## Decision

1. `kind` answers "what class of thing is this?" The set stays
   `browser | local-app | mcp | artifact | workspace`. Blender and REAPER are
   `local-app`.
2. `appId` answers "which application is it?" It is an optional descriptor
   field, set for `local-app` surfaces, and equal to `RegisteredApp.appId` and,
   where one exists, the Rig `connectionId`.
3. `renderer.type` answers "how does PaneTera present it?" PaneTera-owned,
   per-application renderers such as `blender-scene-state` remain allowed.
4. Transport is never encoded in `kind` or `appId`. Reaching Blender over MCP
   does not make it an `mcp` surface.

## Alternatives Considered and Rejected

- **Keep `'blender' | 'reaper'` in `kind`.** Grows without bound and erodes
  the category.
- **`kind: 'mcp'`.** Classifies by transport rather than by source.
- **A new `integrationId` field.** A third name for the key that `appId` and
  `connectionId` already carry.

## Consequences

- Adding an application adds an `appId` and, if needed, a renderer type. It
  never adds a `kind`.
- `data-surface-kind` renders `local-app` for Blender and REAPER surfaces.
- Renderer selection is unaffected; it never depended on `kind`.

## Migration Implications

Only the Blender and REAPER projections change `kind`; the local-app iframe
projection gains `appId`. No persisted data, CSS selector, or end-to-end test
depended on the removed members.
