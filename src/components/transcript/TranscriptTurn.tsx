// src/components/transcript/TranscriptTurn.tsx
// One turn in the conversation transcript, with its supporting disclosures.
//
// Extracted from App.tsx in the Phase 3 pass. The previous migration edited
// `ChatMessage.tsx`, which App imported but never rendered: the production
// transcript was an inline block carrying inspected files, tools used,
// citations, warnings, and suggested actions that `ChatMessage` did not have.
// Pointing App at that component would have lost those, so the real markup
// moved here instead and `ChatMessage` was deleted.
//
// Beyond tokens, three changes:
//
//   1. Tool status uses the status tokens, so a denied tool and a policy
//      warning read as the same kind of event everywhere in the product.
//   2. Emoji glyphs are gone from the labels. They were doing the work of a
//      colour and a word, and screen readers announce them.
//   3. Turns are list items, so a transcript can be walked as a list rather
//      than inferred from alignment.

import React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

/**
 * What the transcript renders.
 *
 * Deliberately without `uiComponent`. PaneTera's canvas is the authoritative
 * surface, so interactive cards belong there and not inside the conversation.
 * The field used to exist on this type while nothing rendered it, which is
 * silent dead data: a proposal card could be attached to a message and simply
 * never appear. Omitting it makes that a type error instead.
 */
export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  toolsUsed?: { tool: string; status: 'success' | 'denied' | 'failed'; reason?: string }[];
  filesInspected?: { path: string; purpose: string }[];
  citations?: { path: string; label: string }[];
  suggestedActions?: { label: string; message: string }[];
  warnings?: string[];
}

interface Props {
  message: TranscriptMessage;
  onSelectFile: (path: string) => void;
  onSuggestedAction: (message: string) => void;
}

/** Tool outcomes share the product's status vocabulary. */
export function toolColour(state: 'success' | 'denied' | 'failed'): string {
  if (state === 'success') return status.success;
  if (state === 'denied') return status.danger;
  return status.brass;
}

const disclosureSummary: React.CSSProperties = {
  fontSize: 11,
  color: ink.secondary,
  fontWeight: 600,
  userSelect: 'none',
  cursor: 'pointer',
};

const monoDetail = {
  color: ink.secondary,
  display: 'block',
  fontFamily: typography.mono,
  fontSize: 10,
} as const;

export const TranscriptTurn: React.FC<Props> = ({ message, onSelectFile, onSuggestedAction }) => {
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
      }}
    >
      <Paper
        sx={{
          p: 2,
          backgroundColor: isUser ? accent.violetMuted : surface.raised,
          border: `1px solid ${isUser ? accent.violetBorder : surface.border}`,
          // The squared corner points at the speaker.
          borderRadius: isUser
            ? `${radius.md}px ${radius.md}px 2px ${radius.md}px`
            : `${radius.md}px ${radius.md}px ${radius.md}px 2px`,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: isUser ? accent.violet : ink.secondary,
            fontWeight: 600,
            letterSpacing: '0.04em',
            display: 'block',
            mb: 0.5,
          }}
        >
          {isUser ? 'You' : 'PaneTera'}
        </Typography>

        <Typography
          variant="body2"
          sx={{ color: ink.primary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
        >
          {message.content}
        </Typography>

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
              sx={{ color: ink.secondary, fontWeight: 600, display: 'block', mb: 0.75 }}
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
                    height: 20,
                    fontSize: 10,
                    backgroundColor: 'transparent',
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
                sx={{ color: status.danger, display: 'block', fontSize: 11 }}
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
                height: 22,
                fontSize: 11,
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
