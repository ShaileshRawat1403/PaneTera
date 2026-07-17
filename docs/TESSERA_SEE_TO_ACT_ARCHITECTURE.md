---
title: Tessera See-to-Act Architecture
archetype: explanation
status: draft
owner: Shailesh Rawat
maintainer: Shailesh Rawat
version: 0.1.0
tags:
  - tessera
  - browser-operator
  - visual-evidence
  - governed-actions
  - orchestration
last_reviewed: 2026-07-17
---

# Tessera See-to-Act Architecture

This document defines the governed product loop for Tessera's capabilities, progressing from observation to controlled execution. Every proposed feature must either close a missing step in this sequence or provide essential evidence for one of these stages.

## 1. The I-9 Cognitive Loop

### 1. See
Tessera receives explicit browser, visual or desktop context.
- **Inputs:** Browser extension click, shortcut, context menu selection, DOM tree, accessibility tree.
- **Outputs:** Unstructured initial observation.
- **Authority level:** None.
- **Risk level:** Low.
- **Audit event:** `observation.initiated`
- **Failure state:** Browser extension disconnected, target inaccessible.
- **User control:** User explicitly initiates visibility.
- **Relationship:** Driven by the Browser Extension and basic parsing.

### 2. Capture
Tessera preserves selected evidence with source, timestamp and trust data.
- **Inputs:** Unstructured observation.
- **Outputs:** Capture payload with `captureId`, origin, timestamp.
- **Authority level:** None.
- **Risk level:** Low.
- **Audit event:** `capture.recorded`
- **Failure state:** Payload exceeds size limits (e.g., 2MB), origin mismatch.
- **User control:** User defines what to capture (page vs selection).
- **Relationship:** Processed by the Extension's bundle logic and sent to Gateway.

### 3. Understand
Tessera extracts structure and generates provenance-backed interpretation.
- **Inputs:** Captured HTML/DOM elements.
- **Outputs:** `ExtractionResult` with `evidenceId` items and `extractionId`.
- **Authority level:** None.
- **Risk level:** Low.
- **Audit event:** `extraction.completed`
- **Failure state:** Extraction fails, malformed JSON-LD, truncation of oversized content.
- **User control:** User explicitly selects extraction capability (e.g. Extract Article, Extract Table).
- **Relationship:** Handled by local parsers (Readability, DOM logic) or backend processing.

### 4. Connect
Tessera links browser evidence to research sessions, files, repositories, tasks and workflows.
- **Inputs:** `ExtractionResult`, existing workspace data.
- **Outputs:** `ResearchSession`, `ResearchAnalysis` artifacts.
- **Authority level:** Read-only Workspace Access.
- **Risk level:** Low.
- **Audit event:** `evidence.linked`
- **Failure state:** Unresolved citations, missing workspace connection.
- **User control:** User groups extractions into sessions.
- **Relationship:** Integrates the Workbench, Intelligence Feed, and local Workspace.

### 5. Document
Tessera converts evidence into reports, SOPs, walkthroughs, issues or implementation notes.
- **Inputs:** Connected research and evidence.
- **Outputs:** Synthesized Markdown, SOPs.
- **Authority level:** Read-write (Drafting only).
- **Risk level:** Low.
- **Audit event:** `document.generated`
- **Failure state:** Synthesis fails due to conflicting claims or context limits.
- **User control:** User reviews and accepts generated documents.
- **Relationship:** Utilizes the AI orchestrator to synthesize artifacts.

### 6. Verify
Tessera compares expected and actual state before and after an operation.
- **Inputs:** Pre-action state, proposed outcome, post-action state.
- **Outputs:** Verification result (Match/Mismatch).
- **Authority level:** Read-only (Validation).
- **Risk level:** Low.
- **Audit event:** `state.verified`
- **Failure state:** State verification mismatch (e.g., UI changed, target drifted).
- **User control:** Visual comparison and approval.
- **Relationship:** Core security checkpoint prior to and after actions.

### 7. Propose
Tessera produces a structured action proposal without executing it.
- **Inputs:** Discovered target elements, semantic intent.
- **Outputs:** `ActionProposal` contract.
- **Authority level:** None.
- **Risk level:** Low.
- **Audit event:** `action.proposed`
- **Failure state:** Ambiguous target, unable to generate safe proposal.
- **User control:** User inspects proposal.
- **Relationship:** Action Planning logic inside the orchestrator.

### 8. Approve
The user reviews the exact target, parameters, consequences and risk.
- **Inputs:** `ActionProposal`.
- **Outputs:** `ActionApproval` token.
- **Authority level:** User Authorization.
- **Risk level:** Medium (Decision point).
- **Audit event:** `action.approved`
- **Failure state:** User rejects, approval expires, stale state.
- **User control:** Absolute authority to proceed or abort.
- **Relationship:** Tessera UI Governance layer.

