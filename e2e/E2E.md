# End-to-end journeys (S2.3)

Release-grade browser tests that drive the real app. They cover the portable
subset that Playwright can automate. Journeys that require the native OS file
picker or macOS Keychain are out of scope here by design and belong to a signed
macOS release job (see `PRODUCTION_READINESS.md`).

## First run (on your machine)

Playwright needs a browser and the running app, so it does not run in the build
sandbox. On your machine:

```bash
npm install                       # installs @playwright/test
npx playwright install chromium   # one-time browser download
npm run test:e2e                  # boots the app and runs the journeys
```

`playwright.config.ts` starts `npm run dev` with `PORTAL_TOKEN=e2e-local-token`
and waits for `http://localhost:5173`. If you already have a dev server up, it
reuses it. Override the token with `PORTAL_TOKEN=... npm run test:e2e`.

Use `npm run test:e2e:ui` to watch the journeys run and debug selectors.

## What is covered

- `unlock.spec.ts` — the token gate shows before unlock, the correct token
  reaches the workstation, a wrong token does not unlock.
- `workstation.spec.ts` — one authoritative canvas loads; the Rig, Headroom,
  audit, and project-switcher surfaces open; the gateway indicator reports a
  definite connected/unreachable state.

## Author's note (first run will refine)

These specs were written from the app's real selectors (accessible names and the
`workstation-canvas` testid) but authored in an environment without a browser,
so the first run is the validation step. Expect to adjust a selector or two,
especially the drawer-content assertions in `workstation.spec.ts`, which match on
visible text and may need a `data-testid` anchor if the copy differs. Add anchors
rather than loosening assertions.

## Not yet covered (next, after the setup is validated)

- Project registration and inspection through the native picker (needs the OS
  dialog; belongs to the signed macOS job, or a test hook that bypasses the
  picker).
- Rig approve → discover → invoke against a stub MCP server (needs a fixture MCP
  endpoint so the journey is deterministic).
- Headroom capsule resume across a reload.
- Full degraded-backend recovery (kill the API mid-session and assert the app
  degrades honestly rather than showing stale state).

## CI

The portable subset should run in a dedicated Playwright CI job (Ubuntu, browser
cached, app booted by the config's `webServer`). It is intentionally separate
from the `lint · test:core · build` gate so a browser flake never blocks unit
signal. Add it once the first local run is green.
