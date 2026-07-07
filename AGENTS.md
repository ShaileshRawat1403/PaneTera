# MyAI Portal Agent Instructions

This repository is a POC for a governed, single-door workbench. Treat this file
as the first orientation layer before making code changes.

## Product Intent

MyAI Portal is not a generic chat app. It is a single-window work surface where
users can explore projects, inspect live applications, preview proposed work,
and approve governed execution.

The core promise is:

> Natural language opens the right native, interactive workbench view without
> giving the model authority over application truth or mutation.

## Operating Model

- Chat is the entry door, not the whole product.
- The main workbench canvas is where app-native UI, live embeds, schema forms,
  proposals, and browser observations should appear.
- The Intelligence Feed is history and supporting evidence. Do not bury the
  primary native UI there.
- Persona lenses are presentation filters only. They must never change backend
  authorization, truth, or execution behavior.
- Soothsayer is the reference live-app integration, not a hard dependency for
  the entire portal.

## Truth Boundaries

Use deterministic sources for truth:

- App metadata: `GET /api/portal-manifest`
- App-native dynamic UI: `GET /api/portal-workbench`
- Live Soothsayer visual surface: signed `/portal-embed` iframe URLs
- Browser observation: explicit read-only `BrowserObservation` payloads
- Workspace state: local filesystem and configured workspace APIs

Do not invent routes, workflows, run state, evidence, ledger status, approval
state, or app capabilities from LLM text. If a source is unavailable, show an
unavailable/degraded state.

## Security Rules

- Never expose secrets to the React client.
- `SOOTHSAYER_PORTAL_EMBED_SECRET` is server-side only.
- Portal may receive short-lived signed iframe URLs, never signing material.
- Do not collect cookies, localStorage, auth headers, passwords, tokens, API
  keys, or private credentials in browser observations.
- Do not add arbitrary command execution. Mutating work must go through a
  `ProposedAction` or app-native proposal action with explicit operator review.
- Do not broaden command allowlists unless a narrow test-backed use case
  requires it.
- Do not allow iframe embeds from arbitrary origins. Live embed origins must
  match the configured app origin and fail closed otherwise.

## UX Rules

- Default active native cards to the main workbench, ideally `native-focus`.
- Feed variants must stay compact. Never render a full iframe in the feed.
- Main variants may render live iframes, schema forms, draft previews, status
  boards, and proposal cards.
- Keep rails and feed resizable/collapsible so the operator can give the active
  UI enough space.
- Do not add landing-page style hero sections. This is an operator cockpit.
- Avoid cosmetic-only churn unless the task is explicitly UI polish.

## Current Reference Flows

These flows should remain healthy:

- `show soothsayer ui` opens `SoothsayerWorkbench` in the main canvas.
- `Live App` tab renders the real Soothsayer UI through a signed iframe.
- `write a blog post about ...` opens a schema-driven starter form.
- `show latest browser observation` opens read-only browser-observed UI.
- `git status in flowright` creates a governed dry-run proposal, not raw exec.
- Real work prompts like `check my commit for regressions` must not be swallowed
  by local gateway matchers unless a strict, intended card exists.

## Verification Before Finishing

For code changes, run the smallest relevant set plus broader checks when shared
contracts are touched:

```bash
npm run lint
npm run build
npm test
```

For Soothsayer live-embed changes, also verify:

- `/api/portal-workbench` exposes non-secret embed metadata.
- `/portal-embed` returns `302` for a valid signed token.
- iframe cookie has `SameSite=None; Secure` in production.
- CSP includes only allowed portal origins.
- `X-Frame-Options` does not block the iframe.

## Scope Discipline

Scope creep is the largest risk in this project. Do not add new card types,
matcher vocabulary, workflow systems, browser automation, or execution adapters
unless the user asks for that phase directly. Prefer finishing and verifying
the active contract over expanding the surface area.
