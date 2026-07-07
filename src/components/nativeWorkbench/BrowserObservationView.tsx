import React from 'react';
import { Box, Typography, Paper, Grid, Chip, List, ListItem, ListItemIcon, ListItemText, Stack, Divider } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LanguageIcon from '@mui/icons-material/Language';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ViewListIcon from '@mui/icons-material/ViewList';

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
  } | null;
}

export const BrowserObservationView: React.FC<BrowserObservationProps> = ({ data }) => {
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
        <Typography variant="body2" sx={{ color: '#71717a' }}>
          No Chrome browser observations recorded yet. Use a trusted agent to send page state.
        </Typography>
      </Paper>
    );
  }

  const { url, title, observedAt, domOutline = [], screenshotDataUrl, selectedText } = data;

  // Group DOM outline by role
  const groupedOutline = domOutline.reduce<Record<string, DomOutlineItem[]>>((acc, item) => {
    const role = item.role || 'text';
    if (!acc[role]) acc[role] = [];
    acc[role].push(item);
    return acc;
  }, {});

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
          <Typography variant="caption" sx={{ color: '#7f5af0', fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: '0.05em' }}>
            TELEMETRY VIEW
          </Typography>
          <Typography variant="h6" sx={{ color: '#f4f4f5', fontWeight: 800 }}>
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
            color: '#3b82f6',
            border: '1px solid rgba(59, 130, 246, 0.15)'
          }}
        />
      </Box>

      {/* URL, Title, observedAt Metadata Section */}
      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0, 0, 0, 0.15)', borderColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px' }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageIcon sx={{ color: '#71717a', fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: '#cbd5e1', wordBreak: 'break-all' }}>
              URL: <strong style={{ color: '#f4f4f5' }}>{url}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewListIcon sx={{ color: '#71717a', fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
              Title: <strong style={{ color: '#f4f4f5' }}>{title}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon sx={{ color: '#71717a', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: '#a0aec0' }}>
              Observed At: {new Date(observedAt).toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Selected text if present */}
      {selectedText && (
        <Box>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            SELECTED TEXT
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px' }}>
            <Typography variant="body2" sx={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
              "{selectedText}"
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Two column view: DOM Outline and Screenshot */}
      <Grid container spacing={3}>
        {/* DOM Outline */}
        <Grid item xs={12} md={screenshotDataUrl ? 7 : 12}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
            SAFE DOM OUTLINE ({domOutline.length} items)
          </Typography>
          <Stack spacing={2} sx={{ maxHeight: 350, overflowY: 'auto', pr: 1 }}>
            {Object.keys(groupedOutline).map(role => (
              <Box key={role}>
                <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                  {role}s
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, background: 'rgba(0,0,0,0.1)', borderColor: 'rgba(255,255,255,0.03)' }}>
                  <List dense sx={{ p: 0 }}>
                    {groupedOutline[role].map((item, idx) => (
                      <ListItem key={idx} sx={{ p: 0, py: 0.25 }}>
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{ sx: { fontSize: '0.78rem', color: '#cbd5e1' } }}
                          secondary={item.level ? `Heading Level ${item.level}` : undefined}
                          secondaryTypographyProps={{ sx: { fontSize: '0.65rem', color: '#71717a' } }}
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
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
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
        <InfoIcon sx={{ color: '#3b82f6', fontSize: 16, mt: 0.2 }} />
        <Typography variant="caption" sx={{ color: '#a0aec0', lineHeight: 1.4 }}>
          <strong>Disclaimer:</strong> This is browser-observed page state, not app-owned API truth. Chrome is eyes, not authority. App-native workbench remains authority. No action execution buttons are available on observed pages.
        </Typography>
      </Box>
    </Paper>
  );
};
