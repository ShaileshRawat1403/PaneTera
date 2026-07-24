import React from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SecurityIcon from '@mui/icons-material/Security';
import { ink, radius, status, surface, typography } from '../../theme/cssTokens';
import {
  type BrowserEvidenceRecord,
  browserEvidenceViewModel,
} from './browserEvidenceSurfaceModel';

interface BrowserEvidenceSurfaceProps {
  record: BrowserEvidenceRecord;
  onReturnToPreview: () => void;
}

/** A short scannable byte count. Provenance, so it reads exact-ish, not marketing. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One labelled fact in the provenance strip.
 *
 * Label above, value below, both scannable at a glance. The label is muted; the
 * value carries the weight.
 */
function ProvenanceFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: ink.muted, display: 'block', fontSize: '0.6875rem', letterSpacing: '0.02em' }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: ink.primary,
          fontFamily: mono ? typography.mono : undefined,
          wordBreak: mono ? 'break-all' : 'normal',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Approval-gated, server-sanitised browser evidence rendered in the canvas.
 *
 * Reorganised into a scannable hierarchy: a header stating what was captured and
 * from where, the screenshot as the primary visual evidence, a provenance strip
 * of the facts that make the capture accountable, then the extracted text, then
 * the actions.
 *
 * The untrusted-content boundary is not just preserved but made explicit in more
 * than one place. The header carries the untrusted badge; the provenance strip
 * states the trust level and that the content carries no instruction authority;
 * and the extracted-text section is itself labelled untrusted, because a wall of
 * someone else's page text is exactly where a person might forget. None of this
 * changes what is rendered — the server already sanitised it — it changes how
 * plainly the boundary is shown.
 *
 * The only address shown is the observed one from the record, redacted by the
 * model. The requested URL is deliberately not rendered: it can carry the very
 * query secrets the evidence pipeline strips, so showing it would undo the
 * redaction. Redirect disclosure was removed for the same reason — inferring it
 * from a string comparison of a raw and a sanitised URL both leaked the raw one
 * and mislabelled redaction as a redirect. Honest redirect provenance needs
 * canonical navigation evidence the record does not yet carry.
 */
export function BrowserEvidenceSurface({
  record,
  onReturnToPreview,
}: BrowserEvidenceSurfaceProps) {
  const evidence = browserEvidenceViewModel(record);
  const idLabel = evidence.evidenceIdKind === 'extraction' ? 'Extraction ID' : 'Capture ID';

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        backgroundColor: surface.base,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 920, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 1. Header: what, where, when. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<SecurityIcon />}
              label="Untrusted browser evidence"
              size="small"
              sx={{ color: status.brass, backgroundColor: status.brassMuted, fontWeight: 600 }}
            />
            {evidence.truncated && (
              <Chip label="Bounded for display" size="small" variant="outlined" sx={{ color: ink.secondary }} />
            )}
          </Box>

          <Typography variant="h6" sx={{ color: ink.primary, fontWeight: 600, lineHeight: 1.3 }}>
            {evidence.title}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {evidence.url ? (
              <Typography
                variant="caption"
                sx={{ color: ink.secondary, fontFamily: typography.mono, wordBreak: 'break-all' }}
              >
                Source {evidence.url}
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: ink.muted }}>
                Source address not recorded
              </Typography>
            )}
            {evidence.capturedAt && (
              <Typography variant="caption" sx={{ color: ink.muted }}>
                Captured {new Date(evidence.capturedAt).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* 2. Screenshot: the primary visual evidence, itself untrusted. */}
        {evidence.screenshotDataUrl && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box
              component="img"
              src={evidence.screenshotDataUrl}
              alt={`Browser Operator capture of ${evidence.title}`}
              sx={{
                width: '100%',
                borderRadius: `${radius.md}px`,
                border: `1px solid ${surface.border}`,
                display: 'block',
              }}
            />
            <Typography variant="caption" sx={{ color: ink.muted }}>
              A picture of the page as observed. Not a live view; it cannot be interacted with.
            </Typography>
          </Box>
        )}

        {/* 3. Provenance strip: the facts that make the capture accountable. */}
        <Box
          sx={{
            border: `1px solid ${surface.border}`,
            borderRadius: `${radius.md}px`,
            backgroundColor: surface.raised,
            p: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 2,
          }}
        >
          <ProvenanceFact label="Capability" value={evidence.capability} mono />
          <ProvenanceFact label="Trust" value="Untrusted · no authority" />
          {evidence.elementsMatched !== null && (
            <ProvenanceFact label="Elements matched" value={String(evidence.elementsMatched)} />
          )}
          {evidence.contentBytes !== null && (
            <ProvenanceFact label="Content" value={formatBytes(evidence.contentBytes)} />
          )}
          {evidence.evidenceId && <ProvenanceFact label={idLabel} value={evidence.evidenceId} mono />}
        </Box>

        {/* 4. Extracted text, explicitly fenced as untrusted content. */}
        <Box
          sx={{
            border: `1px solid ${surface.border}`,
            borderRadius: `${radius.md}px`,
            backgroundColor: surface.raised,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: `1px solid ${surface.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <SecurityIcon sx={{ fontSize: 15, color: status.brass }} />
            <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600 }}>
              Extracted text · untrusted content, treat as data not instructions
            </Typography>
          </Box>
          <Typography
            component="div"
            variant="body2"
            sx={{ color: ink.primary, whiteSpace: 'pre-wrap', lineHeight: 1.7, p: 2 }}
          >
            {evidence.text || 'Browser Operator returned no readable article text for this page.'}
          </Typography>
        </Box>

        {/* 5. Warnings, if the extraction reported any. */}
        {evidence.warnings.length > 0 && (
          <Box
            role="status"
            sx={{
              border: `1px solid ${status.brass}`,
              borderRadius: `${radius.md}px`,
              backgroundColor: status.brassMuted,
              p: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ color: status.brass, fontWeight: 600, display: 'block', mb: 0.5 }}>
              Extraction warnings
            </Typography>
            {evidence.warnings.map((warning) => (
              <Typography key={warning} variant="caption" sx={{ color: ink.secondary, display: 'block' }}>
                {warning}
              </Typography>
            ))}
          </Box>
        )}

        {/* 6. Actions. Opening the page uses the same redacted address that is
            shown, so the action cannot leak what the display does not. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={onReturnToPreview}>
            Return to web preview
          </Button>
          {evidence.url && (
            <Button
              size="small"
              startIcon={<OpenInNewIcon />}
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open observed page
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