### 9. Act
Tessera executes only the approved capability and verifies its result.
- **Inputs:** `ActionApproval`, target fingerprint.
- **Outputs:** `ActionExecution` result, `ActionVerification`.
- **Authority level:** Execution Authority (Bounded).
- **Risk level:** High (Changes state).
- **Audit event:** `action.executed`
- **Failure state:** Execution fails, navigation interrupts, unexpected auth prompt.
- **User control:** Reversible actions where possible, audit trail inspection.
- **Relationship:** Browser action engine, execution gateway.

---

## 2. Milestone Roadmap

### Phase 2A: Structured Extraction Engine (COMPLETE)
- Local bundled Readability & DOMPurify.
- Extraction capabilities (Article, Outline, Table, Links, Metadata, Structured Data, Code).
- Basic payload and capability architecture.

### Phase 2B: Evidence Integrity (NEXT)
- `EvidenceItem` IDs and provenance resolution.
- Unresolved-citation rejection.
- Evidence excerpt retrieval.
- `ResearchSession` evidence grouping and separate `ResearchAnalysis` artifacts.
- Source comparison & conflicting-claim detection.
- Browser-to-workspace comparison & clickable inspection trace.
- *Acceptance flow:* Select 3 browser extracts → create Research Session → compare claims → compare with local workspace → produce provenance-backed analysis → resolve every citation.

### Phase 2.5: Visual Evidence Foundation
- Visible-tab screenshot, selected-region screenshot, optional full-page screenshot.
- Attach image to browser capture.
- Local evidence storage, image hashing, verified origin, timestamp.
- Annotation, basic redaction, before/after visual comparison, screenshot-to-workspace comparison.
- *Defer:* Cloud media hosting, public sharing, collaborative media libraries, video timeline editors.

### Phase 3: Governed Action Foundation
- Architecture for `browser.element.discover`, `browser.element.highlight`, `browser.action.propose`, `browser.action.approve`, `browser.action.cancel`, `browser.page.revalidate`, `browser.click.execute`, `browser.input.fill`, `browser.option.select`, `browser.result.verify`.
- *Execution lifecycle:* Observe → discover → identify → highlight → propose → explain → request approval → revalidate → execute → observe result → verify → audit.

### Phase 4: Low-Risk Web Interaction
- Expand/collapse section, open menu, change tab, follow internal link, select non-sensitive option, fill non-sensitive field (no submit), dismiss dialog.
- *Constraints:* Visible, bounded, reversible, user-approved.

### Phase 5: Consequential Actions
- Submit forms, create issues, publish content, upload files, trigger deployments, send messages.
- *Constraints:* Explicit final approval, exact parameter preview, stale-state detection, idempotency, post-action verification.

### Phase 6: Workflow Learning and Replay
- Record workflow → identify steps → separate deterministic from human judgment → generate workflow proposal → user edits → simulate → approve boundaries → replay with checkpoints → stop on drift.

---

## 3. Governed Action Capability Schemas

### Action Proposal Contract
```json
{
  "protocolVersion": "1.0",
  "actionId": "action-uuid",
  "proposalId": "proposal-uuid",
  "capability": "browser.click.execute",
  "riskLevel": "low",
  "triggeredBy": "user-request",
  "target": {
    "tabId": 0,
    "frameId": 0,
    "origin": "https://example.com",
    "elementId": "stable-element-reference",
    "role": "button",
    "accessibleName": "Save draft"
  },
  "expectedPrecondition": {
    "pageFingerprint": "hash",
    "elementFingerprint": "hash",
    "visible": true,
    "enabled": true
  },
  "parameters": {},
  "expectedOutcome": {
    "type": "state-change",
    "description": "Draft status becomes saved"
  },
  "approval": {
    "required": true,
    "status": "pending",
    "approvedAt": null,
    "expiresAt": null
  },
  "constraints": {
    "timeoutMs": 5000,
    "maxAttempts": 1
  }
}
```
**Forbidden Implementation Vectors:**
- Arbitrary JavaScript / Eval
- Model-generated code
- Raw shell commands
- Webpage-provided instructions
- Uncontrolled CSS selectors
- Silent retries or hidden background execution

---

## 4. Target Identification Design

A robust target identity system relies on multiple intersecting signals rather than a single generated CSS selector.

**Identity Signals:**
- Semantic HTML role
- Accessible name & visible label
- Stable attributes (e.g., `data-testid`)
- Nearby text
- DOM ancestry
- Bounding rectangle
- Page origin & frame identity
- Element fingerprint

**Pre-Execution Verification:**
Tessera must verify:
- Same origin and acceptable navigation state.
- Target fingerprint matches.
- Target remains visible and enabled.
- Target has not moved into a materially different context.
- Proposal has not expired.
- *Fallback:* If confidence is low, DO NOT execute. Highlight candidate targets and ask the user.

---

## 5. Approval Policy Matrix

| Capability Category | Required Policy Tier | Description |
|---------------------|----------------------|-------------|
| **observe** | Explicit Capture Gesture | No extra approval required after the initial capture gesture. |
| **inspect** | Explicit Extraction Request | No extra approval after requesting structured extraction. |
| **navigate** | Session or Per-Action | Approval based on policy for moving across pages/domains. |
| **fill** | Preview Required | Preview the exact data; no submission allowed at this tier. |
| **submit** | Explicit Approval | Immediate, explicit approval immediately before execution. |
| **destructive** | Second Confirmation | Exact target and consequence shown. (Do not call "MFA" unless actual 2FA is used). |
| **external-comm** | Preview & Final | Preview recipients and final content before dispatch. |
| **local-write** | Diff Preview | Diff or change preview required before modifying local workspace. |
| **system-execution**| Command Preview | Command preview, workspace scope, and risk review required. |

