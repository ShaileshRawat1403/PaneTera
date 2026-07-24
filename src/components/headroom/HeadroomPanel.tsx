import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from '@mui/material';
import { DrawerShell } from '../workstation/DrawerShell';
import { ink, radius, surface, typography } from '../../theme/tokens';
import { StructuredResult } from '../rig/StructuredResult';
import { createLoadGeneration } from './loadGeneration';

interface Envelope {
  envelopeId: string;
  createdAt: string;
  projectId: string | null;
  objective: string | null;
  context: unknown[];
  materialized: Array<{ measurement: { unit: string; value?: number } }>;
  exclusions: unknown[];
  pinnedCapsuleId: string | null;
}

export interface HeadroomCapsuleView {
  capsuleId: string;
  title: string;
  projectId: string | null;
  objective: string | null;
  decisions: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  changedUnderstanding: string[];
  context: unknown[];
  envelopeIds: string[];
  updatedAt: string;
}

interface TemporaryScope {
  id: string;
  kind: 'file' | 'folder';
  path: string;
  expiresAt: string;
  recursive: boolean;
  freshness: 'current' | 'needs-review' | 'stale';
}

interface HeadroomPanelProps {
  token: string;
  sessionId: string;
  projectId: string | null;
  objective: string;
  onObjectiveChange: (value: string) => void;
  onResume: (capsule: HeadroomCapsuleView | null) => void;
  onClose: () => void;
}

async function headroomRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
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
      throw new Error(`Headroom returned an unreadable response (${response.status}).`);
    }
  }
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Headroom request failed (${response.status})`);
  }
  return payload as T;
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

// Element guards for the load boundary. A single malformed element makes the whole
// load unreadable rather than reaching the renderer, which dereferences these fields
// without guarding — e.g. capsule.title, scope.path, and item.measurement.unit for
// each materialized item. Nested structures and enum values are validated to their
// canonical shapes so a `materialized: [null]`, a non-string envelope id, or an
// unknown scope kind cannot pass as authoritative and then crash the render.
const SCOPE_KINDS: ReadonlySet<string> = new Set(['file', 'folder']);
const SCOPE_FRESHNESS: ReadonlySet<string> = new Set(['current', 'needs-review', 'stale']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
/**
 * A canonical `toISOString()` timestamp — exactly `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC,
 * 3-digit milliseconds), which is what the server writes. The exact-shape regex
 * rejects offset and variable-fraction forms, and the round-trip equality rejects an
 * impossible calendar date such as `2026-02-30T00:00:00.000Z` that Date would
 * otherwise silently normalise to March 2. This keeps a bad `expiresAt`/`updatedAt`
 * from rendering "Invalid Date" or a wrong date.
 */
function isTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}
/**
 * The measurement must be canonical: the server type is `unit: 'bytes'` with a
 * required numeric value. An optional/absent value renders as an invented "0 bytes",
 * and a non-'bytes' unit is a schema mismatch, so both are rejected here.
 */
function isMaterializedItem(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const measurement = (value as Record<string, unknown>).measurement;
  if (!measurement || typeof measurement !== 'object') return false;
  const m = measurement as Record<string, unknown>;
  return m.unit === 'bytes' && typeof m.value === 'number' && Number.isFinite(m.value);
}
function isCapsule(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return typeof c.capsuleId === 'string' && typeof c.title === 'string'
    && (c.projectId === null || typeof c.projectId === 'string')
    && (c.objective === null || typeof c.objective === 'string')
    && isStringArray(c.decisions) && isStringArray(c.assumptions)
    && isStringArray(c.unresolvedQuestions) && isStringArray(c.changedUnderstanding)
    && Array.isArray(c.context) && isStringArray(c.envelopeIds)
    && isTimestamp(c.updatedAt);
}
function isScope(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.path === 'string'
    && typeof s.kind === 'string' && SCOPE_KINDS.has(s.kind)
    && typeof s.recursive === 'boolean'
    && typeof s.freshness === 'string' && SCOPE_FRESHNESS.has(s.freshness)
    && isTimestamp(s.expiresAt);
}
function isEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.envelopeId === 'string' && isTimestamp(e.createdAt)
    && Array.isArray(e.materialized) && e.materialized.every(isMaterializedItem);
}

