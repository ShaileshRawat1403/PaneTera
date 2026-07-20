# ADR-002: External MCP Transport Security

## Title
Connecting an external MCP server is a governed, approval-gated act. Transport
establishment is subject to launch governance for stdio and destination-bound
egress policy for HTTP.

## Status
Proposed. Blocks Stage 6 (Rig registry) of
`RIG_MCP_CONNECTION_ARCHITECTURE.md`. Does not block Stages 1 to 3.

## Context

ADR-001 established that browser capabilities are exposed through a governed
backend façade rather than directly from the extension, and that policy,
approval, audit, and provenance are centralised in the PaneTera backend. That
decision governs how external clients reach *into* PaneTera.

This ADR governs the opposite direction: how PaneTera reaches *out* to MCP
servers it did not author.

The existing host policy engine vets workspace tool calls before they reach a
subprocess. It has no view of connection establishment, because until now every
connection was PaneTera's own: a stdio workspace server spawned from a known
script, and an in-process browser operator façade. A general-purpose registry
changes that assumption.

Two properties of MCP transports make connection establishment consequential
before any tool is called.

**stdio connection launches an arbitrary local executable.** The transport is
defined by a command and arguments. Establishing the connection executes that
command under the user's account, with whatever environment it inherits. No MCP
tool call is required for this to have effect. If adding a stdio connection were
treated as configuration, it would be a complete bypass of the approval
architecture: an attacker or a careless paste would achieve arbitrary local
execution through a settings form, and every downstream gate would be
decorative.

**HTTP connection carries credentials and capability authority to an
operator-supplied address.** An arbitrary URL can target loopback, private
ranges, link-local addresses, or cloud metadata endpoints. It can also pass
validation as a public host and then redirect into a private one, or resolve to
a public address during validation and a private one during connection.

PaneTera already validates URLs for the public web-preview surface. That
validation is not sufficient here, and the reason is a difference in authority
rather than a difference in rigour. A web preview is an untrusted visual surface
holding no PaneTera authority, credentials, or storage. An MCP connection holds
all three. The same URL that is merely useless as a preview is dangerous as a
connection.

## Decision

Connection establishment is a governed action with its own approval, policy
evaluation, and audit record, distinct from and prior to capability invocation.

### Part A: stdio launch governance

**A1. Launch is approval-gated and binds to the whole launch specification.**
Adding a stdio connection produces an approval request, not a settings write.

Approval binds to a canonical `LaunchSpecDigest`, not to the executable alone.
Executable identity is insufficient because a trusted binary performs arbitrary
behaviour through arguments. `/usr/bin/node -e '<code>'`, `python
/changed/script.py`, and `npx <different-package>` all pass an executable digest
check while doing something the user never approved.

```ts
interface LaunchSpec {
  executablePath: string;           // resolved, canonical, absolute
  executableDigest: string;
  entryPointDigest: string | null;  // script, package, or bundle, where applicable
  argv: string[];                   // complete, in order
  cwd: string;                      // canonical
  environment: EnvironmentBinding[];
  limitsProfile: string;            // named resource-limit profile
  isolationMode: 'none' | 'container';
}

type EnvironmentBinding =
  | { name: string; source: 'literal'; valueDigest: string }
  | { name: string; source: 'secret-ref'; secretRef: string };

type LaunchSpecDigest = string;     // canonical hash over the whole LaunchSpec
```

Canonicalisation fixes argv order, normalises paths, and sorts `environment`
by `(name, source)`, so that a semantically identical spec produces an identical
digest and any semantic change produces a different one. Argv order is
significant and is never sorted; environment binding order is not, and sorting
it prevents a reordering from reading as a change.

Any change to any field invalidates prior approval and requires re-approval. The
approval record stores the digest and the full spec, so a user can later see
exactly what they authorised.

