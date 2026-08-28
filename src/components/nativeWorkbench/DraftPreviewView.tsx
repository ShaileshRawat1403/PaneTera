import React from 'react';
import { Box, Typography, Paper, Divider, Stack, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { accent, ink, status } from '../../theme/cssTokens';

interface DraftPreviewProps {
  data: {
    title?: string;
    subtitle?: string;
    sections?: Array<{ title: string; body: string }>;
    takeaways?: string[];
  };
}

export const DraftPreviewView: React.FC<DraftPreviewProps> = ({ data }) => {
  const { title = 'Untitled Draft', subtitle = '', sections = [], takeaways = [] } = data;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        background: 'rgba(255, 255, 255, 0.01)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ color: ink.primary, fontWeight: 800 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: ink.muted, fontStyle: 'italic', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <Stack spacing={2.5}>
        {sections.map((sec, idx) => (
          <Box key={idx}>
            <Typography variant="subtitle2" sx={{ color: accent.violet, fontWeight: 700, mb: 0.5 }}>
              {sec.title}
            </Typography>
            <Typography variant="body2" sx={{ color: ink.secondary, lineHeight: 1.6 }}>
              {sec.body}
            </Typography>
          </Box>
        ))}
      </Stack>

      {takeaways.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            KEY TAKEAWAYS
          </Typography>
          <List dense sx={{ p: 0 }}>
            {takeaways.map((take, idx) => (
              <ListItem key={idx} sx={{ p: 0, py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 20, color: status.success }}>
                  <CheckCircleIcon sx={{ fontSize: 12 }} />
                </ListItemIcon>
                <ListItemText
                  primary={take}
                  primaryTypographyProps={{ sx: { fontSize: '0.78rem', color: ink.secondary } }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  );
};
