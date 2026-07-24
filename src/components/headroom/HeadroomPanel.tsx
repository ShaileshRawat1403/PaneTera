import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from '@mui/material';
import { DrawerShell } from '../workstation/DrawerShell';
import { ink, radius, surface, typography } from '../../theme/tokens';
import { StructuredResult } from '../rig/StructuredResult';

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

  const load = useCallback(async () => {
    const [envelopePayload, capsulePayload, scopePayload] = await Promise.all([
      headroomRequest<{ envelopes: Envelope[] }>(token, `/api/headroom/envelopes?sessionId=${encodeURIComponent(sessionId)}`),
      headroomRequest<{ capsules: HeadroomCapsuleView[] }>(token, '/api/headroom/capsules'),
      headroomRequest<{ scopes: TemporaryScope[] }>(token, `/api/local-selection/scopes?sessionId=${encodeURIComponent(sessionId)}`),
    ]);
    setEnvelopes(envelopePayload.envelopes);
    setCapsules(capsulePayload.capsules);
    setScopes(scopePayload.scopes);
  }, [sessionId, token]);

  useEffect(() => {
    load().catch((error: Error) => setNotice({ severity: 'error', text: error.message }));
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
    >
      {notice && (
        <Alert
          severity={notice.severity}
          sx={{ mt: 1.5 }}
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
