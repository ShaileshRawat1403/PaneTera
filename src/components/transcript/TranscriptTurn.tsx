// src/components/transcript/TranscriptTurn.tsx
// One turn in the conversation transcript, with its supporting disclosures.
//
// Extracted from App.tsx in the Phase 3 pass. Beyond tokens:
//   1. Tool status uses the status tokens, so a denied tool and a policy
//      warning read as the same kind of event everywhere in the product.
//   2. Turns are list items with entrance motion and minimum font size floor (≥ 12px / 0.75rem).
//   3. Actor attribution chips mark speaker context cleanly.

import React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { accent, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { enterStyles, transition } from '../../theme/motion';
import { MarkdownText } from '../MarkdownText';
import { useAgentRunPolling } from '../../hooks/useAgentRunPolling';

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  model?: string;
  toolsUsed?: { tool: string; status: 'success' | 'denied' | 'failed'; reason?: string }[];
  filesInspected?: { path: string; purpose: string }[];
  citations?: { path: string; label: string }[];
  suggestedActions?: { label: string; message: string }[];
  warnings?: string[];
  // When set, this assistant turn is a live streaming run: its text is pulled
  // from the run (token fragments while active, the final reply when done) so it
  // streams in the left transcript while the right panel shows the run's events.
  streamingRunId?: string;
}

interface Props {
  message: TranscriptMessage;
  onSelectFile: (path: string) => void;
  onSuggestedAction: (message: string) => void;
  token?: string;
}

const ACTIVE_RUN_STATUSES = new Set(['queued', 'planning', 'running', 'waiting-approval', 'verifying']);

// Renders a streaming assistant reply: the run's token deltas accumulate while it
// is active, then the durable final reply replaces them once it completes. Both
// render as rich markdown, identical to a non-streaming reply.
function StreamingReply({ runId, token }: { runId: string; token: string }): React.ReactElement {
  const { data } = useAgentRunPolling(runId, token);
  const run = (data?.run ?? {}) as { status?: string; reply?: string; events?: unknown[] };
  const events: any[] = Array.isArray(data?.events) ? (data!.events as any[]) : (Array.isArray(run.events) ? (run.events as any[]) : []);
  const deltaText = events
    .filter((e) => e?.type === 'model.delta')
    .map((e) => (typeof e?.data?.text === 'string' ? e.data.text : ''))
    .join('');
  const finalReply = typeof run.reply === 'string' ? run.reply : '';
  const text = finalReply || deltaText;
  const streaming = Boolean(run.status && ACTIVE_RUN_STATUSES.has(run.status));
  const terminal = Boolean(run.status && !ACTIVE_RUN_STATUSES.has(run.status));

  if (!text) {
    return (
      <Typography variant="body2" sx={{ color: ink.secondary, fontSize: '0.875rem' }}>
        {run.status === 'failed' ? 'The run failed before producing a reply.' : terminal ? 'The run ended without a reply.' : 'Working on your request…'}
      </Typography>
    );
  }
  return (
    <Box>
      <MarkdownText content={text} />
      {streaming && (
        <Typography component="span" sx={{ color: accent.violet, fontSize: '0.875rem', ml: 0.25 }}>▍</Typography>
      )}
    </Box>
  );
}

/** Tool outcomes share the product's status vocabulary. */
export function toolColour(state: 'success' | 'denied' | 'failed'): string {
  if (state === 'success') return status.success;
  if (state === 'denied') return status.danger;
  return status.brass;
}

const disclosureSummary: React.CSSProperties = {
  fontSize: '0.75rem', // Enforced 12px floor for WCAG AA readability
  color: ink.secondary,
  fontWeight: 600,
  userSelect: 'none',
  cursor: 'pointer',
};

const monoDetail = {
  color: ink.secondary,
  display: 'block',
  fontFamily: typography.mono,
  fontSize: '0.75rem', // Enforced 12px floor
} as const;

