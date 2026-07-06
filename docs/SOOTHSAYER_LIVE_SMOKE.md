# Soothsayer Live App Smoke Test Results

**Date / Time**: 2026-07-06T18:12:00+05:30  
**Tested URL**: `https://ops-soothsayer-web-production.up.railway.app`  

---

## Smoke Test Cases

### 1. Base URL Reachability
- **Status**: **PASS** (HTTP Status 401)
- **Notes**: The base URL is active and reachable. The server (`railway-hikari`) responded with `401 Unauthorized` indicating Basic Authentication is active (`www-authenticate: Basic realm="Soothsayer Testing"`), proving connection.

### 2. Manifest Endpoint Reachability
- **Status**: **PASS** (HTTP Status 200)
- **Notes**: The manifest endpoint `/api/portal-manifest` was successfully bypassed from the Basic Authentication password gate. It resolves with `200 OK` and returns public-safe, structured JSON.

### 3. Portal Helper Behavior
- **Status**: **PASS**
- **Notes**: Invoking `buildLiveAppWorkbench('soothsayer', 'https://ops-soothsayer-web-production.up.railway.app')` returns a fully parsed manifest payload:
  - `configured: true`
  - `urlReachable: true`
  - `manifestReachable: true`
  - `manifestAvailable: true`
  - `environment: "production"`
  - `version: "1.0.0"`
  - Active routes, features, workflows, and health metrics are fully mapped from the live railway container instance.
  - Warnings is empty `[]`.

### 4. Portal Chat / Local Resolver Behavior
- **Status**: **PASS**
- **Notes**: Prompting `inspect soothsayer` triggers the `LiveAppWorkbench` query intent locally and returns a structured card indicating the live app server is online and manifest JSON content is verified and parsed successfully.

### 5. UI Card Behavior
- **Status**: **PASS**
- **Notes**: The [LiveAppWorkbenchCard.tsx](file:///Users/Shailesh/MYAIAGENTS/myai-portal/src/components/LiveAppWorkbenchCard.tsx) displays:
  - Application Name: Soothsayer
  - Target URL
  - Status indicators (Configured: success, URL Reachable: success, Manifest Reachable: success, Manifest Available: success)
  - Detail lists of routes, features, workflows, and health status
  - Preview only mode and disabled future persona lenses.

### 6. Regression Checks
- **Status**: **PASS**
- **Notes**: All automated validations (`npm test`, `npm run lint`, `npm run build`) passed with zero failures. Repo setup proposal, allowlist validator, and dry-run execution proposal flow remain completely unaffected. No Rook dependency was required.

---

## Technical Enhancements Made

To provide a truthful and accurate representation of the live deployed state, the `reachable` key was split into more granular fields:
- `urlReachable`: whether the server base URL responds.
- `manifestReachable`: whether the server manifest endpoint resolves.
- `manifestAvailable`: whether the manifest returned status 200 and parsed as valid JSON.
- Status chips in the UI card were updated to display `URL Reachable` and `Manifest Reachable` states.
