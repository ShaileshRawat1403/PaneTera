// src/components/workstation/ContextBriefPanel.tsx
//
// Renders the Context Brief: a read model answering the four workstation
// contract questions. Appears in the canvas when a project is active but
// no specific content card is displayed.
//
// A healthy project produces a minimal brief. Selectivity is enforced by
// the derivation, not the renderer.

import React from 'react';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { accent, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { enterStyles, transition, duration, easing } from '../../theme/motion';
import type { ContextBrief, AttentionItem, NextAction, SuggestedWorkflow } from '../../context/contextBrief';

interface ContextBriefPanelProps {
  brief: ContextBrief;
  onAction?: (action: NextAction) => void;
}

const REASON_LABELS: Record<string, string> = {
  'approval-pending': 'Approval needed',
  'security-boundary': 'Security',
  failure: 'Failed',
  ambiguity: 'Unclear',
  'missing-capability': 'Missing tool',
  'stale-context': 'Stale',
  'weak-evidence': 'Weak evidence',
};

const REASON_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  'approval-pending': { bg: status.brassMuted, fg: status.brass, border: status.brass },
  'security-boundary': { bg: status.dangerMuted, fg: status.danger, border: status.danger },
  failure: { bg: status.dangerMuted, fg: status.danger, border: status.danger },
  ambiguity: { bg: surface.sunken, fg: ink.secondary, border: surface.border },
  'missing-capability': { bg: accent.violetMuted, fg: accent.violet, border: accent.violetBorder },
  'stale-context': { bg: surface.sunken, fg: ink.muted, border: surface.border },
  'weak-evidence': { bg: surface.sunken, fg: ink.secondary, border: surface.border },
};

