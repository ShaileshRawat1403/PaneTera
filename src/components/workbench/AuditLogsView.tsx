// src/components/workbench/AuditLogsView.tsx
//
// The Audit panel, rebuilt on the typed audit model. It renders one row per
// record and answers, at a glance: who acted, what happened, whether policy
// allowed or denied it, whether it succeeded, and which proposal, approval,
// connection, grant, run, or provenance record it belongs to.
//
// All classification is the model's. This file only maps a scrubbed view to
// chips and text. It never inspects an event name, an owner string, or a legacy
// field to decide attribution, and it never reconstructs a redacted value: the
// detail object it shows was already scrubbed on the server.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, Typography, List, ListItem,
  Button, Chip, Stack, Alert, Accordion, AccordionSummary, AccordionDetails,
  Select, MenuItem, FormControl,
} from '@mui/material';
import { accent, ink, status, surface, typography } from '../../theme/tokens';
import SecurityIcon from '@mui/icons-material/Security';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  toAuditRecordView,
  filterAuditRecordViews,
  loadAuditRecords,
  AUDIT_ACTOR_KIND_OPTIONS,
  AUDIT_OUTCOME_OPTIONS,
  AUDIT_POLICY_OPTIONS,
  type AuditRecordView,
  type AuditTone,
  type AuditFilter,
  type RawAuditRecord,
} from './auditRecordViewModel';

interface AuditLogsProps {
  token: string;
  open: boolean;
  onClose: () => void;
}

/** Map a model tone to concrete chip colours, keeping colour decisions in one place. */
export function toneStyle(tone: AuditTone): { bg: string; text: string; border: string } {
  switch (tone) {
    case 'success':
      return { bg: status.successMuted, text: status.success, border: status.success };
    case 'danger':
      return { bg: status.dangerMuted, text: status.danger, border: status.danger };
    case 'attention':
      return { bg: status.brassMuted, text: status.brass, border: status.brass };
    case 'accent':
      return { bg: accent.violetMuted, text: accent.violet, border: accent.violetBorder };
    case 'muted':
      return { bg: 'transparent', text: ink.muted, border: surface.border };
    case 'neutral':
    default:
      return { bg: 'transparent', text: ink.secondary, border: surface.border };
  }
}

function ToneChip({ label, tone, bold = false }: { label: string; tone: AuditTone; bold?: boolean }) {
  const c = toneStyle(tone);
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.58rem',
        fontWeight: bold ? 800 : 600,
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    />
  );
}

/**
 * One audit row. Exported and self-contained so it renders from a view object
 * alone, which is what the render tests exercise. The default row is compact:
 * actor, event, outcome, policy, and correlation chips on a single line, with the
 * scrubbed detail behind progressive disclosure.
 */