export const TranscriptTurn: React.FC<Props> = ({ message, onSelectFile, onSuggestedAction, token }) => {
  const isUser = message.role === 'user';

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        listStyle: 'none',
        mb: 2,
        ...enterStyles(),
      }}
    >
      {/* Actor attribution chip */}
      <Box
        data-testid="actor-chip"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          mb: 0.5,
          borderRadius: `${radius.pill}px`,
          backgroundColor: isUser ? accent.violetMuted : surface.raised,
          border: `1px solid ${isUser ? accent.violetBorder : surface.border}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: isUser ? accent.violet : ink.primary,
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.02em',
          }}
        >
          {isUser ? 'You' : 'PaneTera'}
        </Typography>
        {!isUser && message.model && (
          <Typography
            variant="caption"
            sx={{
              color: ink.muted,
              fontFamily: typography.mono,
              fontSize: '0.625rem',
              ml: 0.5,
              px: 0.5,
              py: 0.1,
              borderRadius: `${radius.sm}px`,
              backgroundColor: surface.canvas,
              border: `1px solid ${surface.border}`,
            }}
          >
            {message.model}
          </Typography>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          backgroundColor: isUser ? accent.violetMuted : surface.raised,
          border: `1px solid ${isUser ? accent.violetBorder : surface.border}`,
          borderRadius: isUser
            ? `${radius.md}px ${radius.md}px 2px ${radius.md}px`
            : `${radius.md}px ${radius.md}px ${radius.md}px 2px`,
          boxShadow: elevation.card,
        }}
      >
        {isUser ? (
          <Typography
            variant="body2"
            sx={{ color: ink.primary, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}
          >
            {message.content}
          </Typography>
        ) : message.streamingRunId && token ? (
          <StreamingReply runId={message.streamingRunId} token={token} />
        ) : (
          <MarkdownText content={message.content} />
        )}

        {message.filesInspected && message.filesInspected.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <details>
              <summary style={disclosureSummary}>
                What I inspected ({message.filesInspected.length} files)
              </summary>
              <Box sx={{ pl: 1.5, mt: 0.5, borderLeft: `1px solid ${surface.border}` }}>
                {message.filesInspected.map((file, index) => (
                  <Typography key={index} variant="caption" sx={monoDetail}>
                    {file.path} ({file.purpose})
                  </Typography>
                ))}
              </Box>
            </details>
          </Box>
        )}

        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <details>
              <summary style={disclosureSummary}>
                Tools used ({message.toolsUsed.length})
              </summary>
              <Box sx={{ pl: 1.5, mt: 0.5, borderLeft: `1px solid ${surface.border}` }}>
                {message.toolsUsed.map((tool, index) => (
                  <Typography
                    key={index}
                    variant="caption"
                    sx={{ ...monoDetail, color: toolColour(tool.status) }}
                  >
                    {tool.tool}: {tool.status}
                    {tool.reason ? ` (${tool.reason})` : ''}
                  </Typography>
                ))}
              </Box>
            </details>
          </Box>
        )}

        {message.citations && message.citations.length > 0 && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px solid ${surface.border}` }}>
            <Typography
              variant="caption"
              sx={{ color: ink.secondary, fontWeight: 600, display: 'block', mb: 0.75, fontSize: '0.75rem' }}
            >
              Citations
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {message.citations.map((citation, index) => (
                <Chip
                  key={index}
                  label={citation.label}
                  onClick={() => onSelectFile(citation.path)}
                  size="small"
                  aria-label={`Open ${citation.path}`}
                  sx={{
                    height: 22,
                    fontSize: '0.75rem',
                    backgroundColor: surface.sunken,
                    border: `1px solid ${surface.border}`,
                    color: ink.secondary,
                    cursor: 'pointer',
                    transition: transition(['background-color', 'border-color', 'color']),
                    '&:hover': {
                      backgroundColor: surface.overlay,
                      borderColor: surface.borderStrong,
                      color: ink.primary,
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {message.warnings && message.warnings.length > 0 && (
          <Box
            role="alert"
            sx={{
              mt: 1.5,
              p: 1,
              backgroundColor: status.dangerMuted,
              border: `1px solid ${status.danger}`,
              borderRadius: `${radius.sm}px`,
            }}
          >
            {message.warnings.map((warning, index) => (
              <Typography
                key={index}
                variant="caption"
                sx={{ color: status.danger, display: 'block', fontSize: '0.75rem' }}
              >
                {warning}
              </Typography>
            ))}
          </Box>
        )}
      </Paper>

      {message.suggestedActions && message.suggestedActions.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1, flexWrap: 'wrap', gap: 0.75, alignSelf: 'flex-start' }}
        >
          {message.suggestedActions.map((action, index) => (
            <Chip
              key={index}
              label={action.label}
              onClick={() => onSuggestedAction(action.message)}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                backgroundColor: accent.violetMuted,
                color: ink.primary,
                border: `1px solid ${accent.violetBorder}`,
                cursor: 'pointer',
                transition: transition(['background-color']),
                '&:hover': { backgroundColor: accent.violetHover },
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default TranscriptTurn;
