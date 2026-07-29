import React from 'react';
import { Box, Typography } from '@mui/material';
import { accent, ink, radius, status, surface, typography } from '../theme/cssTokens';

export interface PreviewRendererProps {
  content: string;
  format: 'markdown' | 'code' | 'text' | 'json' | 'diff-preview';
  label?: string;
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let inList = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const m = line.match(/^(#{1,3})\s+(.*)/);
    if (m) {
      inList = false;
      const variant = m[1].length === 1 ? 'body1' : 'body2';
      elements.push(
        <Typography key={i} variant={variant as 'body1' | 'body2'} sx={{ fontWeight: 650, color: ink.primary, mt: 1, mb: 0.25, fontSize: m[1].length === 1 ? '0.85rem' : '0.8rem' }}>
          {renderInline(m[2])}
        </Typography>,
      );
      return;
    }

    const bq = trimmed.match(/^>\s+(.*)/);
    if (bq) {
      inList = false;
      elements.push(
        <Box key={i} sx={{ borderLeft: `2px solid ${accent.violetBorder}`, pl: 1.5, my: 0.5 }}>
          <Typography variant="caption" sx={{ color: ink.secondary, fontStyle: 'italic', fontSize: '0.75rem' }}>
            {renderInline(bq[1])}
          </Typography>
        </Box>,
      );
      return;
    }

    const li = trimmed.match(/^[-*]\s+(.*)/);
    if (li) {
      if (!inList) { inList = true; }
      elements.push(
        <Box key={i} sx={{ display: 'flex', gap: 0.75, pl: 1.5 }}>
          <Typography sx={{ color: accent.violet, fontSize: '0.7rem', lineHeight: 1.6 }}>•</Typography>
          <Typography variant="caption" sx={{ color: ink.primary, fontSize: '0.75rem', lineHeight: 1.6 }}>
            {renderInline(li[1])}
          </Typography>
        </Box>,
      );
      return;
    }

    const hr = trimmed.match(/^---+/);
    if (hr) {
      inList = false;
      elements.push(<Box key={i} sx={{ borderTop: `1px solid ${surface.border}`, my: 1 }} />);
      return;
    }

    if (trimmed === '') {
      inList = false;
      elements.push(<Box key={i} sx={{ height: 4 }} />);
      return;
    }

    inList = false;
    elements.push(
      <Typography key={i} variant="caption" sx={{ color: ink.primary, fontSize: '0.75rem', lineHeight: 1.6, display: 'block' }}>
        {renderInline(trimmed)}
      </Typography>,
    );
  });

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`b${idx}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <Box key={`c${idx}`} component="code" sx={{ fontFamily: typography.mono, backgroundColor: surface.sunken, px: 0.4, borderRadius: '2px', fontSize: '0.7rem', color: accent.violet }}>
          {match[3]}
        </Box>,
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <Box key={`l${idx}`} component="a" href={match[5]} target="_blank" rel="noopener" sx={{ color: accent.violet, textDecoration: 'underline', '&:hover': { color: accent.violet } }}>
          {match[4]}
        </Box>,
      );
    }
    idx++;
    last = regex.lastIndex;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length ? parts : [text];
}

function JsonPreview({ content }: { content: string }) {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { parsed = content; }
  const formatted = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  const lines = formatted.split('\n');

  return (
    <Box sx={{ fontFamily: typography.mono, fontSize: '0.7rem', lineHeight: 1.5 }}>
      {lines.map((line, i) => {
        const keyMatch = line.match(/^(\s+)"([^"]+)"\s*:/);
        const strMatch = line.match(/"([^"]+)"(,?)$/);
        const numMatch = line.match(/:\s*(-?\d+\.?\d*)(,?)$/);
        const boolMatch = line.match(/:\s*(true|false|null)(,?)$/i);
        return (
          <Box key={i} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {keyMatch ? (
              <>
                <span style={{ color: ink.muted }}>{keyMatch[1]}</span>
                <span style={{ color: status.brass }}>"{keyMatch[2]}"</span>
                <span style={{ color: ink.muted }}>:</span>
                {line.slice(keyMatch[0].length) && (
                  <span style={{ color: ink.secondary }}>{line.slice(keyMatch[0].length)}</span>
                )}
              </>
            ) : strMatch ? (
              <span style={{ color: status.success }}>
                {line.slice(0, line.indexOf(strMatch[1]))}
                <span style={{ color: status.success }}>"{strMatch[1]}"</span>
                {strMatch[2]}
              </span>
            ) : numMatch ? (
              <>
                <span style={{ color: ink.muted }}>{line.slice(0, line.indexOf(':'))}</span>
                <span style={{ color: accent.violet }}>{numMatch[1]}</span>
                <span style={{ color: ink.muted }}>{numMatch[2]}</span>
                {line.slice(line.indexOf(numMatch[0]) + numMatch[0].length)}
              </>
            ) : boolMatch ? (
              <>
                <span style={{ color: ink.muted }}>{line.slice(0, line.indexOf(':'))}</span>
                <span style={{ color: status.danger }}>{boolMatch[1]}</span>
                <span style={{ color: ink.muted }}>{boolMatch[2]}</span>
              </>
            ) : (
              <span style={{ color: ink.muted }}>{line}</span>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function DiffPreview({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <Box sx={{ fontFamily: typography.mono, fontSize: '0.7rem', lineHeight: 1.5 }}>
      {lines.map((line, i) => {
        if (line.startsWith('+')) {
          return (
            <Box key={i} sx={{ backgroundColor: `${status.success}15`, color: status.success, px: 1, py: 0.25, whiteSpace: 'pre-wrap' }}>
              {line}
            </Box>
          );
        }
        if (line.startsWith('-')) {
          return (
            <Box key={i} sx={{ backgroundColor: `${status.danger}15`, color: status.danger, px: 1, py: 0.25, whiteSpace: 'pre-wrap' }}>
              {line}
            </Box>
          );
        }
        if (line.startsWith('@@')) {
          return (
            <Box key={i} sx={{ backgroundColor: `${accent.violet}10`, color: accent.violet, px: 1, py: 0.25, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
              {line}
            </Box>
          );
        }
        return (
          <Box key={i} sx={{ color: ink.muted, px: 1, py: 0.25, whiteSpace: 'pre-wrap' }}>
            {line}
          </Box>
        );
      })}
    </Box>
  );
}

function CodePreview({ content }: { content: string }) {
  return (
    <Box sx={{ fontFamily: typography.mono, fontSize: '0.7rem', lineHeight: 1.5 }}>
      {content.split('\n').map((line, i) => (
        <Box key={i} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: ink.primary, px: 1, py: 0.15 }}>
          {line}
        </Box>
      ))}
    </Box>
  );
}

export function PreviewRenderer({ content, format, label }: PreviewRendererProps) {
  return (
    <Box
      sx={{
        p: 1.5,
        backgroundColor: surface.sunken,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
        maxHeight: 300,
        overflow: 'auto',
      }}
    >
      {label && (
        <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1 }}>
          {label}
        </Typography>
      )}
      {format === 'markdown' && <MarkdownPreview content={content} />}
      {format === 'json' && <JsonPreview content={content} />}
      {format === 'diff-preview' && <DiffPreview content={content} />}
      {format === 'code' && <CodePreview content={content} />}
      {format === 'text' && (
        <Box
          sx={{
            fontFamily: typography.sans,
            fontSize: '0.75rem',
            color: ink.primary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}
        >
          {content}
        </Box>
      )}
    </Box>
  );
}
