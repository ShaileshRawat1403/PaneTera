# Live Deployed App Experience Cards (Direction & Architecture)

**Version**: 0.1.0  
**Status**: Proposal / Specification (Phase 1: Docs Only)  

---

## 1. Purpose

MYAI Portal should eventually support **Live Deployed App Experience Cards** to turn configured, live running applications into real-time interactive workbench views. The portal will act as the single door for operators to inspect, understand, and safely operate deployed instances of applications through governed interface cards.

**Soothsayer** (the Sans Serif Systems workflow runtime and host) serves as the primary candidate and reference model for this integration.

---

## 2. Core Concepts & Cards

- **LiveAppPreview Card**: A high-level visual card containing the application's URL, environment tag (development, staging, production), status badge (healthy, degraded, down), and an optional visual frame (e.g. iframe embed or automated screenshot).
- **LiveAppManifest Card**: Displays structured, verified app facts (routes, active version, enabled features) extracted from a secure, read-only endpoint on the target app.
- **LiveAppInsight Cards**: Persona-specific perspectives generated from the manifest telemetry:
  - **Engineer**: Active build configurations, process health, and route details.
  - **PM / BA**: Active workflows list, legal transitions summary, and task statuses.
  - **QA**: Route validation details, test coverage indicators, and lint rules.
  - **Exec**: Operational status summaries and pending human approval requests.

---

## 3. Truth Boundaries & Security Rules

To maintain high trustworthiness and safety, the following rules govern all live app experience cards:

1. **No Hallucination from Vibes**: The portal must never generate or guess application capabilities, routes, or statuses based on LLM suggestions or soft vibes.
2. **Deterministic Source of Truth**: All structural metadata must come from a secure, read-only manifest endpoint hosted on the target application:
   `GET /api/portal-manifest`
3. **Isolate Visual Embeds**: Screenshots and embeds are solely for operator inspection and verification. They must not be scanned or parsed as the source of state truth.
4. **Governed Decision-Making**: The LLM model may summarize or explain information; the system validator owns the boundaries; the human operator has sole execution approval authority.

---

## 4. Proposed Manifest Schema

The target application should expose a read-only payload structure at `/api/portal-manifest`. Below is the standardized JSON contract:

```json
{
  "app": "soothsayer",
  "environment": "production",
  "version": "1.4.2-beta",
  "routes": [
    { "path": "/api/workflows", "method": "GET", "auth": "required" },
    { "path": "/api/workflows/run", "method": "POST", "auth": "required" }
  ],
  "features": [
    "flowright-runtime",
    "dynamic-console",
    "asymmetric-jwks-verification"
  ],
  "health": {
    "status": "healthy",
    "dbConnected": true,
    "uptimeSeconds": 172800
  },
  "workflows": [
    { "name": "CMS Publish Workflow", "status": "active", "runsCount": 142 }
  ],
  "roles": ["engineer", "pm", "ba", "qa", "exec"]
}
```

---

## 5. Phased Roadmap

- **Phase 1: Specification & Direction (Current)**: Lock the design contract and manifest formats in documentation (codebase remains untouched).
- **Phase 2: LiveAppPreview Card**: Introduce the UI component layout in the portal client to render static/mock URLs.
- **Phase 3: Manifest Adapter**: Write the server-side client to query `GET /api/portal-manifest` from a live target and validate it.
- **Phase 4: Persona Lenses**: Map the verified manifest telemetry to the five active persona views in the UI.
- **Phase 5: Governed Actions**: Propose execution commands (e.g. restart service, run migrations) using the existing approval gate mechanism, routing them strictly through the allowlist.

---

## 6. Non-Goals

- **No Private Data Scraping**: The portal will never scrape page html, crawl databases, or parse credentials.
- **No Unapproved Mutations**: Deployed apps cannot be mutated directly from the portal without a `ProposedAction` card and explicit operator approval.
- **No Deploy Actions**: The portal is not a CI/CD executor. It monitors and operates, rather than compiling/deploying releases.
- **No Hard Coupling**: The portal remains generic; Soothsayer is a reference example. The code must degrade gracefully if the manifest endpoint is unreachable.
- **No Heavy Browser Automation**: Headless browser automation (e.g. Playwright) will not be introduced for scraping state.

---

## 7. Acceptance Rules for Future Implementation

- Live cards must clearly display their verification status: **Verified (via Manifest)** or **Preview Only (Unverified)**.
- If the endpoint `/api/portal-manifest` is missing or fails, the card must show a degraded notice.
- Changing a persona lens affects only the presentation layer. It must never change backend security tokens, permissions, or access controls.
- Any action that attempts to change the application state must be wrapped in a `ProposedAction` and require manual operator validation.
