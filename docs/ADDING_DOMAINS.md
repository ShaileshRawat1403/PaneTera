# Guide: Adding New Domains to PaneTera

To add a new domain (e.g., Healthcare, Legal, Supply Chain, Finance) to PaneTera, follow these 3 simple steps. **No edits to PaneTera core UI code are required.**

---

## Step 1: Define the Domain Schemas

Create a JSON schema file defining your domain cards using one of the core widget types:
- `status-board`
- `metric-group`
- `diff`
- `proposal-gate`
- `form`

### Example: Healthcare Domain (`schemas.json`)
```json
[
  {
    "id": "healthcare.patient-triage",
    "version": "1.0.0",
    "domain": "healthcare",
    "type": "proposal-gate",
    "title": "Clinical Patient Triage Gate",
    "fields": [
      { "name": "checkList", "type": "array", "label": "Vitals & Lab Checks", "required": true }
    ],
    "actions": [
      { "id": "admit_icu", "type": "approve", "label": "Escalate to ICU Triage", "requiresApproval": true }
    ]
  }
]
```

---

## Step 2: Register the Schema via API

Register your schema with PaneTera's Schema Registry:

```bash
POST /api/schemas
Content-Type: application/json
Authorization: Bearer <PORTAL_TOKEN>

{
  "id": "healthcare.patient-triage",
  "version": "1.0.0",
  "domain": "healthcare",
  "type": "proposal-gate",
  "title": "Clinical Patient Triage Gate", ...
}
```

---

## Step 3: Emit Schema Card Payloads from your Agent or MCP Server

When your agent returns execution results, emit a `SchemaCard` payload:

```json
{
  "type": "SchemaCard",
  "data": {
    "schemaId": "healthcare.patient-triage",
    "data": {
      "proposalId": "pat_88192",
      "proposalTitle": "Patient #88192 ICU Admission Gate",
      "summary": "Vitals delta flagged high-risk cardiac arrhythmia.",
      "checkList": [
        { "id": "v1", "rule": "ECG Telemetry Trend", "status": "fail", "detail": "ST segment elevation detected" },
        { "id": "v2", "rule": "Blood Chemistry (Troponin)", "status": "warn", "detail": "Elevated troponin I level (0.8 ng/mL)" }
      ]
    }
  }
}
```

PaneTera's `SchemaCardRenderer` will automatically fetch the registered schema and render a native, interactive, governed card on the canvas!