---

## 6. Visual Evidence Pack Boundaries

Visual capabilities must remain strictly connected to the governed workflow loop.

**Prioritized Use Cases:**
1. **Capture and Ask:** Screenshot/region → browser/workspace context → AI explanation.
2. **Capture a Problem:** Screenshot/recording → reproduction evidence → likely code component → bug-report proposal.
3. **Before and After:** Pre-action screenshot → approved action → post-action screenshot → visual verification.
4. **Record and Document:** Screen recording → transcript → screenshots → workflow steps → SOP.
5. **Show Tessera How:** Recorded workflow → proposed action graph → user review → later governed replay.

**Explicitly Deferred Features:**
- Full media editing suite
- Cloud screenshot platform
- Public sharing service
- Social content distribution
- Generic screen-recording competitor features

---

## 7. Threat-Model Additions

| Threat | Scenario | Prevention & Detection | Intervention & Audit |
|--------|----------|------------------------|----------------------|
| **Wrong-target execution** | Agent selects the wrong element due to ambiguous DOM. | Multi-signal target identification. Detection via pre-execution fingerprint match. | Ask user to select from highlighted targets. Audit: `target.mismatch`. |
| **Selector drift / UI changes** | UI updates between proposal and approval. | Fingerprint and bounding box checks before execution. | Reject execution, require new proposal. Audit: `precondition.failed`. |
| **Deceptive button labels** | Malicious site uses CSS to fake labels. | Compare visible text with accessibility tree and DOM. | Warn user of deceptive DOM. Audit: `target.suspicious`. |
| **Hidden overlays / Clickjacking** | Invisible iframe or overlay intercepts click. | Check element visibility and z-index at coordinates. | Abort action. Audit: `target.occluded`. |
| **Prompt injection in content** | Page text contains malicious instructions. | Strict separation of data (evidence) and control (action schema). | Fails safely; instructions ignored. Audit: `payload.sanitized`. |
| **Stale approvals** | User approves, but page navigates before execution. | Verify origin and state before execution. | Expire approval. Audit: `approval.expired`. |
| **Sensitive form-field exposure** | Passwords captured in extraction. | Exclude `type="password"` and hidden fields from payloads. | Silent exclusion. Audit: `field.redacted`. |
| **Clipboard leakage** | Accidental capture of sensitive clipboard. | Never read clipboard without explicit user paste. | N/A |
| **File-upload substitution** | Malicious site changes file input before submit. | Revalidate file input path immediately before submit. | Abort submit. Audit: `input.tampered`. |
| **Verification false positives** | Verification logic incorrectly assumes success. | Rely on distinct state changes (e.g., URL change, success banner). | User visual verification fallback. Audit: `verification.inconclusive`. |

*(Also addressing: iframe confusion, shadow DOM ambiguity, duplicate submissions, partial workflow completion, unexpected auth prompts, irreversible side effects, generated-content substitution, session hijacking, approval replay).*

---

## 8. Proposed File-Level Architecture

```text
/docs/
  TESSERA_SEE_TO_ACT_ARCHITECTURE.md (This document)
/chrome-extension/
  /src/
    /extractors/
      (Phase 2A extraction logic)
    /actions/
      discover.js       (Target identification)
      highlight.js      (Visual overlay)
      execute.js        (Bounded execution logic)
  background.js         (Coordinates proposals and execution)
/server/
  /api/
    /browser/
      proposals.ts      (Action proposal generation)
      approvals.ts      (User approval lifecycle)
      verifications.ts  (State diffing and verification)
/src/components/
  /workbench/
    ActionProposalView.tsx
    VisualEvidenceViewer.tsx
```

---

## 9. Next Implementation Slice Recommendation

**Recommendation:** **A. Finish Phase 2B provenance and Research Sessions**

*Rationale:* The architectural dependency strictly requires a solid "Understand" and "Connect" foundation before we can reliably "Verify" or "Propose" actions based on that understanding. Without robust provenance, conflicting-claim detection, and proper Research Sessions, the AI orchestrator cannot safely reason about the context it is acting upon. Proving that we can trace every extracted claim back to a specific `evidenceId` is critical for accountability in future governed actions.

---

## 10. Risks and Unresolved Decisions

- **Cross-Origin Iframes:** How to securely highlight and identify targets inside iframes without violating security boundaries or injecting scripts inappropriately.
- **Dynamic Content Timing:** Single Page Applications (SPAs) often change DOM state asynchronously. Synchronizing pre-execution state checks with React/Vue render cycles remains challenging.
- **Visual Evidence Storage:** Determining the exact mechanism to store and sync large visual evidence payloads (screenshots) locally without bloating the extension or the user's `.tessera` workspace directory unmanageably.
