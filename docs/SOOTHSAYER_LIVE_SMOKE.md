# Soothsayer Live App Smoke Test Results

**Date / Time**: 2026-07-06T17:50:00+05:30  
**Tested URL**: `https://ops-soothsayer-web-production.up.railway.app`  

---

## Smoke Test Cases

### 1. Base URL Reachability
- **Status**: **PASS** (HTTP Status 401)
- **Notes**: The base URL is active and reachable. The server (`railway-hikari`) responded with `401 Unauthorized` indicating Basic Authentication is active (`www-authenticate: Basic realm="Soothsayer Testing"`).

### 2. Manifest Endpoint Reachability
- **Status**: **PASS / NOTE** (HTTP Status 401)
- **Notes**: The manifest endpoint `/api/portal-manifest` is reachable and responded with `401 Unauthorized`. It did not crash or freeze the portal parser.

### 3. Portal Helper Behavior
- **Status**: **PASS**
- **Notes**: Invoking `buildLiveAppWorkbench('soothsayer', 'https://ops-soothsayer-web-production.up.railway.app')` returns:
  - `configured: true`
  - `urlReachable: true`
  - `manifestReachable: true`
  - `manifestAvailable: false`
  - `previewOnly: true`
  - Source labels section contains correct configuration (`user-config: available`, `url-preview: available`, `manifest: unverified` with note `Manifest endpoint returned error or authentication challenge.`, `browser-observation: future`).

### 4. Portal Chat / Local Resolver Behavior
- **Status**: **PASS**
- **Notes**: Prompting `inspect soothsayer` triggers the `LiveAppWorkbench` query intent locally and returns a structured card indicating the live app server is online but manifest JSON content is currently unverified.

### 5. UI Card Behavior
- **Status**: **PASS**
- **Notes**: The [LiveAppWorkbenchCard.tsx](file:///Users/Shailesh/MYAIAGENTS/myai-portal/src/components/LiveAppWorkbenchCard.tsx) displays:
  - Application Name: Soothsayer
  - Target URL
  - Status indicators (Configured: success, URL Reachable: success, Manifest Reachable: success, Manifest Available: warning)
  - Detail warnings indicating `HTTP status 401` was encountered
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