**A1a. Entry-point digest.** Where the executable is an interpreter or a runner,
the executable digest is nearly meaningless on its own, because the interpreter
is stable and the behaviour lives in what it runs. `entryPointDigest` covers the
script, package, or bundle actually executed. Where a runner resolves its target
at launch time and no stable entry point can be digested, that is a rejected
configuration, not an accepted unknown.

**A2. Resolved absolute paths only.** The registry stores an absolute, resolved,
canonicalised executable path. It never stores, accepts, or reconstructs a shell
command string. Path resolution happens once at approval time, and the resolved
path is what is recorded and later executed. Resolution through `PATH` at launch
time is prohibited, because it makes the executed binary a function of ambient
environment rather than of what the user approved.

**A3. No shell.** Processes spawn with the shell disabled and arguments passed
as an argv array. No component in the path from registry record to spawn call
performs string concatenation or interpolation on command or arguments.

**A4. Environment is deny-by-default and bound by value.** The child receives
only the bindings in `LaunchSpec.environment`, plus a minimal base set.
`PORTAL_TOKEN`, `SOOTHSAYER_PORTAL_EMBED_SECRET`, model provider keys, and any
variable not named in the connection record are never present in the child
environment. The bindings are user-visible in Rig.

Binding names alone are insufficient. A spec that hashes only variable names
leaves the launch digest unchanged while the values, and therefore the child's
behaviour, change freely after approval. `EnvironmentBinding` distinguishes the
two cases:

- **`literal`**: a non-secret configured value. Its `valueDigest` is part of
  `LaunchSpecDigest`, so changing the value requires re-approval. This is the
  case that closes the hole, since literals are exactly where post-approval
  behaviour change would otherwise hide.
- **`secret-ref`**: a handle into the keychain. The `secretRef` is part of the
  digest; the material is not. Rotating a secret in place therefore does not
  require re-approval, which is the correct behaviour because rotation is a
  credential-hygiene act rather than a change of what the process does. Pointing
  the binding at a *different* secret changes `secretRef` and does require
  re-approval.

**A4a. The base environment is PaneTera-defined.** The minimal base set is a
fixed, enumerated list authored by PaneTera. It is not inherited, filtered, or
derived from the ambient parent process. Deriving it from the parent would make
the child's environment a function of however PaneTera itself was launched, and
a variable that appears in the operator's shell would silently reach the child.

**A5. Bounded working directory.** An explicit `cwd`, validated against the same
path rules the host policy engine enforces for workspace access. Absent or
invalid `cwd` is a launch failure, not a fallback to the PaneTera process
directory.

**A6. Lifetime and resource limits, split by what the transport can actually
enforce.** An unisolated Node child process cannot portably guarantee memory or
file-descriptor ceilings, and terminating a direct child does not terminate its
descendants. Promising those as unconditional guarantees would put an
unenforceable claim in a security document, which is worse than an honest
narrower one.

Two tiers:

**Hard V1 guarantees, enforceable without isolation:**

- startup timeout;
- idle timeout;
- maximum stdout and stderr bytes, and maximum message size;
- process-tree termination. The child is spawned in its own process group and
  termination signals the group, not the direct child, so descendants do not
  survive. Termination is verified, with escalation from graceful to forced
  after a bounded interval.

**Isolation-dependent limits, guaranteed only under `isolationMode:
'container'`:**

- maximum memory;
- maximum file descriptors;
- CPU ceiling;
- filesystem and network confinement beyond path policy.

A connection running with `isolationMode: 'none'` displays the isolation-
dependent limits as unenforced in Rig. It does not display a configured value
that nothing applies, because a limit shown as active and not enforced is a
false assurance and the user would reasonably rely on it.

**A7. Launch-time verification.** The `LaunchSpecDigest`, executable digest, and
entry-point digest are re-verified immediately before every launch. Any mismatch
is a hard stop with an attention event, never a warning-and-continue.

