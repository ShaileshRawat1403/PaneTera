# ADR-003: Surface Source Taxonomy

## Title
`SurfaceDescriptor.kind` classifies the class of upstream source. A concrete
application is identified by `appId`, presentation by `renderer.type`, and
transport is not part of surface classification.

## Status
Accepted on 2026-09-10 for core PaneTera. Amends the frozen SurfaceHost
contract in `src/surfaces/types.ts`.

## Context

The Blender and REAPER integration experiment (tag
`integration/blender-reaper-governed-poc-2026-09-11`) widened `kind` with
`'blender' | 'reaper'`. That turns a category into an application
enumeration: every further integration would add a member, and handling of
`kind` would drift from per-category to per-application dispatch.

The repository already has an application identity. `appId` keys the
workstation app registry (`src/composer/appRegistry.ts`), local app source
definitions, and `local-app:<appId>` surface ids; a Rig-backed application
uses the same key as its Rig `connectionId`.

## Decision

1. `kind` answers "what class of thing is this?" The set stays
   `browser | local-app | mcp | artifact | workspace`. A desktop application
   integration is `local-app`.
2. `appId` answers "which application is it?" It is an optional descriptor
   field, set for `local-app` surfaces, equal to `RegisteredApp.appId` and,
   where one exists, the Rig `connectionId`.
3. `renderer.type` answers "how does PaneTera present it?" PaneTera-owned,
   per-application renderers remain allowed.
4. Transport is never encoded in `kind` or `appId`. Reaching an application
   over MCP does not make it an `mcp` surface.

## Alternatives Considered and Rejected

- **Application names in `kind`.** Grows without bound and erodes the
  category.
- **Classifying by transport.** Describes how PaneTera connects, not what the
  source is.
- **A new `integrationId` field.** A third name for the key that `appId` and
  `connectionId` already carry.

## Consequences

- Adding an application adds an `appId` and, if needed, a renderer type. It
  never adds a `kind`.
- The local-app projection sets `appId`. Renderer selection is unaffected; it
  never depended on `kind`.
