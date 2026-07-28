// src/components/evidence/EvidencePanel.tsx
import React from 'react';
import { Box, Paper, Typography, Button, Stack, Chip, Collapse } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TerminalIcon from '@mui/icons-material/Terminal';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LanguageIcon from '@mui/icons-material/Language';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { useEvidencePanel, EvidenceSourceItem } from './useEvidencePanel';
import { EvidenceTabs } from './EvidenceTabs';
import { EvidenceContent } from './EvidenceContent';
import { accent, ink, radius, status, surface, typography } from '../../theme/cssTokens';

interface EvidencePanelProps {
  initialSources?: EvidenceSourceItem[];
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ initialSources }) => {
  const { isExpanded, toggleExpanded, activeTabId, selectTab, sources, summary, drawerHeight, handleResizeStart, browserEvidence, evidenceLoading } =
    useEvidencePanel(initialSources);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'log':
        return <TerminalIcon sx={{ fontSize: 13, color: ink.secondary }} />;
      case 'metric':
        return <AssessmentIcon sx={{ fontSize: 13, color: accent.violet }} />;
      case 'browser':
        return <LanguageIcon sx={{ fontSize: 13, color: ink.secondary }} />;
      case 'alert':
        return <WarningAmberIcon sx={{ fontSize: 13, color: status.brass }} />;
      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        backgroundColor: surface.overlay,
        borderTop: `1px solid ${surface.border}`,
        borderTopLeftRadius: `${radius.md}px`,
        borderTopRightRadius: `${radius.md}px`,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
      }}
    >
      {/* Top Resize Handle Bar */}
      <Box
        onMouseDown={handleResizeStart}
        sx={{
          height: 6,
          width: '100%',
          cursor: 'row-resize',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: surface.raised,
          transition: 'background-color 150ms ease',
          '&:hover': {
            backgroundColor: accent.violetMuted,
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 3,
            borderRadius: 2,
            backgroundColor: surface.borderStrong,
          }}
        />
      </Box>

      {/* Header Bar */}
      <Box
        onClick={toggleExpanded}
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isExpanded ? `1px solid ${surface.border}` : 'none',
          backgroundColor: surface.raised,
          '&:hover': {
            backgroundColor: surface.raisedHover,
          },
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: accent.violet,
                boxShadow: `0 0 8px ${accent.violet}`,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: accent.violet,
                fontSize: '0.7rem',
              }}
            >
              Evidence &amp; Telemetry
            </Typography>
          </Box>

          {!isExpanded && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
              {summary.map((item) => (
                <Chip
                  key={item.id}
                  icon={getSourceIcon(item.type) || undefined}
                  label={`${item.count} ${item.name}`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    fontFamily: typography.mono,
                    backgroundColor: surface.sunken,
                    color: item.type === 'alert' ? status.brass : ink.secondary,
                    border: `1px solid ${item.type === 'alert' ? status.brassMuted : surface.border}`,
                  }}
                />
              ))}
            </Stack>
          )}
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {isExpanded && <EvidenceTabs sources={sources} activeTabId={activeTabId} onSelectTab={selectTab} />}

          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            endIcon={isExpanded ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />}
            sx={{
              fontSize: '0.7rem',
              fontWeight: 600,
              fontFamily: typography.mono,
              color: ink.secondary,
              textTransform: 'none',
              borderRadius: `${radius.sm}px`,
              px: 1.5,
              py: 0.25,
              backgroundColor: surface.sunken,
              border: `1px solid ${surface.border}`,
              '&:hover': {
                backgroundColor: surface.overlay,
                borderColor: surface.borderStrong,
                color: ink.primary,
              },
            }}
          >
            {isExpanded ? 'Collapse' : 'Expand Drawer'}
          </Button>
        </Stack>
      </Box>

      {/* Resizable Expanded Content Drawer */}
      <Collapse in={isExpanded} timeout={200}>
        <Box sx={{ p: 2, height: drawerHeight, overflowY: 'auto', backgroundColor: surface.canvas }}>
          <EvidenceContent activeTabId={activeTabId} browserEvidence={browserEvidence} loading={evidenceLoading} />
        </Box>
      </Collapse>
    </Paper>
  );
};
