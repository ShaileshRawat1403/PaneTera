import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../../theme/tokens';
import type { RigCapability, RigConnection, RigPermission } from '../../rig/types';
import { StructuredResult } from './StructuredResult';
import { BrowserOperatorConnection } from './BrowserOperatorConnection';
import { loadRigConnections, loadRigProvenance, resolveRigConnectionsView, resolveRigInteractionMode } from './rigLoadingModel';
import {
  resolveConnectionCard,
  actionLabel,
  inventoryLabel,
} from './connectionCardModel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface Props {
  token: string;
  onClose: () => void;
  onResourcesChanged?: () => void;
}

async function rigRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Rig returned an unreadable response (${response.status}).`);
    }
  }
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Rig request failed (${response.status})`);
  }
  return payload as T;
}

/**
 * The capability kinds, in fixed display order, with their section heading and
 * the singular noun used in each capability's identity line. Grouping the flat
 * inventory by kind gives the expanded card a scannable structure.
 */
const CAPABILITY_GROUPS = [
  { kind: 'tool', field: 'tools', heading: 'Tools', noun: 'Tool' },
  { kind: 'resource', field: 'resources', heading: 'Resources', noun: 'Resource' },
  { kind: 'prompt', field: 'prompts', heading: 'Prompts', noun: 'Prompt' },
] as const;

/** Map a semantic card tone to a theme colour. Colour is a reinforcement of the
 *  status words and attention icon, never the only signal. */
function cardToneColor(tone: 'neutral' | 'muted' | 'attention' | 'danger'): string {
  switch (tone) {
    case 'attention': return status.brass;
    case 'danger': return status.danger;
    case 'muted': return ink.muted;
    case 'neutral':
    default: return status.neutral;
  }
}

export function RigPanel(props: Props): React.ReactElement {
  // A token change is a new principal. Remounting the whole session by token
  // discards every piece of prior-principal state at once — connections,
  // provenance, open review and remove dialogs, proposals, results, and the
  // paired-device pairing state held in the child — so none of it can render or
  // persist under the new token. Keying is applied at render, so the previous
  // principal's data cannot paint even briefly under the new one.
  return <RigPanelSession key={props.token} {...props} />;
}