function AttentionChip({ item }: { item: AttentionItem }) {
  const colors = REASON_COLORS[item.reason] || REASON_COLORS.ambiguity;
  return (
    <Chip
      size="small"
      label={
        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PriorityHighIcon sx={{ fontSize: 12 }} />
          {REASON_LABELS[item.reason] || item.reason}
        </Box>
      }
      sx={{
        height: 22,
        fontSize: '0.6875rem',
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

function NextActionCard({ action, onAction }: { action: NextAction; onAction?: (action: NextAction) => void }) {
  return (
    <Button
      onClick={() => onAction?.(action)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        borderRadius: `${radius.md}px`,
        border: `1px solid ${accent.violetBorder}`,
        backgroundColor: accent.violetMuted,
        textTransform: 'none',
        textAlign: 'left',
        justifyContent: 'flex-start',
        transition: transition(['background-color', 'border-color', 'box-shadow', 'transform']),
        '&:hover': {
          backgroundColor: accent.violetHover,
          boxShadow: elevation.cardHover,
          transform: 'translateY(-1px)',
        },
        '&:active': { transform: 'scale(0.98)' },
        '&:focus-visible': { outline: 'none', boxShadow: elevation.focusRing, borderColor: accent.violetBorder },
      }}
    >
      <PlayArrowIcon sx={{ fontSize: 16, color: accent.violet, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: ink.primary, fontWeight: 600, fontSize: '0.8125rem', flex: 1 }}>
        {action.label}
      </Typography>
      <ArrowForwardIcon sx={{ fontSize: 14, color: accent.violet, opacity: 0.6 }} />
    </Button>
  );
}

function SuggestedWorkflowCard({
  suggestion,
  onAction,
}: {
  suggestion: SuggestedWorkflow;
  onAction?: (action: NextAction) => void;
}) {
  const isHighConfidence = suggestion.confidence >= 4;
  const borderColor = isHighConfidence ? status.brass : accent.violetBorder;
  const bgColor = isHighConfidence ? status.brassMuted : accent.violetMuted;
  const hoverBg = isHighConfidence ? status.brassMuted : accent.violetHover;
  const iconColor = isHighConfidence ? status.brass : accent.violet;
  return (
    <Button
      onClick={() => onAction?.(suggestion.action)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.5,
        p: 1.5,
        borderRadius: `${radius.md}px`,
        border: `1px solid ${borderColor}`,
        backgroundColor: bgColor,
        textTransform: 'none',
        textAlign: 'left',
        width: '100%',
        transition: transition(['background-color', 'border-color', 'box-shadow', 'transform']),
        '&:hover': {
          backgroundColor: hoverBg,
          boxShadow: elevation.cardHover,
          transform: 'translateY(-1px)',
        },
        '&:active': { transform: 'scale(0.98)' },
        '&:focus-visible': { outline: 'none', boxShadow: elevation.focusRing, borderColor },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <AutoAwesomeIcon sx={{ fontSize: 14, color: iconColor, flexShrink: 0 }} />
        <Typography sx={{ color: ink.primary, fontWeight: 600, fontSize: '0.8125rem', flex: 1 }}>
          {suggestion.label}
        </Typography>
        {suggestion.source && (
          <Tooltip title={suggestion.source}>
            <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.625rem', flexShrink: 0 }}>
              {suggestion.source}
            </Typography>
          </Tooltip>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: ink.secondary, fontSize: '0.75rem', lineHeight: 1.4, ml: 3 }}>
        {suggestion.description}
      </Typography>
    </Button>
  );
}

export function ContextBriefPanel({ brief, onAction }: ContextBriefPanelProps): React.ReactElement {
  const hasWorking = brief.working !== null;
  const hasNow = brief.now.activeRunCount > 0;
  const hasAttention = brief.attention.total > 0;
  const hasNext = brief.next !== null;
  const hasSuggestions = brief.suggestions.items.length > 0;

  const isMinimal = !hasWorking && !hasNow && !hasAttention && !hasNext && !hasSuggestions;

  if (isMinimal) {
    return (
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: surface.canvas,
          pt: { xs: 4, md: 6 },
          pb: { xs: 6, md: 14 },
          px: { xs: 3, md: 6 },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 520,
            textAlign: 'center',
            ...enterStyles(),
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: ink.muted, fontWeight: 650, fontSize: '0.75rem', letterSpacing: '0.09em' }}
          >
            All clear
          </Typography>
          <Typography
            sx={{
              color: ink.primary,
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              lineHeight: 1.3,
              fontWeight: 650,
              mt: 1,
            }}
          >
            Nothing needs your attention
          </Typography>
          <Typography variant="body2" sx={{ color: ink.secondary, mt: 1, fontSize: '0.875rem' }}>
            {brief.quietProjectCount > 0
              ? `${brief.quietProjectCount} project${brief.quietProjectCount > 1 ? 's' : ''} running quietly.`
              : 'Choose a project or describe a goal to get started.'}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flexGrow: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        backgroundColor: surface.canvas,
        pt: { xs: 3, md: 5 },
        pb: { xs: 4, md: 8 },
        px: { xs: 3, md: 6 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          ...enterStyles(),
        }}
      >
        {/* Q1: What am I working on? */}
        {hasWorking && (
          <Box sx={{ ...enterStyles(), animationDelay: '0ms' }}>
            <SectionLabel icon={<BoltIcon />} question="What am I working on?" />
            <Typography
              variant="body1"
              sx={{ color: ink.primary, fontWeight: 600, fontSize: '1rem', mt: 0.5 }}
            >
              {brief.working!.name}
            </Typography>
            {brief.working!.objective && (
              <Typography variant="body2" sx={{ color: ink.secondary, mt: 0.25, fontSize: '0.8125rem' }}>
                {brief.working!.objective}
              </Typography>
            )}
          </Box>
        )}

        {/* Q2: What is happening now? */}
        {hasNow && (
          <Box sx={{ ...enterStyles(), animationDelay: '60ms' }}>
            <SectionLabel icon={<PlayArrowIcon />} question="What is happening now?" />
            <Typography variant="body2" sx={{ color: ink.secondary, mt: 0.5, fontSize: '0.8125rem' }}>
              {brief.now.activeRunCount} active run{brief.now.activeRunCount !== 1 ? 's' : ''}
              {brief.now.projectsWithRuns.total > 0 && (
                <> in {brief.now.projectsWithRuns.items.join(', ')}</>
              )}
            </Typography>
          </Box>
        )}

        {/* Q3: What needs my attention? */}
        {hasAttention && (
          <Box sx={{ ...enterStyles(), animationDelay: '120ms' }}>
            <SectionLabel icon={<PriorityHighIcon />} question="What needs my attention?" />
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
              {brief.attention.items.map((item, idx) => (
                <AttentionChip key={`${item.projectId}-${item.reason}-${idx}`} item={item} />
              ))}
            </Stack>
            {brief.attention.total > brief.attention.items.length && (
              <Typography variant="caption" sx={{ color: ink.muted, mt: 0.5, display: 'block', fontSize: '0.6875rem' }}>
                +{brief.attention.total - brief.attention.items.length} more
              </Typography>
            )}
          </Box>
        )}

        {/* Q4: What should happen next? */}
        {hasNext && (
          <Box sx={{ ...enterStyles(), animationDelay: '180ms' }}>
            <SectionLabel icon={<ArrowForwardIcon />} question="What should happen next?" />
            <Box sx={{ mt: 0.75 }}>
              <NextActionCard action={brief.next!} onAction={onAction} />
            </Box>
          </Box>
        )}

        {/* AI-guided suggestions */}
        {hasSuggestions && (
          <Box sx={{ ...enterStyles(), animationDelay: '240ms' }}>
            <SectionLabel icon={<AutoAwesomeIcon />} question="Suggested actions" />
            <Stack spacing={1} sx={{ mt: 0.75 }}>
              {brief.suggestions.items.map((suggestion, idx) => (
                <SuggestedWorkflowCard key={idx} suggestion={suggestion} onAction={onAction} />
              ))}
            </Stack>
            {brief.suggestions.total > brief.suggestions.items.length && (
              <Typography variant="caption" sx={{ color: ink.muted, mt: 0.5, display: 'block', fontSize: '0.6875rem' }}>
                +{brief.suggestions.total - brief.suggestions.items.length} more
              </Typography>
            )}
          </Box>
        )}

        {/* Quiet footer */}
        {!hasAttention && brief.quietProjectCount > 0 && (
          <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.6875rem', mt: 1 }}>
            {brief.quietProjectCount} project{brief.quietProjectCount !== 1 ? 's' : ''} running quietly.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SectionLabel({ icon, question }: { icon: React.ReactNode; question: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Box sx={{ color: accent.violet, display: 'flex', '& svg': { fontSize: 14 } }}>{icon}</Box>
      <Typography
        variant="overline"
        sx={{ color: ink.muted, fontWeight: 650, fontSize: '0.6875rem', letterSpacing: '0.06em' }}
      >
        {question}
      </Typography>
    </Stack>
  );
}