export function HeadroomPanel({
  token,
  sessionId,
  projectId,
  objective,
  onObjectiveChange,
  onResume,
  onClose,
}: HeadroomPanelProps): React.ReactElement {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [capsules, setCapsules] = useState<HeadroomCapsuleView[]>([]);
  const [scopes, setScopes] = useState<TemporaryScope[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [decisions, setDecisions] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [questions, setQuestions] = useState('');
  const [changed, setChanged] = useState('');
  const [notice, setNotice] = useState<{ severity: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteCapsuleId, setDeleteCapsuleId] = useState<string | null>(null);
  // The load boundary, mirroring the Rig drawer. `loaded` distinguishes a first
  // load still in flight from an authoritative empty; `loadError` (kept apart from
  // the action `notice`) drives a hard error before any success and a stale
  // disclosure after one, so a failed load is never rendered as an empty Headroom.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // True while a load (initial, retry, or refresh) is in flight, so the Refresh and
  // Retry controls gate against overlapping loads and disclose their pending state.
  const [loadPending, setLoadPending] = useState(false);
  // Ordering coordinator: a superseded (older) response must never overwrite a newer
  // one or drop a stale banner over current data. Principal/session identity is handled
  // upstream by a token+session key on this panel in App, which remounts it — so within
  // one mount only same-token, same-session reloads (Refresh/Retry/actions) can overlap,
  // which is exactly what this coordinates.
  const generation = useRef(createLoadGeneration());

  const load = useCallback(async () => {
    setLoadPending(true);
    // The coordinator owns the ordering guard: only the latest run's commit/fail runs.
    await generation.current.run(
      () => Promise.all([
        headroomRequest<{ envelopes: unknown }>(token, `/api/headroom/envelopes?sessionId=${encodeURIComponent(sessionId)}`),
        headroomRequest<{ capsules: unknown }>(token, '/api/headroom/capsules'),
        headroomRequest<{ scopes: unknown }>(token, `/api/local-selection/scopes?sessionId=${encodeURIComponent(sessionId)}`),
      ]),
      {
        commit: ([envelopePayload, capsulePayload, scopePayload]) => {
          setLoadPending(false);
          // Authority boundary: only a response whose body carries the expected arrays,
          // each element canonical, is a load. A malformed top-level shape or a single
          // malformed element is unreadable and reported as a failure, never coerced
          // into an authoritative (possibly empty) Headroom, and never reaching the
          // renderer.
          const envelopes = (envelopePayload as { envelopes?: unknown }).envelopes;
          const capsules = (capsulePayload as { capsules?: unknown }).capsules;
          const scopes = (scopePayload as { scopes?: unknown }).scopes;
          if (
            !Array.isArray(envelopes) || !Array.isArray(capsules) || !Array.isArray(scopes)
            || !envelopes.every(isEnvelope) || !capsules.every(isCapsule) || !scopes.every(isScope)
          ) {
            setLoadError('Headroom returned data in an unexpected format.');
            return;
          }
          setEnvelopes(envelopes as Envelope[]);
          setCapsules(capsules as HeadroomCapsuleView[]);
          setScopes(scopes as TemporaryScope[]);
          setLoaded(true);
          setLoadError(null);
        },
        fail: (error) => {
          setLoadPending(false);
          // Keep any previously loaded data (it becomes disclosed-stale) rather than
          // clearing it into a false empty. A failure before the first success reads as
          // a hard error; after one, as stale.
          setLoadError(error instanceof Error ? error.message : String(error));
        },
      },
    );
  }, [sessionId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = capsules.find((capsule) => capsule.capsuleId === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    onObjectiveChange(selected.objective ?? '');
    setDecisions(selected.decisions.join('\n'));
    setAssumptions(selected.assumptions.join('\n'));
    setQuestions(selected.unresolvedQuestions.join('\n'));
    setChanged(selected.changedUnderstanding.join('\n'));
  }, [onObjectiveChange, selected]);

  const measurement = useMemo(() => {
    const latest = envelopes[0];
    if (!latest) return 'No turn recorded in this session.';
    const measurements = latest.materialized.map((item) => item.measurement);
    if (measurements.every((item) => item.unit === 'bytes')) {
      return `${measurements.reduce((total, item) => total + (item.value ?? 0), 0).toLocaleString()} bytes sent in the latest turn.`;
    }
    return 'Latest material is not fully measured.';
  }, [envelopes]);

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const body = {
        title: title || objective || 'Working context', projectId, objective: objective || null,
        decisions: lines(decisions), assumptions: lines(assumptions),
        unresolvedQuestions: lines(questions), changedUnderstanding: lines(changed),
        context: selected?.context ?? [], envelopeIds: selected?.envelopeIds ?? [],
      };
      const url = selected
        ? `/api/headroom/capsules/${encodeURIComponent(selected.capsuleId)}`
        : '/api/headroom/capsules';
      const method = selected ? 'PUT' : 'POST';
      const payload = await headroomRequest<{ capsule: HeadroomCapsuleView }>(token, url, { method, body: JSON.stringify(body) });
      setSelectedId(payload.capsule.capsuleId);
      await load();
      setNotice({ severity: 'info', text: 'Headroom capsule saved.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally { setBusy(false); }
  };

  const pinLatest = async () => {
    const latest = envelopes[0];
    if (!latest) return;
    setBusy(true);
    try {
      const payload = await headroomRequest<{ capsule: HeadroomCapsuleView }>(
        token,
        `/api/headroom/envelopes/${encodeURIComponent(latest.envelopeId)}/pin`,
        { method: 'POST', body: JSON.stringify({ title: title || objective || undefined }) },
      );
      setSelectedId(payload.capsule.capsuleId);
      await load();
      setNotice({ severity: 'info', text: 'Latest context pinned as a durable capsule. Temporary filesystem access was not retained.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally { setBusy(false); }
  };

  const revokeScope = async (scopeId: string) => {
    try {
      await headroomRequest(token, `/api/local-selection/scopes/${encodeURIComponent(scopeId)}/revoke`, { method: 'POST' });
      await load();
      setNotice({ severity: 'info', text: 'Temporary attachment scope revoked. The source was not modified.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  };

  const deleteCapsule = async () => {
    if (!deleteCapsuleId) return;
    setBusy(true);
    setNotice(null);
    try {
      await headroomRequest(token, `/api/headroom/capsules/${encodeURIComponent(deleteCapsuleId)}`, { method: 'DELETE' });
      if (selectedId === deleteCapsuleId) {
        setSelectedId(null);
        setTitle('');
        setDecisions('');
        setAssumptions('');
        setQuestions('');
        setChanged('');
        onObjectiveChange('');
        onResume(null);
      }
      setDeleteCapsuleId(null);
      await load();
      setNotice({ severity: 'info', text: 'Headroom capsule deleted. Its source files and projects were not modified.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      titleId="headroom-title"
      title="Headroom"
      description="Bounded context, decisions, freshness, and resumption."
      onClose={onClose}
      closeLabel="Close Headroom"
      onRefresh={() => void load()}
      refreshing={loadPending}
      refreshLabel="Refresh Headroom"
    >
      {notice && (
        <Alert
          severity={notice.severity}
          sx={{ mt: 1.5 }}
          action={notice.severity === 'error' ? (
            <Button
              color="inherit"
              size="small"
              disabled={loadPending}
              onClick={() => {
                setNotice(null);
                void load();
              }}
            >
              {loadPending ? 'Retrying…' : 'Retry'}
            </Button>
          ) : undefined}
        >
          {notice.text}
        </Alert>
      )}

      {/* Load state, kept distinct so unavailable data is never an authoritative
          empty and a hard failure is never rendered as empty. Same grammar as Rig:
          a quiet status line, an error Alert + Retry, and a stale warning Alert. */}
      {!loaded && !loadError && (
        <Typography role="status" variant="body2" sx={{ color: ink.secondary, mt: 1.5 }}>Loading Headroom…</Typography>
      )}
      {loadError && !loaded && (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={<Button color="inherit" size="small" disabled={loadPending} onClick={() => void load()}>{loadPending ? 'Retrying…' : 'Retry'}</Button>}
        >
          {loadError}
        </Alert>
      )}
      {loadError && loaded && (
        <Alert
          severity="warning"
          sx={{ mt: 1.5 }}
          action={<Button color="inherit" size="small" disabled={loadPending} onClick={() => void load()}>{loadPending ? 'Retrying…' : 'Retry'}</Button>}
        >
          Showing cached context. {loadError}
        </Alert>
      )}

      {loaded && (<>
      <Box sx={{ mt: 2, p: 1.5, border: `1px solid ${surface.border}`, borderRadius: `${radius.md}px` }}>
        <Typography variant="subtitle2">Current session</Typography>
        <Typography variant="body2" sx={{ color: ink.secondary }}>{measurement}</Typography>
        <Typography variant="caption" sx={{ color: ink.secondary, fontFamily: typography.mono }}>
          {envelopes.length} audited {envelopes.length === 1 ? 'turn' : 'turns'} · capacity percentage omitted because the model tokenizer and window are unknown
        </Typography>
        <Stack direction="row" gap={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={pinLatest} disabled={!envelopes.length || busy}>Pin latest context</Button>
          <Button size="small" onClick={() => { setSelectedId(null); setTitle(''); setDecisions(''); setAssumptions(''); setQuestions(''); setChanged(''); }}>New capsule</Button>
        </Stack>
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 2 }}>Temporary attachment scopes</Typography>
      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
        {scopes.map((scope) => (
          <Box key={scope.id} sx={{ p: 1, border: `1px solid ${surface.border}`, borderRadius: `${radius.sm}px` }}>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontFamily: typography.mono }}>{scope.path}</Typography>
                <Typography variant="caption" sx={{ color: ink.secondary }}>
                  {scope.kind} · {scope.recursive ? 'includes subfolders' : 'selected path only'} · {scope.freshness.replace('-', ' ')} · expires {new Date(scope.expiresAt).toLocaleTimeString()}
                </Typography>
              </Box>
              <Button size="small" onClick={() => revokeScope(scope.id)}>Revoke</Button>
            </Stack>
          </Box>
        ))}
        {scopes.length === 0 && <Typography variant="body2" sx={{ color: ink.secondary }}>No temporary local scopes are active.</Typography>}
      </Stack>

      <Typography variant="subtitle2" sx={{ mt: 2 }}>Durable capsules</Typography>
      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
        {capsules.map((capsule) => (
          <Button key={capsule.capsuleId} size="small" variant={selectedId === capsule.capsuleId ? 'contained' : 'outlined'} onClick={() => setSelectedId(capsule.capsuleId)}>
            {capsule.title}
          </Button>
        ))}
        {capsules.length === 0 && <Typography variant="body2" sx={{ color: ink.secondary }}>No context has been pinned yet.</Typography>}
      </Stack>

      <Divider sx={{ my: 2 }} />
      {selected && (
        <Stack direction="row" gap={1} sx={{ mb: 1.25 }}>
          <Button
            variant="outlined"
            onClick={() => {
              onResume(selected);
              setNotice({ severity: 'info', text: 'Capsule resumed. Its objective and user-authored context will accompany new turns.' });
            }}
          >
            Resume selected capsule
          </Button>
          <Button color="error" onClick={() => setDeleteCapsuleId(selected.capsuleId)}>Delete capsule</Button>
        </Stack>
      )}
      <Stack spacing={1.25}>
        <TextField size="small" label="Capsule title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField size="small" label="Current objective" value={objective} onChange={(event) => onObjectiveChange(event.target.value)} />
        <TextField size="small" multiline minRows={2} label="Decisions — one per line" value={decisions} onChange={(event) => setDecisions(event.target.value)} />
        <TextField size="small" multiline minRows={2} label="Assumptions — one per line" value={assumptions} onChange={(event) => setAssumptions(event.target.value)} />
        <TextField size="small" multiline minRows={2} label="Unresolved questions — one per line" value={questions} onChange={(event) => setQuestions(event.target.value)} />
        <TextField size="small" multiline minRows={2} label="Changed understanding — one per line" value={changed} onChange={(event) => setChanged(event.target.value)} />
        <Button variant="contained" onClick={save} disabled={busy || !(title.trim() || objective.trim())}>Save capsule</Button>
      </Stack>

      {envelopes[0] && <StructuredResult value={envelopes[0]} label="Latest audited envelope" />}
      </>)}

      <Dialog
        open={Boolean(deleteCapsuleId)}
        onClose={() => setDeleteCapsuleId(null)}
        aria-labelledby="headroom-delete-title"
      >
        <DialogTitle id="headroom-delete-title">Delete this Headroom capsule?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: ink.secondary }}>
            This removes PaneTera’s durable summary and links. It does not delete attached files, projects, or MCP data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCapsuleId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={deleteCapsule} disabled={busy}>Delete capsule</Button>
        </DialogActions>
      </Dialog>
    </DrawerShell>
  );
}
