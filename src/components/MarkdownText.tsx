import React from 'react';
import { Box, Typography } from '@mui/material';
import { accent, ink, surface, typography } from '../theme/cssTokens';

// Lightweight, dependency-free markdown renderer for assistant replies, used by
// both the chat transcript (left) and the run card (right) so streamed answers
// read as rich text in either event or token mode. Handles headings, bullet and
// numbered lists, blockquotes, rules, and inline bold / code / links. It is
// deliberately small: no raw HTML, no external parser, safe on partial text as
// it streams in.

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) {
      parts.push(<strong key={`b${idx}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <Box key={`c${idx}`} component="code" sx={{ fontFamily: typography.mono, backgroundColor: surface.sunken, px: 0.4, borderRadius: '2px', fontSize: '0.8125rem', color: accent.violet }}>
          {match[3]}
        </Box>,
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <Box key={`l${idx}`} component="a" href={match[5]} target="_blank" rel="noopener noreferrer" sx={{ color: accent.violet, textDecoration: 'underline' }}>
          {match[4]}
        </Box>,
      );
    }
    idx += 1;
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export function MarkdownText({ content }: { content: string }): React.ReactElement {
  const lines = (content || '').split('\n');
  const elements: React.ReactElement[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      elements.push(
        <Typography key={i} sx={{ fontWeight: 700, color: ink.primary, mt: 1, mb: 0.5, fontSize: heading[1].length === 1 ? '1rem' : heading[1].length === 2 ? '0.9375rem' : '0.875rem' }}>
          {renderInline(heading[2])}
        </Typography>,
      );
      return;
    }

    const quote = trimmed.match(/^>\s+(.*)/);
    if (quote) {
      elements.push(
        <Box key={i} sx={{ borderLeft: `2px solid ${accent.violetBorder}`, pl: 1.5, my: 0.5 }}>
          <Typography sx={{ color: ink.secondary, fontStyle: 'italic', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {renderInline(quote[1])}
          </Typography>
        </Box>,
      );
      return;
    }

    const numbered = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numbered) {
      elements.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.75, pl: 1 }}>
          <Typography sx={{ color: accent.violet, fontSize: '0.875rem', lineHeight: 1.6, fontWeight: 600, minWidth: 18 }}>{numbered[1]}.</Typography>
          <Typography sx={{ color: ink.primary, fontSize: '0.875rem', lineHeight: 1.6 }}>{renderInline(numbered[2])}</Typography>
        </Box>,
      );
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)/);
    if (bullet) {
      elements.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.75, pl: 1 }}>
          <Typography sx={{ color: accent.violet, fontSize: '0.875rem', lineHeight: 1.6 }}>•</Typography>
          <Typography sx={{ color: ink.primary, fontSize: '0.875rem', lineHeight: 1.6 }}>{renderInline(bullet[1])}</Typography>
        </Box>,
      );
      return;
    }

    if (/^---+/.test(trimmed)) {
      elements.push(<Box key={i} sx={{ borderTop: `1px solid ${surface.border}`, my: 1 }} />);
      return;
    }

    if (trimmed === '') {
      elements.push(<Box key={i} sx={{ height: 6 }} />);
      return;
    }

    elements.push(
      <Typography key={i} sx={{ color: ink.primary, fontSize: '0.875rem', lineHeight: 1.6, display: 'block' }}>
        {renderInline(trimmed)}
      </Typography>,
    );
  });

  return <Box>{elements}</Box>;
}