function RigPanelSession({ token, onClose, onResourcesChanged }: Props): React.ReactElement {
  const [connections, setConnections] = useState<RigConnection[]>([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);
  const [provenanceLoaded, setProvenanceLoaded] = useState(false);
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [transport, setTransport] = useState<'stdio' | 'http'>('stdio');
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [cwd, setCwd] = useState('');
  const [argv, setArgv] = useState('');
  const [localDevelopment, setLocalDevelopment] = useState(false);
  const [bearerToken, setBearerToken] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ severity: 'error' | 'info'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toolArguments, setToolArguments] = useState<Record<string, string>>({});
  const [proposals, setProposals] = useState<Record<string, { proposalId: string }>>({});
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [review, setReview] = useState<{ connectionId: string; value: Record<string, unknown> } | null>(null);
  const [removeConnectionId, setRemoveConnectionId] = useState<string | null>(null);
  const [provenanceRecords, setProvenanceRecords] = useState<Array<Record<string, unknown>>>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);

  // Monotonic ids for connection and provenance loads. Refreshes and post-action
  // reloads can overlap; only the newest of each may publish, so an older
  // response can never overwrite newer data or drop a stale banner over it.
  const connectionsGen = useRef(0);
  const provenanceGen = useRef(0);

  const load = useCallback(async () => {
    const gen = ++connectionsGen.current;
    setConnectionsLoading(true);
    const result = await loadRigConnections(fetch as never, token);
    if (gen !== connectionsGen.current) return; // A newer load superseded this one; ignore it.
    if (result.ok) {
      setConnections(result.connections);
      setConnectionsLoaded(true);
      setConnectionsError(null);
    } else {
      // Preserve the last successful inventory so a failed refresh degrades to a
      // stale banner instead of silently blanking or reading as an empty Rig.
      setConnectionsError(result.reason);
    }
    setConnectionsLoading(false);
  }, [token]);

  // Provenance loads on its own error channel and its own generation guard. A
  // provenance failure never touches connection state, a malformed response is
  // an explicit failure rather than a silent empty set, and the last valid
  // records are preserved and disclosed as stale rather than cleared.
  const loadProvenance = useCallback(async () => {
    const gen = ++provenanceGen.current;
    setProvenanceLoading(true);
    const result = await loadRigProvenance(fetch as never, token);
    if (gen !== provenanceGen.current) return;
    if (result.ok) {
      setProvenanceRecords(result.records);
      setProvenanceError(null);
      setProvenanceLoaded(true);
    } else {
      setProvenanceError(result.reason);
    }
    setProvenanceLoading(false);
  }, [token]);

  // Token isolation is handled by remounting the session (see RigPanel), so this
  // instance always belongs to a single token and simply loads on mount.
  useEffect(() => {
    void load();
    void loadProvenance();
  }, [load, loadProvenance]);

  const connectionsView = useMemo(
    () => resolveRigConnectionsView({ loaded: connectionsLoaded, connections, error: connectionsError }),
    [connectionsLoaded, connections, connectionsError],
  );
  const connectionsKnown = connectionsView.status === 'ready' || connectionsView.status === 'empty' || connectionsView.status === 'stale';
  // Only a current successful load proves what is available. A stale (cached)
  // inventory must not claim resources "are available", because a cached list
  // does not prove current availability.
  const connectionsAuthoritative = connectionsView.status === 'ready' || connectionsView.status === 'empty';
  const showConnectionList = connectionsView.status === 'ready' || connectionsView.status === 'stale';

  // One interaction mode, derived from the loading model. Cached cards stay
  // readable and inspectable, but consequential, state-dependent actions are only
  // safe when the shown state is current and no refresh is racing them.
  const interactionMode = resolveRigInteractionMode(connectionsView, connectionsLoading);
  const canMutate = interactionMode === 'live';
  const mutationPausedReason = interactionMode === 'refreshing'
    ? 'Refreshing connections. Actions are paused until the current state loads.'
    : interactionMode === 'stale'
      ? 'Showing cached connections. Refresh to load the current state before acting.'
      : null;
  // A shared id so every paused control names, to assistive technology, why it is
  // disabled — the explanation is text, never colour alone.
  const pausedDescribedBy = canMutate ? undefined : 'rig-actions-paused';

  const enabledResources = useMemo(
    () => connections.flatMap((connection) => connection.capabilities.resources.filter((item) => item.enabled)),
    [connections],
  );

  const create = async () => {
    setBusy('create');
    setNotice(null);
    try {
      let parsedArgv: string[] = [];
      if (transport === 'stdio') {
        const candidate = JSON.parse(argv.trim() || '[]');
        if (!Array.isArray(candidate) || candidate.some((item) => typeof item !== 'string')) {
          throw new Error('Arguments must be a JSON array of strings.');
        }
        parsedArgv = candidate;
      }
      const body = transport === 'stdio'
        ? {
            displayName: name,
            transport: {
              kind: 'stdio',
              executablePath: endpoint,
              argv: parsedArgv,
              cwd,
              environment: [],
              isolationMode: 'none',
            },
          }
        : {
            displayName: name,
            transport: { kind: 'http', url: endpoint, localDevelopment, authRef: null },
            ...(bearerToken ? { credential: { bearerToken } } : {}),
          };
      await rigRequest(token, '/api/rig/connections', { method: 'POST', body: JSON.stringify(body) });
      setName('');
      setEndpoint('');
      setCwd('');
      setArgv('');
      setBearerToken('');
      await load();
      setNotice({ severity: 'info', text: 'Connection recorded. Review and approve it before PaneTera connects.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const act = async (connectionId: string, action: 'stop' | 'refresh') => {
    setBusy(`${connectionId}:${action}`);
    setNotice(null);
    try {
      await rigRequest(token, `/api/rig/connections/${encodeURIComponent(connectionId)}/${action}`, { method: 'POST' });
      await load();
      onResourcesChanged?.();
      setNotice({ severity: 'info', text: `Connection ${action} complete.` });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const reviewConnection = async (connectionId: string) => {
    setBusy(`${connectionId}:review`);
    setNotice(null);
    try {
      const payload = await rigRequest<{ review: Record<string, unknown> }>(
        token,
        `/api/rig/connections/${encodeURIComponent(connectionId)}/review`,
      );
      setReview({ connectionId, value: payload.review });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const connectReviewed = async () => {
    if (!review || typeof review.value.reviewDigest !== 'string') return;
    const { connectionId } = review;
    setBusy(`${connectionId}:approve`);
    try {
      await rigRequest(token, `/api/rig/connections/${encodeURIComponent(connectionId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewDigest: review.value.reviewDigest }),
      });
      setReview(null);
      await load();
      onResourcesChanged?.();
      setNotice({ severity: 'info', text: 'Connected and capability inventory discovered.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const removeConnection = async () => {
    if (!removeConnectionId) return;
    setBusy(`${removeConnectionId}:remove`);
    setNotice(null);
    try {
      await rigRequest(token, `/api/rig/connections/${encodeURIComponent(removeConnectionId)}`, { method: 'DELETE' });
      setRemoveConnectionId(null);
      if (expanded === removeConnectionId) setExpanded(null);
      await load();
      onResourcesChanged?.();
      setNotice({ severity: 'info', text: 'Rig connection removed. The external server and its data were not modified.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const setPolicy = async (connectionId: string, capability: RigCapability, enabled: boolean, permission: RigPermission) => {
    setBusy(capability.capabilityId);
    try {
      await rigRequest(token,
        `/api/rig/connections/${encodeURIComponent(connectionId)}/capabilities/${encodeURIComponent(capability.capabilityId)}`,
        { method: 'PUT', body: JSON.stringify({ enabled, permission }) });
      await load();
      onResourcesChanged?.();
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const propose = async (connectionId: string, capability: RigCapability) => {
    try {
      const raw = toolArguments[capability.capabilityId]?.trim() || '{}';
      const args = JSON.parse(raw);
      const payload = await rigRequest<{ proposal: { proposalId: string } }>(token, '/api/rig/proposals', {
        method: 'POST',
        body: JSON.stringify({ connectionId, capabilityId: capability.capabilityId, arguments: args }),
      });
      setProposals((current) => ({ ...current, [capability.capabilityId]: payload.proposal }));
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : 'Arguments must be valid JSON.' });
    }
  };

  const approveAndRun = async (connectionId: string, capability: RigCapability) => {
    const proposal = proposals[capability.capabilityId];
    if (!proposal) return;
    setBusy(capability.capabilityId);
    try {
      const args = JSON.parse(toolArguments[capability.capabilityId]?.trim() || '{}');
      const approved = await rigRequest<{ approval: { approvalId: string } }>(
        token,
        `/api/rig/proposals/${encodeURIComponent(proposal.proposalId)}/approve`,
        { method: 'POST' },
      );
      const invoked = await rigRequest<{ result: unknown }>(token, '/api/rig/invocations', {
        method: 'POST',
        body: JSON.stringify({
          connectionId,
          capabilityId: capability.capabilityId,
          approvalId: approved.approval.approvalId,
          arguments: args,
        }),
      });
      setResults((current) => ({ ...current, [capability.capabilityId]: invoked.result }));
      await loadProvenance();
      setProposals((current) => {
        const next = { ...current };
        delete next[capability.capabilityId];
        return next;
      });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const loadPrompt = async (connectionId: string, capability: RigCapability) => {
    setBusy(capability.capabilityId);
    try {
      const raw = toolArguments[capability.capabilityId]?.trim() || '{}';
      const args = JSON.parse(raw);
      if (!args || typeof args !== 'object' || Array.isArray(args) || Object.values(args).some((value) => typeof value !== 'string')) {
        throw new Error('Prompt arguments must be a JSON object containing only strings.');
      }
      const payload = await rigRequest<{ result: unknown }>(token, '/api/rig/prompts/get', {
        method: 'POST',
        body: JSON.stringify({ connectionId, capabilityId: capability.capabilityId, arguments: args }),
      });
      setResults((current) => ({ ...current, [capability.capabilityId]: payload.result }));
      await loadProvenance();
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box component="section" aria-labelledby="rig-title" sx={{ height: '100%', overflowY: 'auto', p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Box>
          <Typography id="rig-title" variant="h6">Rig</Typography>
          <Typography variant="caption" sx={{ color: ink.secondary }}>
            MCP connections, capabilities, permissions, and evidence.
          </Typography>
        </Box>
        <Stack direction="row" gap={0.5}>
          <Button aria-label="Refresh Rig connections" disabled={connectionsLoading} onClick={() => { void load(); void loadProvenance(); }}>
            {connectionsLoading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button onClick={onClose} aria-label="Close Rig">Close</Button>
        </Stack>
      </Stack>

      {notice && (
        <Alert
          severity={notice.severity}
          sx={{ mt: 2 }}
          action={notice.severity === 'error' ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setNotice(null);
                void load().catch((error: Error) => setNotice({ severity: 'error', text: error.message }));
              }}
            >
              Retry
            </Button>
          ) : undefined}
        >
          {notice.text}
        </Alert>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="overline" sx={{ color: ink.secondary }}>This device</Typography>
        <BrowserOperatorConnection token={token} />
      </Box>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2.5, mb: 1 }}>
        <Box>
          <Typography variant="subtitle2">MCP servers</Typography>
          <Typography variant="caption" sx={{ color: ink.secondary }}>Local tools and remote services you explicitly govern.</Typography>
        </Box>
        <Button size="small" variant="outlined" aria-expanded={showAddServer} onClick={() => setShowAddServer((value) => !value)}>
          {showAddServer ? 'Cancel' : 'Add server'}
        </Button>
      </Stack>

      <Collapse in={showAddServer} unmountOnExit>
      <Box sx={{ p: 1.5, mb: 1.5, border: `1px solid ${surface.border}`, borderRadius: `${radius.md}px`, backgroundColor: surface.sunken }}>
        <Typography variant="subtitle2">New MCP server</Typography>
        <Tabs value={transport} onChange={(_, value) => setTransport(value)} sx={{ minHeight: 36 }}>
          <Tab value="stdio" label="Local stdio" />
          <Tab value="http" label="Remote HTTP" />
        </Tabs>
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          <TextField size="small" label="Connection name" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            size="small"
            label={transport === 'stdio' ? 'Absolute executable path' : 'MCP endpoint URL'}
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
          {transport === 'stdio' ? (
            <>
              <TextField size="small" label="Absolute working directory" value={cwd} onChange={(event) => setCwd(event.target.value)} />
              <TextField size="small" label="Arguments (JSON array)" helperText={'Exact ordered strings, for example ["/absolute/server.js", "--flag"].'} value={argv} onChange={(event) => setArgv(event.target.value)} />
              <Alert severity="info">Connection approval binds the executable, arguments, working directory, environment, and digests.</Alert>
            </>
          ) : (
            <>
              <TextField
                size="small"
                type="password"
                label="Bearer token (optional)"
                helperText="Stored in the macOS Keychain. PaneTera never writes it to its registry or audit log."
                value={bearerToken}
                onChange={(event) => setBearerToken(event.target.value)}
                autoComplete="off"
              />
              <FormControlLabel
                control={<Checkbox checked={localDevelopment} onChange={(event) => setLocalDevelopment(event.target.checked)} />}
                label="Allow an explicitly local HTTP endpoint"
              />
            </>
          )}
          <Button variant="outlined" disabled={!name.trim() || !endpoint.trim() || busy === 'create'} onClick={create}>
            Record for review
          </Button>
        </Stack>
      </Box>
      </Collapse>

      <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 1 }}>
        Connections{connectionsKnown ? ` (${connections.length})` : ''}
      </Typography>

      {connectionsView.status === 'loading' && (
        <Typography variant="body2" sx={{ color: ink.secondary }}>Loading Rig connections…</Typography>
      )}

      {connectionsView.status === 'error' && (
        <Alert
          severity="error"
          action={(
            <Button color="inherit" size="small" disabled={connectionsLoading} onClick={() => void load()}>
              {connectionsLoading ? 'Retrying…' : 'Retry'}
            </Button>
          )}
        >
          {connectionsView.reason}
        </Alert>
      )}

      {connectionsView.status === 'stale' && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={(
            <Button color="inherit" size="small" disabled={connectionsLoading} onClick={() => void load()}>
              {connectionsLoading ? 'Retrying…' : 'Retry'}
            </Button>
          )}
        >
          Showing cached connections. {connectionsView.reason}
        </Alert>
      )}

      {connectionsView.status === 'empty' && (
        <Typography variant="body2" sx={{ color: ink.secondary }}>No MCP servers connected yet.</Typography>
      )}

      {showConnectionList && !canMutate && mutationPausedReason && (
        <Typography
          id="rig-actions-paused"
          role="status"
          variant="caption"
          sx={{ display: 'block', color: status.brass, mb: 1 }}
        >
          {mutationPausedReason}
        </Typography>
      )}

      {showConnectionList && (
      <Stack spacing={1.25}>
        {connections.map((connection) => {
          const capabilities = [
            ...connection.capabilities.tools,
            ...connection.capabilities.resources,
            ...connection.capabilities.prompts,
          ];
          const isExpanded = expanded === connection.connectionId;
          const card = resolveConnectionCard({
            state: connection.state,
            health: connection.health.state,
            capabilityCount: capabilities.length,
            discoveredAt: connection.capabilities.discoveredAt,
            truncated: connection.capabilities.truncated,
          });
          const toneColor = cardToneColor(card.tone);
          const showRefresh = card.secondaryActions.includes('refresh');
          const showStop = card.secondaryActions.includes('stop');
          return (
            <Box
              key={connection.connectionId}
              // A card that needs attention gets a stronger left keyline in its
              // tone, so attention is carried by structure, not colour alone.
              sx={{
                border: `1px solid ${card.needsAttention ? toneColor : surface.border}`,
                borderLeft: card.needsAttention ? `3px solid ${toneColor}` : `1px solid ${surface.border}`,
                borderRadius: `${radius.md}px`,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    {/* The connection name is the semantic parent of its capability
                        group headings (h4). It keeps its subtitle2 visual size. */}
                    <Typography component="h3" variant="subtitle2" sx={{ m: 0 }}>{connection.displayName}</Typography>
                    <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ mt: 0.25 }}>
                      {card.needsAttention && (
                        <WarningAmberIcon aria-hidden sx={{ fontSize: 14, color: toneColor }} />
                      )}
                      <Typography variant="caption" sx={{ color: toneColor, fontWeight: 600 }}>
                        {card.statusText}
                      </Typography>
                      {card.healthText && (
                        <Typography variant="caption" sx={{ color: toneColor }}>
                          · {card.healthText}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono }}>
                        · {connection.transport.kind}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 0.25 }}>
                      {inventoryLabel(capabilities.length, card.inventoryFreshness, card.inventoryTruncated)}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end" alignItems="center">
                    {card.primaryAction === 'review-connect' && (
                      // The recovery path, given the clearest affordance.
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => reviewConnection(connection.connectionId)}
                        disabled={Boolean(busy) || !canMutate}
                        aria-describedby={pausedDescribedBy}
                        sx={{
                          color: ink.primary,
                          borderColor: accent.violetBorder,
                          '&:hover': { backgroundColor: accent.violetMuted, borderColor: accent.violetBorder },
                        }}
                      >
                        {actionLabel('review-connect', connection.state)}
                      </Button>
                    )}
                    {showRefresh && (
                      <Button size="small" onClick={() => act(connection.connectionId, 'refresh')} disabled={Boolean(busy) || !canMutate} aria-describedby={pausedDescribedBy}>Refresh</Button>
                    )}
                    {showStop && (
                      <Button size="small" onClick={() => act(connection.connectionId, 'stop')} disabled={Boolean(busy) || !canMutate} aria-describedby={pausedDescribedBy}>Stop</Button>
                    )}
                    <Button size="small" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : connection.connectionId)}>
                      {isExpanded
                        ? 'Hide'
                        : `Inspect (${capabilities.length}${card.inventoryTruncated ? ' shown' : ''})`}
                    </Button>
                    {/* Removal is destructive, so it sits last and quiet, set off
                        by a hairline, revealing its danger only on hover. The
                        confirmation dialog remains the real guard. */}
                    <Box aria-hidden sx={{ width: '1px', alignSelf: 'stretch', backgroundColor: surface.border, mx: 0.25 }} />
                    <Button
                      size="small"
                      onClick={() => setRemoveConnectionId(connection.connectionId)}
                      disabled={Boolean(busy) || !canMutate}
                      aria-describedby={pausedDescribedBy}
                      sx={{ color: ink.muted, '&:hover': { color: status.danger, backgroundColor: surface.sunken } }}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Stack>
              </Box>
              <Collapse in={isExpanded}>
                <Divider />
                <Stack spacing={1.5} sx={{ p: 1.5, backgroundColor: surface.sunken }}>
                  {connection.transport.kind === 'stdio' && connection.transport.isolationMode === 'none' && (
                    <Alert severity="warning">Memory, CPU, file-descriptor, and filesystem isolation are not enforced for this connection.</Alert>
                  )}
                  {connection.capabilities.truncated && <Alert severity="warning">The capability inventory was truncated. One or more groups may be incomplete; counts show items returned.</Alert>}
                  {capabilities.length === 0 && <Typography variant="caption" sx={{ color: ink.secondary }}>No capabilities discovered.</Typography>}

                  {CAPABILITY_GROUPS.map((group) => {
                    const items = connection.capabilities[group.field];
                    if (items.length === 0) return null;
                    // A truncated inventory can hide members of any group, so the
                    // count is qualified as "shown" and never implies completeness.
                    const countLabel = connection.capabilities.truncated ? `${items.length} shown` : `${items.length}`;
                    const headingId = `rig-cap-group-${connection.connectionId}-${group.field}`;
                    return (
                      <Box key={group.field} component="section" aria-labelledby={headingId}>
                        <Typography
                          id={headingId}
                          component="h4"
                          variant="overline"
                          sx={{ display: 'block', color: ink.muted, fontWeight: 700, letterSpacing: '0.06em', mb: 0.5 }}
                        >
                          {group.heading} · {countLabel}
                        </Typography>
                        <Stack spacing={1}>
                          {items.map((capability) => (
                            <Box key={capability.capabilityId} sx={{ p: 1.25, border: `1px solid ${surface.border}`, borderRadius: `${radius.sm}px`, backgroundColor: surface.raised }}>
                              {/* Identity leads; the governance controls sit to the
                                  right and wrap beneath the identity on narrow widths. */}
                              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} flexWrap="wrap">
                                <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
                                  <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600 }}>
                                    {capability.label || capability.name}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: ink.muted, display: 'block' }}>
                                    {/* The noun comes from the capability's own kind, not its enclosing
                                        group, so array placement can never relabel it. */}
                                    {capability.kind === 'tool' ? 'Tool' : capability.kind === 'resource' ? 'Resource' : 'Prompt'}
                                    {' · '}{capability.enabled ? 'Enabled' : 'Disabled'}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    title={capability.capabilityId}
                                    sx={{ color: ink.secondary, fontFamily: typography.mono, display: 'block', overflowWrap: 'anywhere' }}
                                  >
                                    {capability.capabilityId}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.25 }}>
                                    {capability.description.text}
                                  </Typography>
                                </Box>
                                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                                  <Checkbox
                                    size="small"
                                    aria-label={`Enable ${capability.capabilityId}`}
                                    aria-describedby={pausedDescribedBy}
                                    checked={capability.enabled}
                                    disabled={Boolean(busy) || !canMutate}
                                    onChange={(event) => setPolicy(connection.connectionId, capability, event.target.checked, 'proposable')}
                                  />
                                  <Select
                                    size="small"
                                    value={capability.permission}
                                    disabled={!capability.enabled || connection.sourceClass !== 'panetera-managed' || Boolean(busy) || !canMutate}
                                    onChange={(event) => setPolicy(connection.connectionId, capability, true, event.target.value as RigPermission)}
                                    aria-label={`Permission for ${capability.capabilityId}`}
                                    aria-describedby={pausedDescribedBy}
                                  >
                                    <MenuItem value="denied">Denied</MenuItem>
                                    <MenuItem value="proposable">Approval each time</MenuItem>
                                    {connection.sourceClass === 'panetera-managed' && <MenuItem value="auto-invocable">Automatic</MenuItem>}
                                  </Select>
                                </Stack>
                              </Stack>

                              {capability.kind === 'tool' && capability.enabled && capability.permission === 'proposable' && (
                                <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${surface.border}` }}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    multiline
                                    minRows={2}
                                    label="Arguments (JSON)"
                                    value={toolArguments[capability.capabilityId] ?? '{}'}
                                    onChange={(event) => setToolArguments((current) => ({ ...current, [capability.capabilityId]: event.target.value }))}
                                  />
                                  {proposals[capability.capabilityId] ? (
                                    <Alert
                                      severity="warning"
                                      sx={{ mt: 1 }}
                                      action={<Button onClick={() => approveAndRun(connection.connectionId, capability)} disabled={Boolean(busy) || !canMutate} aria-describedby={pausedDescribedBy}>Approve and run</Button>}
                                    >
                                      Review the exact connection, capability, and arguments before running once.
                                    </Alert>
                                  ) : (
                                    <Button size="small" sx={{ mt: 0.75 }} onClick={() => propose(connection.connectionId, capability)} disabled={Boolean(busy) || !canMutate} aria-describedby={pausedDescribedBy}>
                                      Review invocation
                                    </Button>
                                  )}
                                  {capability.capabilityId in results && (
                                    <StructuredResult value={results[capability.capabilityId]} />
                                  )}
                                </Box>
                              )}

                              {capability.kind === 'prompt' && capability.enabled && capability.permission !== 'denied' && (
                                <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${surface.border}` }}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Prompt arguments (JSON string map)"
                                    value={toolArguments[capability.capabilityId] ?? '{}'}
                                    onChange={(event) => setToolArguments((current) => ({ ...current, [capability.capabilityId]: event.target.value }))}
                                  />
                                  <Button size="small" sx={{ mt: 0.75 }} onClick={() => loadPrompt(connection.connectionId, capability)} disabled={Boolean(busy) || !canMutate} aria-describedby={pausedDescribedBy}>
                                    Load prompt
                                  </Button>
                                  {capability.capabilityId in results && <StructuredResult value={results[capability.capabilityId]} label="Untrusted MCP prompt" />}
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
      )}

      {connectionsAuthoritative && (
        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 2 }}>
          {enabledResources.length} MCP resources are available to the context picker.
        </Typography>
      )}
      {connectionsView.status === 'stale' && (
        <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 2 }}>
          Resource availability is unknown until the connection list refreshes.
        </Typography>
      )}
      <Button
        size="small"
        sx={{ mt: 1 }}
        aria-expanded={showProvenance}
        onClick={() => {
          setShowProvenance((value) => !value);
          if (!showProvenance) void loadProvenance();
        }}
      >
        {showProvenance ? 'Hide' : 'Show'} provenance ({
          provenanceError && provenanceRecords.length === 0
            ? 'unavailable'
            : provenanceError && provenanceRecords.length > 0
              // Cached records after a failed refresh. The collapsed control must
              // disclose the same staleness the expanded alert does, so the count
              // is never read as current availability.
              ? `${provenanceRecords.length} cached`
              : (!provenanceLoaded && provenanceRecords.length === 0)
                ? '…'
                : provenanceRecords.length
        })
      </Button>
      <Collapse in={showProvenance} unmountOnExit>
        {provenanceError && (
          <Alert
            severity={provenanceRecords.length > 0 ? 'warning' : 'error'}
            sx={{ mt: 1 }}
            action={(
              <Button color="inherit" size="small" onClick={() => void loadProvenance()}>Retry</Button>
            )}
          >
            {provenanceRecords.length > 0 ? `Showing cached provenance. ${provenanceError}` : provenanceError}
          </Alert>
        )}
        {provenanceRecords.length > 0 && (
          <StructuredResult value={provenanceRecords} label="Rig provenance records" />
        )}
        {provenanceRecords.length === 0 && !provenanceError && (
          (provenanceLoading || !provenanceLoaded)
            ? <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 1 }}>Loading provenance…</Typography>
            : <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 1 }}>No provenance records yet.</Typography>
        )}
      </Collapse>

      <Dialog open={Boolean(review)} onClose={() => setReview(null)} fullWidth maxWidth="md" aria-labelledby="rig-review-title">
        <DialogTitle id="rig-review-title">Review exact connection</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Connecting can start a local process or contact a remote service. Approve only this exact specification.
          </Alert>
          {/* The explanation lives inside the modal, because MUI hides the
              background from assistive technology while a dialog is open, so an
              aria-describedby pointing at the page behind it would be unreadable. */}
          {!canMutate && mutationPausedReason && (
            <Alert severity="info" role="status" sx={{ mb: 1.5 }}>{mutationPausedReason}</Alert>
          )}
          {review && <StructuredResult value={review.value} label="Connection specification and security checks" />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReview(null)}>Cancel</Button>
          <Button variant="contained" onClick={connectReviewed} disabled={Boolean(busy) || !canMutate}>Approve connection</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(removeConnectionId)}
        onClose={() => setRemoveConnectionId(null)}
        aria-labelledby="rig-remove-title"
      >
        <DialogTitle id="rig-remove-title">Remove this Rig connection?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: ink.secondary }}>
            PaneTera will stop the connection, forget its capability inventory, and remove its local record. The MCP server and its own data are not deleted.
          </Typography>
          {!canMutate && mutationPausedReason && (
            <Alert severity="info" role="status" sx={{ mt: 1.5 }}>{mutationPausedReason}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveConnectionId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={removeConnection} disabled={Boolean(busy) || !canMutate}>Remove connection</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
