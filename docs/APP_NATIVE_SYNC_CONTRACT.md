# App-Native Sync Contract Specification

This document defines the strict, governed API and UI contract between **MyAI Portal** (the single-window client workbench) and external application engines (such as **Soothsayer**).

---

## 1. Public App Metadata (`portalManifest`)
Exposed via `GET /api/portal-manifest`. Contains static or configuration-level metadata about the application.

```json
{
  "app": "soothsayer",
  "environment": "production",
  "version": "1.0.0",
  "routes": [
    { "path": "/api/health", "label": "Health Status", "method": "GET" }
  ],
  "features": [
    { "id": "flowright-operator", "label": "Flowright Operator", "status": "available" }
  ],
  "workflows": [
    { "id": "contentops", "label": "ContentOps governed workflow", "status": "available" }
  ],
  "capabilities": {
    "manifest": true,
    "health": true,
    "routes": true
  }
}
```

---

## 2. Dynamic Workbench Session (`workbenchViews`)
Exposed via `GET /api/portal-workbench`. Contains dynamic, session-level view outlines owned and returned by the app.

```json
{
  "app": "soothsayer",
  "environment": "production",
  "updatedAt": "ISO_DATE_STRING",
  "views": [
    {
      "id": "view-id",
      "type": "draft-preview" | "schema-form" | "status-board" | "workflow-list",
      "label": "Human Readable Label",
      "status": "template" | "no-active-run" | "awaiting-review" | "available",
      "source": "soothsayer-api",
      "data": {},
      "inputSchema": {},
      "actions": []
    }
  ]
}
```

---

## 3. Dynamic Inputs Definition (`inputSchema`)
Allows apps to declare input form configurations without Portal re-implementing or re-inventing form details.

```json
{
  "fields": [
    {
      "name": "topic",
      "label": "Topic",
      "type": "string",
      "required": true,
      "description": "Enter the topic for the post"
    },
    {
      "name": "tone",
      "label": "Tone",
      "type": "select",
      "options": ["clear", "executive", "technical"],
      "required": false
    }
  ]
}
```

---

## 4. Proposal Actions (`actions`)
No mutational actions must execute directly via natural language or client form button clicks. Instead, all actions are governed.

```json
{
  "id": "propose-contentops-run",
  "label": "Propose governed run",
  "kind": "proposal",
  "risk": "medium",
  "requiresApproval": true
}
```

---

## 5. Web Visibility Telemetry (`browserObservation`)
Web page outlines observed via the browser are kept distinct from app-native APIs.
- Must be labeled as **browser-observed** (`Observed in Chrome`).
- Read-only; no autonomous script execution.
- Rejects credentials, cookies, local storage, password inputs.

```typescript
interface BrowserObservation {
  source: "chrome-observation";
  url: string;
  title: string;
  observedAt: string;
  domOutline: Array<{
    role: "heading" | "button" | "link" | "input" | "text" | "region";
    text: string;
    level?: number;
  }>;
  screenshotDataUrl?: string;
  selectedText?: string;
}
```

### Safety Policy
1. No auth headers, credentials, cookies, localStorage, tokens, or private secrets may be collected.
2. Only visible text outline elements may be sent. Text fields containing input values must be ignored.
3. Obvious secret values (Bearer, JWT, API Keys) are actively rejected by the Portal receiver API.