**A8. Isolation is optional but its absence is visible.** The `apple-container`
adapter in `server/execution/` is the first isolation target for
`local-user-installed` connections. Isolation is not a V1 acceptance
precondition, because requiring it would block every legitimate local MCP server
on platforms lacking the adapter. Its absence is surfaced per connection and
narrows the enforceable limit set per A6.

**A9. Audit on lifecycle, not only on calls.** Launch approval, launch, digest
verification result, and termination each produce audit records.

### Part B: HTTP destination-bound egress policy

**B1. Protocol allowlist.** HTTPS only. A local-development exemption permitting
HTTP exists as a per-connection flag, never a global mode, and is displayed on
the connection in Rig.

**B2. Network scope policy.** Loopback, private ranges, link-local, unique local
addresses, and cloud metadata endpoints are denied by default. Exemptions are
per connection, explicit, and labeled.

**B3. Destination binding.** This is the operative anti-rebinding control, and
revalidating DNS is not sufficient on its own. If PaneTera resolves and
validates a hostname, and the HTTP client then resolves it again independently,
the two answers can differ and only the second one matters.

The connection must therefore be bound to the validated resolved destination.
One of the following is required:

- a transport client with controlled DNS resolution, where the resolver returns
  only the validated address and the connection is made to that address with the
  original hostname preserved for TLS SNI and `Host`; or
- an egress proxy that independently enforces the network policy for every
  outbound connection.

Validation and connection must not be two independent resolutions of the same
name.

**B4. Redirect revalidation.** Every redirect hop is revalidated against B1, B2,
and B3 before it is followed. Redirect chains are depth-bounded. This is
required in addition to B3, not as an alternative to it.

**B5. TLS.** Certificate validation is mandatory and not disableable through
configuration.

Pinning does not substitute for a valid chain. With validation mandatory, a
pinned self-signed certificate still fails chain verification, so pinning alone
does not make the self-signed case work. Three supported paths, and no fourth:

1. **HTTPS under system trust.** The default.
2. **Per-connection custom trust anchor.** The user explicitly imports a CA or
   certificate for one connection. The anchor is scoped to that connection and
   never added to system or process-wide trust. This is the supported route for
   self-signed and internal-CA servers.
3. **Optional pinning in addition to a valid chain.** Pinning narrows an
   already-valid connection. It never rescues an invalid one.

A global "disable TLS verification" escape remains rejected.

**B6. Limits.** Connection timeout, response timeout, and maximum response size.

Streamable HTTP requires more than a conventional response ceiling, because a
long-lived stream never presents a single bounded response. Additionally:

- maximum per-message size, enforced before parse;
- maximum aggregate bytes per connection and per session;
- maximum event rate, with a declared behaviour on breach;
- maximum stream duration.

All are enforced at the transport layer, before parsing, and breach terminates
the stream with an audit record rather than truncating silently.

**B7. Credential origin binding.** Credentials attach to exactly one validated
origin. They are not sent on any redirect that changes scheme, host, or port.
This is distinct from B4: redirect revalidation prevents reaching a forbidden
destination, and credential binding prevents handing the credential to a
permitted but different one.

### Part C: shared

**C1. Credential material is referenced, never stored inline.** Connection
records hold a `secretRef` handle. Material lives in the OS keychain. Where
keychain integration is unavailable, authenticated external connections are
deferred rather than backed by an improvised encrypted store. Unauthenticated
connections may ship first.

**C2. Connection state is auditable.** Establishment, failure, authentication
requirement, and termination produce audit records correlated by
`connectionId`.

## Alternatives Considered and Rejected

**A. Treat connection configuration as settings, gate only tool invocation.**
Rejected. This is the primary threat. A stdio connection form would become an
arbitrary-execution primitive reachable without approval, and every downstream
gate would be decorative.

**B. Accept shell command strings for convenience.** Rejected. Shell strings
require quoting discipline at every layer and turn argument handling into a
parsing problem. The convenience is real and the failure mode is command
injection. Users needing shell semantics can approve a wrapper script as an
executable, which is visible, digestible, and inspectable.

