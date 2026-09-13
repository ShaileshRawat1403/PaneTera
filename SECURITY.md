# PaneTera Security Summary

**Status:** CURRENT. Derived summary; it indexes the detailed security
authorities and does not replace them.

This summary describes PaneTera's trust surfaces at the development baseline
recorded in [`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`](docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md).
It states no guarantee beyond what those sources establish.

| Topic | Authority |
| --- | --- |
| Route security, trust layers, and findings | [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) |
| External MCP transport, lifecycle, and launch identity | [`docs/adr/ADR-002-EXTERNAL-MCP-TRANSPORT-SECURITY.md`](docs/adr/ADR-002-EXTERNAL-MCP-TRANSPORT-SECURITY.md) |
| Proposal and approval fidelity | [`docs/adr/ADR-005-INTENT-PROPOSAL-FIDELITY.md`](docs/adr/ADR-005-INTENT-PROPOSAL-FIDELITY.md) |
| Governed execution requirements | [`docs/PANETERA_WORKSTATION_CONTRACT.md`](docs/PANETERA_WORKSTATION_CONTRACT.md), "Governed execution contract" |
| What is implemented, and how it is verified | [`docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md`](docs/CURRENT_IMPLEMENTATION_CHECKPOINT.md) |
| Which document owns what | [`docs/DOCUMENTATION_AUTHORITY.md`](docs/DOCUMENTATION_AUTHORITY.md) |

## Deployment assumption

PaneTera is single-user and local-first. The backend listens on `127.0.0.1`
only. It is not designed to be exposed to a network or shared between users.

## Trust surfaces

### Local host and portal authentication

- Protected API routes require the master token (`PORTAL_TOKEN`). The server
  refuses to start when the token is empty or the default placeholder.
- The token is accepted in the `Authorization` header and is refused in a query
  string, including on the event stream, which uses single-use tickets instead.
- Browser extension pairing and the browser MCP route authenticate separately,
  before the global token gate. See Threat Model layer A.
- Security headers (CSP, frame options, `nosniff`) are applied to responses.
- Security findings and their status are recorded in Threat Model section 4.

### Workspace filesystem policy

- Workspace reads are bounded to the registered workspace root with a
  segment-aware check applied after symlinks are resolved, and denied file
  patterns are refused. Workspace tool calls pass the host policy in
  `server/myai-policy.json` before they reach a workspace process.
- The workspace command execution endpoint (`POST /api/execute`) is disabled
  outside tests by `server/features.ts`.

### Rig external connections

- A connection is recorded and reviewed, and a person approves it before any
  process starts or network connection opens.
- External capability declarations are untrusted, and every capability is
  disabled and denied until a person enables it.
- HTTP connections refuse private and local network destinations unless a
  connection is explicitly marked for local development. A bearer credential is
  bound to its approved origin and is stripped when a redirect leaves that
  origin.

### Stdio launch identity

- Approval binds the executable, arguments, working directory, environment
  bindings, and a content digest of every absolute file argument. A child
  process starts from a fixed minimal environment rather than PaneTera's own;
  declared bindings must be well-formed, non-secret names, and secret
  references are refused for stdio connections.
- A connection whose current launch identity differs from the approved one is
  refused before any child process starts. A managed declaration whose launch
  specification or source changes returns to `approval-required`.
- Boundary: the digest covers files named in the arguments, not their full
  import graph (ADR-002).

### Approval and proposal boundary

- Proposed tool arguments are validated when the proposal is created; invalid
  arguments never reach approval.
- An approval stores the reviewed arguments, a proposal is approved once, and
  execution uses only the stored payload. Caller-supplied arguments that differ
  are refused, and the stored payload is validated again before invocation.
- Agent-originated Rig proposals follow the same validation.
- The Rig review surface approves and runs in one interaction.

### Credential references

- Rig HTTP bearer credentials are held as macOS Keychain references through a
  local helper (`server/rig/keychain.ts`), not in connection records. Real
  Keychain storage is not exercised in CI.

### Native grants

- File and folder access is granted through the operating-system picker as
  short-lived (15-minute), digest-bound, revocable grants that refuse path
  traversal. Headroom local selection scopes also expire and can be revoked.

### Browser observation and governed browser actions

- Browser observations are untrusted evidence and never application authority.
- Governed browser actions are previewed, require operator approval (approval is
  refused until the target preview succeeds), and only then are claimed and
  executed by the paired extension.
- Extension pairing uses a short-lived code (two minutes).

### Full Operator (experimental)

Full Operator is an EXPERIMENTAL browser-extension capability. It is outside the
accepted PaneTera governed execution model.

- The default state is governed, and a missing, unknown, or unreadable setting
  falls back to governed.
- Ungoverned mode requires an explicit, persisted opt-in in the extension popup
  and presents a warning.
- When ungoverned, the extension can perform page-authority actions without
  PaneTera's approval path, including JavaScript evaluation in the page and
  direct keyboard and pointer input, as well as navigation and diagnostics.
- **Critical limitation:** ungoverned Full Operator actions are not written to
  PaneTera's persistent audit or provenance stores. The extension sends its
  dispatch audit event only to `console.debug`, and the PaneTera server has no
  record of these actions.
- A thin safety floor in the extension fails open when a tab URL cannot be
  resolved. It does not make the lane governed.

See `docs/FULL_OPERATOR_CONTRACT.md` and the checkpoint for current standing.

### Headroom and data persistence

- Application state (Rig registry, approvals, provenance, Headroom, grants,
  models) lives in the local application-data directory, whose path still uses
  the legacy `Tessera` name. Rig and Headroom stores write their files with
  owner-only permissions.
- Headroom envelopes persist hashes and measurements rather than source
  material, and redact URL credentials and sensitive query values.
- The audit log and Rig provenance are hash-chained; provenance rotates to an
  archive. The audit log defaults to `server/audit.log` and can be relocated
  with `PANETERA_AUDIT_LOG`.

### Agent runtime and models

- Model providers are reasoning engines without authority of their own.
- Agents are offered only Rig capabilities that a person has enabled; `denied`
  and disabled capabilities are never offered. Each use follows the capability's
  policy: a `proposable` capability creates a validated proposal that must be
  approved before it executes, and an `auto-invocable` capability (observe risk)
  executes directly, without a proposal. PaneTera does not independently verify
  that an `auto-invocable` tool is read-only; that classification is the
  person's policy decision.
- Agent run creation is rate limited. Provider credentials are read on the
  server from its environment.

### Public web preview

- A user-requested website preview is untrusted, carries no PaneTera authority,
  and refuses credentials and private, loopback, and link-local destinations.

### Soothsayer live-app path (legacy)

- Soothsayer is a supported legacy integration. PaneTera signs its embed URLs
  with a timestamped HMAC whose secret stays on the server; token verification
  and expiry are enforced by the remote application. The path is preview-only
  and does not use Rig governance.

### Test isolation

- Test processes cannot resolve the production application-data directory,
  audit log, or run history; a preload gives each test process isolated
  temporary locations and a throwaway token, and `.env` is not loaded under
  test.

## Known limitations

- Ungoverned Full Operator actions have no persistent PaneTera audit.
- Open findings in Threat Model section 4.
- Launch identity does not digest full import graphs.
- Real Chrome, native picker, and Keychain journeys are not automated in CI.
