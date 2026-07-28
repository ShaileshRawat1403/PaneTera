# PaneTera API Documentation

## Overview

PaneTera exposes a RESTful API for managing projects, agent runs, browser operations, and MCP integrations.

**Base URL:** `http://localhost:4000/api`

**Authentication:** Bearer token in `Authorization` header

---

## Agent Runtime

### POST /api/agent/run

Start a new agent run.

**Request:**
```json
{
  "objective": "string (required)",
  "history": ["optional conversation history"],
  "context": { "optional": "context object" }
}
```

**Response:**
```json
{
  "runId": "string",
  "status": "queued"
}
```

**Rate Limit:** 10 requests/minute

---

### GET /api/agent/runs

List all agent runs.

**Query Parameters:**
- `status` - Filter by status (queued, planning, running, completed, failed)
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "runs": [...],
  "total": 100
}
```

---

### GET /api/agent/run/:runId

Get a specific agent run with events.

**Response:**
```json
{
  "run": {
    "runId": "string",
    "status": "string",
    "reply": "string",
    "events": [...]
  },
  "events": [...]
}
```

---

### GET /api/agent/run/:runId/events

Server-Sent Events stream for real-time run updates.

**Events:**
- `run` - Initial run state
- `status` - Status change
- `events` - New events
- `done` - Run completed

---

### POST /api/agent/run/:runId/cancel

Cancel a running or queued agent run.

---

### POST /api/agent/run/:runId/approve-browser

Approve a pending browser action.

---

### POST /api/agent/run/:runId/reject-browser

Reject a pending browser action.

---

## Queue Management

### GET /api/agent/queue/status

Get queue metrics.

**Response:**
```json
{
  "pending": 2,
  "running": 1,
  "completed": 15,
  "maxConcurrent": 2,
  "maxQueued": 10,
  "nextInQueue": { "runId": "...", "priority": 5 }
}
```

---

### POST /api/agent/queue/config

Update queue configuration.

**Request:**
```json
{
  "maxConcurrent": 4,
  "maxQueued": 20
}
```

---

## Run History

### GET /api/agent/history

Query historical runs.

**Query Parameters:**
- `status` - Filter by status
- `model` - Filter by model
- `since` - Timestamp (ms)
- `until` - Timestamp (ms)
- `limit` - Max results
- `offset` - Pagination offset

---

### GET /api/agent/history/:runId

Get a specific historical run.

---

### GET /api/agent/history/:runId/replay

Get replay data for a run.

**Response:**
```json
{
  "run": {...},
  "replay": {
    "objective": "string",
    "model": "string",
    "events": [...]
  }
}
```

---

### GET /api/agent/history/stats

Get aggregate statistics.

**Response:**
```json
{
  "total": 150,
  "byStatus": { "completed": 120, "failed": 30 },
  "byModel": { "gpt-4o": 80, "claude-3": 70 },
  "avgDuration": 4500
}
```

---

## Capabilities

### GET /api/agent/capabilities

List registered capabilities.

**Query Parameters:**
- `category` - Filter (core, browser, mcp, custom)
- `health` - Filter (healthy, degraded, unhealthy)
- `tag` - Filter by tag

---

### GET /api/agent/capabilities/stats

Get registry statistics.

---

### POST /api/agent/capabilities/:capId/health

Trigger a health check for a capability.

---

## Model Fallback

### GET /api/agent/models/stats

Get model fallback statistics.

**Response:**
```json
{
  "totalAttempts": 50,
  "successRate": 0.92,
  "byModel": {
    "gpt-4o": { "attempts": 30, "successes": 28 },
    "claude-3": { "attempts": 20, "successes": 18 }
  }
}
```

---

## Browser Operations

### GET /api/browser/actions/pending

Get pending browser actions (for Chrome extension).

### POST /api/browser/actions/complete

Complete a browser action.

### POST /api/browser/observations/request

Request a browser observation.

### GET /api/browser/observations/pending

Get pending observations (for Chrome extension).

---

## MCP (Model Context Protocol)

### GET /api/mcp/connections

List MCP connections.

### POST /api/mcp/connections

Create a new MCP connection.

### GET /api/mcp/connections/:id/capabilities

Get capabilities for a connection.

### POST /api/mcp/connections/:id/tools/:toolId/invoke

Invoke an MCP tool.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "string",
  "message": "string",
  "details": ["optional array of errors"]
}
```

**Status Codes:**
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
- `503` - Service Unavailable
