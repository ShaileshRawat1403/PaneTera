# Persona Card Lenses (Architecture Note)

**Status**: Proposal / Draft (For Future Implementation)

---

## Overview

**Persona Card Lenses** are visual rendering/view modes that overlay on top of governed portal telemetry and data. They allow different stakeholders (engineers, product managers, business analysts, QA, executives) to view the same underlying truth through specific, optimized layouts.

---

## Suggested Lenses

| Lens | View Focus | Key Visual Elements |
|---|---|---|
| **engineer** | Execution logs, terminal output, files and code, diff logs, git checks | Diff editors, terminal emulator feed, code paths, raw output |
| **pm** | Workflow steps, execution results, task timelines | Kanban status boards, project checklists, pipeline health |
| **ba** | Requirements mapping, run evidence, audit trail | Markdown checklists, legal transitions, run compliance receipts |
| **qa** | Test suites status, coverage metrics, lint validations | Lint detail lists, test run matrix, coverage reports |
| **exec** | High-level summary, approval requests, risk tags | Approval control actions, high-level status charts, summary cards |

---

## Core Principles & Security Constraints

1. **Lenses Do Not Own Truth**:
   A lens is a client-side filter. The underlying truth—files, execution logs, workflow events, git state—remains identical and is owned by the governed server runtime.
2. **Lenses Do Not Grant Permissions**:
   Choosing the "engineer" or "exec" lens does not elevate permissions or bypass the execution allowlist. All command routing, validation, and adapter isolation (local-shell dry-runs, Apple Containers) are verified on the server-side, regardless of the active lens.
3. **No Duplicate Storage**:
   Lenses do not store state independently. They query the unified API and parse the shared schemas.

---

## Future Roadmap Recommendation

Implement Persona Lenses after the **Repo Setup Proposal** and **Workspace Registry** stabilize. Once the portal has a robust front door for registering and validating project roots, the layout system can query and render these lenses with high reliability.
