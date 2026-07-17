# Browser Operator MCP Contract

This document defines the Model Context Protocol (MCP) primitives—resources, tools, and prompts—exposed by the Tessera Browser Operator façade.

## A. MCP Resources

The façade exposes governed access to stored browser captures, extractions, and evidence. 

### Resource URI Templates

1. `browser://captures/{captureId}`
   - **Description:** Returns the metadata and initial unstructured observation for a specific capture.
   - **MIME/Content Type:** `application/json`
   - **Access Scope:** `browser:resources:read`
   - **Policy Checks:** Validates user owns the capture.

2. `browser://extractions/{extractionId}`
   - **Description:** Returns the `ExtractionResult` contract, including raw data and provenance linking.
   - **MIME/Content Type:** `application/json`
   - **Access Scope:** `browser:resources:read`
   - **Policy Checks:** Validates user owns the extraction.

3. `browser://evidence/{evidenceId}`
   - **Description:** Returns a specific, granular `EvidenceItem` excerpt decoupled from its full extraction.
   - **MIME/Content Type:** `application/json`
   - **Access Scope:** `browser:resources:read`
   - **Policy Checks:** Validates user owns the parent extraction.

4. `browser://research-sessions/{sessionId}`
   - **Description:** Returns a grouping of related browser extractions and analyses.
   - **MIME/Content Type:** `application/json`
   - **Access Scope:** `browser:research:read`

5. `browser://analyses/{analysisId}`
   - **Description:** Returns synthesized `ResearchAnalysis` artifacts generated from browser evidence.
   - **MIME/Content Type:** `text/markdown`
   - **Access Scope:** `browser:research:read`

### Excluded Resources
The following data is strictly NOT exposed:
- Access tokens, refresh credentials, cookies.
- Form values, browser storage, hidden page data.
- Unrestricted local paths or raw audit secrets.

## B. MCP Tools: V0 Read-Only Retrieval Set

V0 explicitly excludes live browser execution. MCP clients cannot trigger live browser extractions in V0 because an MCP request is not a Chrome user gesture.

These tools expose completed evidence that already exists inside Tessera.

### 1. `browser_list_captures`
- **Description:** Retrieve a list of stored browser captures belonging to the authenticated user.
- **Input Schema:** `{ "limit": "number", "offset": "number" }`
- **Output:** List of `captureId` metadata objects.

### 2. `browser_get_capture`
- **Description:** Retrieve metadata and raw HTML/text observation for a specific capture.
- **Input Schema:** `{ "captureId": "string" }`
- **Output:** `ObservationResult`

### 3. `browser_get_extraction`
- **Description:** Retrieve a complete structured extraction result for a specific parent capture.
- **Input Schema:** `{ "extractionId": "string" }`
- **Output:** `ExtractionResult`

### 4. `browser_get_evidence`
- **Description:** Retrieve a single, granular evidence item by ID.
- **Input Schema:** `{ "evidenceId": "string" }`
- **Output:** `EvidenceItem`

*(Live capabilities like `browser_article_extract` are explicitly deferred to V0.1, where they will create a `PendingBrowserRequest` requiring user gesture execution in the extension.)*

## C. MCP Prompts

Prompts provide structured, reusable tasks for the LLM to execute using browser resources, without granting execution authority.

### `browser_explain_capture`
- **Description:** Summarize the provided capture and explain its key context.
- **Required Resources:** `browser://captures/{captureId}`

### `research_compare_browser_sources`
- **Description:** Compare the claims found in multiple browser extractions.
- **Required Resources:** Multiple `browser://extractions/{id}` URIs.
- **Constraint:** Must preserve provenance; forbid source-free conclusions.

### `research_compare_with_workspace`
- **Description:** Compare browser evidence against local workspace policies or files.
- **Required Resources:** `browser://evidence/{id}`, `workspace://workspaces/{id}`

### `issue_prepare_from_browser_evidence`
- **Description:** Prepare a bug report or issue based on captured browser state.
- **Expected Output:** An actionable Markdown issue template.

### `action_prepare_without_execution`
- **Description:** Formulate a structured `ActionProposal` to achieve a stated intent on the page, without taking the action.
- **Expected Output:** JSON `ActionProposal` payload to be passed to Tessera's approval engine.

## Tool Envelope Mapping (McpToolRequest -> BrowserResultEnvelope)
Requests sent to the MCP Façade are wrapped in an `McpToolRequest`, mapped by `browserMcpMapper.ts` into a `TesseraCapabilityRequest`, evaluated by policy, and finally sent as a `BrowserDispatchEnvelope`. The result traverses backward, resolving as an `McpToolResult` with distinct states: `completed`, `partially completed`, `denied`, `approval required`, or `stale target`.
