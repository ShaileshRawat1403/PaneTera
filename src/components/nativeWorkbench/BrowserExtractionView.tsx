import React from 'react';
import { Box, Typography, Paper, Grid, Chip, List, ListItem, ListItemText, Stack, Divider } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LanguageIcon from '@mui/icons-material/Language';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ViewListIcon from '@mui/icons-material/ViewList';
import SecurityIcon from '@mui/icons-material/Security';
import { accent, ink, status } from '../../theme/cssTokens';

interface BrowserExtractionProps {
  data: any;
  variant?: 'feed' | 'main' | 'chat';
}

export const BrowserExtractionView: React.FC<BrowserExtractionProps> = ({ data, variant = 'main' }) => {
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
          No extraction data recorded.
        </Typography>
      </Paper>
    );
  }

  const { extractionId, parentCaptureId, capability, source, trust, evidence, warnings, truncated, data: payloadData } = data;

  if (variant === 'feed' || variant === 'chat') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: ink.secondary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {source?.title || 'Extracted Evidence'}
            </Typography>
            <Typography variant="caption" sx={{ color: ink.disabled, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {source?.url}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
          <Chip label={capability} size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'rgba(127, 85, 240, 0.1)', color: accent.violet }} />
          {evidence?.items && (
            <Chip label={`${evidence.items.length} items`} size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'rgba(255,255,255,0.03)', color: ink.secondary }} />
          )}
          {truncated && <Chip label="Truncated" size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'rgba(245, 158, 11, 0.1)', color: status.brass }} />}
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
            STRUCTURED EVIDENCE
          </Typography>
          <Typography variant="h6" sx={{ color: ink.primary, fontWeight: 800 }}>
            {capability}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {truncated && (
            <Chip
              label="Truncated"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 800,
                background: 'rgba(245, 158, 11, 0.08)',
                color: status.brass,
                border: '1px solid rgba(245, 158, 11, 0.15)'
              }}
            />
          )}
          <Chip
            label="Extracted"
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
        </Stack>
      </Box>

      {/* Metadata Section */}
      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0, 0, 0, 0.15)', borderColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px' }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: ink.secondary, wordBreak: 'break-all' }}>
              URL: <strong style={{ color: ink.primary }}>{source?.url}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewListIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: ink.secondary }}>
              Title: <strong style={{ color: ink.primary }}>{source?.title}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: ink.muted }}>
              Captured At: {new Date(source?.capturedAt || new Date()).toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ color: ink.disabled, fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: ink.muted }}>
              Trust: Origin {trust?.origin}, {trust?.isTopFrame ? 'Top Frame' : 'Iframe'}, CSP: {trust?.hasCsp ? 'Yes' : 'No'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Extracted Data Visualization based on capability */}
      <Box>
        <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
          EXTRACTION PAYLOAD
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255, 255, 255, 0.01)', borderColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', maxHeight: 350, overflowY: 'auto' }}>
          {capability === 'browser.article.extract' && (
            <Box>
               <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 'bold', mb: 1 }}>{payloadData?.title}</Typography>
               <Typography variant="body2" sx={{ color: ink.secondary, whiteSpace: 'pre-wrap', fontFamily: 'serif' }}>{payloadData?.textContent}</Typography>
            </Box>
          )}
          {capability === 'browser.outline.extract' && Array.isArray(payloadData) && (
            <List dense>
              {payloadData.map((item: any, idx: number) => (
                 <ListItem key={idx} sx={{ py: 0.5, pl: (item.level || 1) * 2 }}>
                    <ListItemText primary={item.text} primaryTypographyProps={{ sx: { color: ink.secondary, fontSize: '0.85rem' } }} />
                 </ListItem>
              ))}
            </List>
          )}
          {capability === 'browser.links.extract' && Array.isArray(payloadData) && (
             <List dense>
              {payloadData.map((link: any, idx: number) => (
                 <ListItem key={idx} sx={{ py: 0.5 }}>
                    <ListItemText 
                       primary={link.text || link.href} 
                       secondary={link.text ? link.href : null}
                       primaryTypographyProps={{ sx: { color: ink.secondary, fontSize: '0.85rem' } }} 
                       secondaryTypographyProps={{ sx: { color: ink.disabled, fontSize: '0.75rem', wordBreak: 'break-all' } }}
                    />
                 </ListItem>
              ))}
            </List>
          )}
          {capability !== 'browser.article.extract' && capability !== 'browser.outline.extract' && capability !== 'browser.links.extract' && (
            <Typography variant="body2" component="pre" sx={{ color: ink.secondary, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {JSON.stringify(payloadData, null, 2)}
            </Typography>
          )}
        </Paper>
      </Box>
      
      {/* Evidence Items Section */}
      {evidence?.items && evidence.items.length > 0 && (
         <Box>
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 800, display: 'block', mb: 1.5, letterSpacing: '0.05em' }}>
            EVIDENCE ITEMS ({evidence.items.length})
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, background: 'rgba(0, 0, 0, 0.1)', borderColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', maxHeight: 200, overflowY: 'auto' }}>
            <List dense disablePadding>
              {evidence.items.slice(0, 50).map((item: any, idx: number) => (
                 <ListItem key={idx} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText 
                       primary={`[${item.kind}] ID: ${item.evidenceId}`} 
                       secondary={JSON.stringify(item.locator)}
                       primaryTypographyProps={{ sx: { color: accent.violet, fontSize: '0.75rem', fontFamily: 'monospace' } }} 
                       secondaryTypographyProps={{ sx: { color: ink.disabled, fontSize: '0.7rem', fontFamily: 'monospace' } }}
                    />
                 </ListItem>
              ))}
              {evidence.items.length > 50 && (
                <Typography variant="caption" sx={{ color: ink.disabled, fontStyle: 'italic', pl: 1 }}>
                  ...and {evidence.items.length - 50} more items.
                </Typography>
              )}
            </List>
          </Paper>
         </Box>
      )}

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
          <strong>Evidence Disclaimer:</strong> This structured data is extracted deterministically from top-frame DOM content only. No scripts were executed during extraction.
        </Typography>
      </Box>
    </Paper>
  );
};