export function AuditRecordRow({ view }: { view: AuditRecordView }) {
  const time = view.timestamp ? new Date(view.timestamp).toLocaleTimeString() : '—';
  const hasDetails = Object.keys(view.details).length > 0;

  return (
    <Accordion
      disableGutters
      sx={{
        background: surface.sunken,
        border: `1px solid ${surface.border}`,
        borderRadius: '6px !important',
        color: ink.secondary,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: ink.secondary }} />}
        sx={{ minHeight: 40, py: 0, px: 1.5, '& .MuiAccordionSummary-content': { margin: '8px 0 !important' } }}
      >
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ width: '100%' }}>
          <ToneChip label={view.actor.kindLabel} tone={view.actor.tone} bold />
          {view.actor.identity && (
            <Typography
              variant="caption"
              sx={{ color: view.actor.authoritative ? ink.secondary : ink.muted, fontFamily: typography.mono, fontSize: '0.6rem' }}
            >
              {view.actor.identity}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: ink.primary, fontFamily: typography.mono, fontSize: '0.7rem', fontWeight: 600 }}>
            {view.event}
          </Typography>
          {view.project && (
            <Chip
              label={`Project: ${view.project}`}
              size="small"
              sx={{ height: 16, fontSize: '0.55rem', background: surface.overlay, color: ink.secondary, fontFamily: typography.mono }}
            />
          )}
          <Box sx={{ flexGrow: 1 }} />
          <ToneChip label={`Outcome: ${view.outcome.label}`} tone={view.outcome.tone} />
          <ToneChip label={`Policy: ${view.policy.label}`} tone={view.policy.tone} />
          <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.58rem' }}>
            {time}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1.5, background: surface.sunken, borderTop: `1px solid ${surface.border}` }}>
        {view.correlations.length > 0 && (
          <Box sx={{ mb: hasDetails ? 1.5 : 0 }}>
            <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mb: 0.5 }}>
              Correlations
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {view.correlations.map((c) => (
                <Chip
                  key={`${c.type}:${c.value}`}
                  label={`${c.label}: ${c.value}`}
                  size="small"
                  sx={{
                    height: 16, fontSize: '0.55rem', background: surface.overlay,
                    color: ink.secondary, fontFamily: typography.mono,
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
        {view.isLegacy && (
          <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mb: hasDetails ? 1 : 0, fontStyle: 'italic' }}>
            Unattributed legacy record.
          </Typography>
        )}
        {hasDetails ? (
          <>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
              Detail (already redacted)
            </Typography>
            <pre
              style={{
                margin: 0, padding: '8px', background: surface.sunken, borderRadius: '4px',
                fontFamily: typography.mono, fontSize: '0.66rem', color: ink.secondary,
                overflowX: 'auto', whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(view.details, null, 2)}
            </pre>
          </>
        ) : (
          <Typography variant="caption" sx={{ color: ink.muted }}>No further detail.</Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export function FilterSelect<T extends string>({
  value, onChange, options, allLabel, ariaLabel,
}: {
  value: T | 'all';
  onChange: (v: T | 'all') => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  allLabel: string;
  ariaLabel: string;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as T | 'all')}
        // The control has no visible label, so it carries an explicit accessible
        // name for screen readers and keyboard users.
        aria-label={ariaLabel}
        inputProps={{ 'aria-label': ariaLabel }}
        sx={{
          height: 30, fontSize: '0.68rem', color: ink.secondary, background: surface.sunken,
          '.MuiOutlinedInput-notchedOutline': { borderColor: surface.border },
        }}
      >
        <MenuItem value="all" sx={{ fontSize: '0.68rem' }}>{allLabel}</MenuItem>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.68rem' }}>{o.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export const AuditLogsView: React.FC<AuditLogsProps> = ({ token, open, onClose }) => {
  const [raw, setRaw] = useState<RawAuditRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditFilter>({ actorKind: 'all', outcome: 'all', policyDecision: 'all' });
  // A monotonic request id. Opening, refreshing, and retrying can overlap; only
  // the newest load may publish, so an older response can never overwrite newer
  // rows or drop a stale banner on top of a fresher success.
  const requestGen = useRef(0);

  const fetchLogs = async () => {
    const gen = ++requestGen.current;
    setLoading(true);
    const result = await loadAuditRecords(fetch as never, token);
    if (gen !== requestGen.current) return; // A newer request superseded this one; ignore it.
    if (result.ok) {
      setRaw(result.records);
      setLoaded(true);
      setError(null);
    } else {
      // Keep any previously loaded rows so a failed refresh degrades to a stale
      // banner instead of silently blanking or, worse, looking current.
      setError(result.reason);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  const views = useMemo(() => raw.map((r) => toAuditRecordView(r)), [raw]);
  const visible = useMemo(() => filterAuditRecordViews(views, filter), [views, filter]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="audit-trail-title"
      PaperProps={{ sx: { background: surface.raised, border: `1px solid ${surface.border}`, borderRadius: '12px', maxHeight: '82vh' } }}
    >
      {/* Fixed header — same grammar as the Rig/Headroom DrawerShell: an h6 title
          (the accessible name) with a decorative icon, and right-aligned actions
          ending in an explicitly named Close. Filters and the stale banner live in
          the scrolling body below, so this header stays put. */}
      {/* component="div": MUI's DialogTitle is an <h2> by default, which would wrap
          the h6 title in a second heading (an invalid nested-heading structure). As a
          div it is just the title bar; the only heading is the h6 below. The explicit
          id also stops MUI from copying aria-labelledby onto it, which would otherwise
          make the dialog's accessible name swallow the Refresh/Close button text. */}
      <DialogTitle id="audit-titlebar" component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, px: 2, py: 1.75, borderBottom: `1px solid ${surface.border}` }}>
        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon aria-hidden sx={{ color: accent.violet, fontSize: 20 }} />
          <Typography id="audit-trail-title" variant="h6">Audit trail</Typography>
        </Box>
        <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
          <Button onClick={fetchLogs} disabled={loading} aria-label="Refresh audit trail">
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button onClick={onClose} aria-label="Close Audit">Close</Button>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FilterSelect ariaLabel="Filter by actor kind" allLabel="All actors" value={filter.actorKind ?? 'all'} options={AUDIT_ACTOR_KIND_OPTIONS} onChange={(v) => setFilter((f) => ({ ...f, actorKind: v }))} />
          <FilterSelect ariaLabel="Filter by outcome" allLabel="All outcomes" value={filter.outcome ?? 'all'} options={AUDIT_OUTCOME_OPTIONS} onChange={(v) => setFilter((f) => ({ ...f, outcome: v }))} />
          <FilterSelect ariaLabel="Filter by policy decision" allLabel="All policy decisions" value={filter.policyDecision ?? 'all'} options={AUDIT_POLICY_OPTIONS} onChange={(v) => setFilter((f) => ({ ...f, policyDecision: v }))} />
        </Box>

        {/* Stale: a failed refresh over cached rows is disclosed, never shown as
            current. Same grammar as the Rig drawer (warning Alert + Retry). */}
        {error && raw.length > 0 && (
          <Alert
            severity="warning"
            sx={{ mb: 1.5 }}
            action={(
              <Button color="inherit" size="small" disabled={loading} onClick={fetchLogs}>
                {loading ? 'Retrying…' : 'Retry'}
              </Button>
            )}
          >
            Showing cached records. {error}
          </Alert>
        )}

        {/* The five states are kept distinct: a hard failure is never rendered as an
            empty trail, and a still-loading trail is never rendered as empty. */}
        {!loaded && !error ? (
          <Typography role="status" variant="body2" sx={{ color: ink.secondary }}>Loading the audit trail…</Typography>
        ) : error && raw.length === 0 ? (
          <Alert
            severity="error"
            action={(
              <Button color="inherit" size="small" disabled={loading} onClick={fetchLogs}>
                {loading ? 'Retrying…' : 'Retry'}
              </Button>
            )}
          >
            {error}
          </Alert>
        ) : visible.length === 0 ? (
          <Typography variant="body2" sx={{ color: ink.secondary }}>
            {views.length === 0 ? 'No audit records yet.' : 'No records match these filters.'}
          </Typography>
        ) : (
          <List dense disablePadding>
            {visible.map((view) => (
              <ListItem key={view.recordId} disablePadding sx={{ mb: 1.2, display: 'block' }}>
                <AuditRecordRow view={view} />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};
