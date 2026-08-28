import React from 'react';
import { Box, Typography, Paper, Grid, Chip, List, ListItem, ListItemIcon, ListItemText, Stack, Divider } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LanguageIcon from '@mui/icons-material/Language';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ViewListIcon from '@mui/icons-material/ViewList';
import { accent, ink, status } from '../../theme/cssTokens';

interface DomOutlineItem {
  role: 'heading' | 'button' | 'link' | 'input' | 'text' | 'region';
  text: string;
  level?: number;
}

interface BrowserObservationProps {
  data: {
    url: string;
    title: string;
    observedAt: string;
    domOutline: DomOutlineItem[];
    screenshotDataUrl?: string;
    selectedText?: string;
    capturedAt?: string;
  } | null;
  variant?: 'feed' | 'main' | 'chat';
}

export const BrowserObservationView: React.FC<BrowserObservationProps> = ({ data, variant = 'main' }) => {
  if (!data) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          background: 'rgba(255, 255, 255, 0.01)',
          borderColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          textAlign: 'center'
        }}
      >
        <Typography variant="body2" sx={{ color: ink.disabled }}>
          No Chrome browser observations recorded yet. Use a trusted agent to send page state.
        </Typography>
      </Paper>
    );
  }

  const { url, title, observedAt, domOutline = [], screenshotDataUrl, selectedText, capturedAt } = data;

  // Group DOM outline by role
  const groupedOutline: Record<string, DomOutlineItem[]> = {};
  (domOutline || []).forEach((item: any) => {
    const role = item.role || 'text';
    if (!groupedOutline[role]) groupedOutline[role] = [];
    groupedOutline[role].push(item);
  });

  if (variant === 'feed' || variant === 'chat') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          {screenshotDataUrl && (
            <Box
              component="img"
              src={screenshotDataUrl}
              alt="obs thumbnail"
              sx={{
                width: 60,
                height: 45,
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0
              }}
            />
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: ink.secondary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || 'Observed Page'}
            </Typography>
            <Typography variant="caption" sx={{ color: ink.disabled, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {url}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
          <Chip label={`DOM: ${domOutline.length} items`} size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'rgba(255,255,255,0.03)', color: ink.secondary }} />
          {groupedOutline.heading && <Chip label={`Headings: ${groupedOutline.heading.length}`} size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'rgba(127, 85, 240, 0.08)', color: accent.violet }} />}
          {groupedOutline.button && <Chip label={`Buttons: ${groupedOutline.button.length}`} size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'rgba(34, 197, 94, 0.08)', color: status.success }} />}
        </Stack>
      </Box>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        background: 'rgba(20, 20, 25, 0.6)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Header and Badge */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="caption" sx={{ color: accent.violet, fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
            INSPECTION TRACE
          </Typography>
          <Typography variant="h6" sx={{ color: ink.primary, fontWeight: 800 }}>
            Observed in Chrome
          </Typography>
        </Box>
        <Chip
          label="Browser-observed"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.6rem',
            fontWeight: 800,
            background: 'rgba(59, 130, 246, 0.08)',
            color: accent.violet,
            border: '1px solid rgba(59, 130, 246, 0.15)'
          }}
        />
      </Box>

      {/* URL, Title, observedAt Metadata Section */}
      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0, 0, 0, 0.15)', borderColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px' }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: ink.secondary, wordBreak: 'break-all' }}>
              URL: <strong style={{ color: ink.primary }}>{url}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewListIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: ink.secondary }}>
              Title: <strong style={{ color: ink.primary }}>{title}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: ink.muted }}>
              Observed At: {new Date(observedAt || capturedAt || new Date()).toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Selected text if present */}
      {selectedText && (
        <Box>
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            SELECTED TEXT
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: ink.secondary, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
              "{selectedText}"
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Two column view: DOM Outline and Screenshot */}
      <Grid container spacing={3}>
        {/* DOM Outline */}
        <Grid item xs={12} md={screenshotDataUrl ? 7 : 12}>
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
            SAFE DOM OUTLINE ({domOutline.length} items)
          </Typography>
          <Stack spacing={2} sx={{ maxHeight: 350, overflowY: 'auto', pr: 1 }}>
            {Object.keys(groupedOutline).map(role => (
              <Box key={role}>
                <Typography variant="caption" sx={{ color: accent.violet, fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                  {role}s
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, background: 'rgba(0,0,0,0.1)', borderColor: 'rgba(255,255,255,0.03)' }}>
                  <List dense sx={{ p: 0 }}>
                    {groupedOutline[role].map((item: DomOutlineItem, idx: number) => (
                      <ListItem key={idx} sx={{ p: 0, py: 0.25 }}>
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{ sx: { fontSize: '0.78rem', color: ink.secondary } }}
                          secondary={item.level ? `Heading Level ${item.level}` : undefined}
                          secondaryTypographyProps={{ sx: { fontSize: '0.65rem', color: ink.disabled } }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            ))}
          </Stack>
        </Grid>

        {/* Screenshot View */}
        {screenshotDataUrl && (
          <Grid item xs={12} md={5}>
            <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
              VIEWPORT PREVIEW
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 0.5,
                background: 'rgba(0,0,0,0.2)',
                borderColor: 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box
                component="img"
                src={screenshotDataUrl}
                alt="Chrome Viewport Screenshot"
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 335,
                  objectFit: 'contain',
                  borderRadius: '6px'
                }}
              />
            </Paper>
          </Grid>
        )}
      </Grid>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Safety Policy Disclaimer */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
          p: 1.5,
          background: 'rgba(59, 130, 246, 0.04)',
          border: '1px solid rgba(59, 130, 246, 0.12)',
          borderRadius: '8px'
        }}
      >
        <InfoIcon sx={{ color: accent.violet, fontSize: 16, mt: 0.2 }} />
        <Typography variant="caption" sx={{ color: ink.muted, lineHeight: 1.4 }}>
          <strong>Disclaimer:</strong> This is browser-observed page state, not app-owned API truth. Chrome is eyes, not authority. App-native workbench remains authority. No action execution buttons are available on observed pages.
        </Typography>
      </Box>
    </Paper>
  );
};