**C. Inherit the parent environment and deny-list known secrets.** Rejected. A
deny-list fails open on every variable added later, including ones added by
future PaneTera work. Deny-by-default fails closed.

**D. Validate the URL once at connection time.** Rejected. This is precisely the
DNS rebinding hole. Validation and connection must not be independent
resolutions.

**E. Reuse the public web-preview URL validator.** Rejected. It is calibrated for
a surface holding no authority. Reusing it would imply the two surfaces carry
equivalent risk, which is the specific confusion this ADR exists to prevent.

**F. Disable TLS verification behind a configuration flag.** Rejected. Such flags
migrate into default configurations and then into documentation. The legitimate
self-signed and internal-CA cases are covered by a per-connection custom trust
anchor (B5.2), which keeps chain verification intact and scopes the exception to
one connection. Pinning does not serve this purpose: with validation mandatory,
a pinned self-signed chain still fails.

**I. Approve the executable and allow arguments to vary.** Rejected. An
interpreter or runner passes an executable digest check while executing
arbitrary code supplied through argv. Approval that does not cover argv,
entry point, cwd, and environment is approval of almost nothing.

**G. Require container isolation for all stdio connections in V1.** Rejected as a
V1 gate. Isolation is desirable and the interface must permit it, but requiring
it would block every legitimate local MCP server on platforms where the
container adapter is unavailable. A8 keeps it as a target rather than a
precondition.

**H. Allow the model to initiate connections.** Rejected without qualification.
Connection is an approval-gated user act. A `needs-capability` intent may offer a
Rig connection to the user. It never performs one, and it never installs
anything.

## Consequences

**Positive.** Connection establishment enters the same approval, policy, and
audit lifecycle as capability invocation, so there is one governance story rather
than a gap ahead of the first gate. Digest pinning gives launch-time detection of
a substituted executable. Destination binding closes rebinding rather than
narrowing it.

**Positive.** The environment allowlist has a useful secondary effect: an
external MCP server cannot discover PaneTera's own secrets even if it is
malicious and even if it is invoked entirely within policy.

**Negative.** Adding a local MCP server becomes several steps rather than one
paste. This is a real cost and the correct trade, but it argues for good defaults
and a clear approval UI rather than for relaxing the rule.

**Negative.** Destination binding requires either a custom transport client or an
egress proxy. Neither is free, and the SDK's default HTTP client will not satisfy
B3 unmodified.

**Negative.** The existing workspace adapter spawns `npx tsx` with an inherited
environment and `PATH`-resolved binaries, which does not satisfy A2 or A4. It is
`panetera-managed` and predates this ADR, so it is not an immediate
vulnerability of the same class, but it is now explicitly non-compliant and
carries a migration obligation.

## Security Implications

This ADR defines the boundary at which PaneTera stops being a closed system. Its
central claim is that the first consequential moment for an external MCP server
is connection, not invocation, and that governance placed only at invocation is
governance placed one step too late.

The stdio rules address local arbitrary execution. The HTTP rules address SSRF,
DNS rebinding, redirect-based network traversal, and credential leakage to
unintended origins. The environment allowlist addresses secret exfiltration by an
otherwise policy-compliant server.

Together with `RIG_MCP_CONNECTION_ARCHITECTURE.md`, which governs what happens
after a connection exists, this preserves the invariant:

> Context can inform reasoning; capability can propose action; only policy and
> explicit authority can permit execution.

## Migration Implications

No external MCP connections exist today, so there is no external migration path.

Internally, the workspace adapter's launch path becomes non-compliant with A2 and
A4 on acceptance of this ADR. The obligation is recorded and sequenced at Stage 4
of the architecture document. It is not urgent, because the executable is
PaneTera's own script rather than a user-supplied binary, but it must not be
grandfathered permanently: a rule that exempts the only existing implementation
teaches the wrong default to every future one.

The Browser Operator façade is unaffected. It is in-process and inbound, and
remains governed by ADR-001.
