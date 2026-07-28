// src/components/evidence/EvidenceTabs.tsx
import React from 'react';
import { Stack, Chip } from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LanguageIcon from '@mui/icons-material/Language';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { EvidenceSourceItem } from './useEvidencePanel';
import { accent, ink, surface, typography, status } from '../../theme/cssTokens';

interface EvidenceTabsProps {
  sources: EvidenceSourceItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
}

export const EvidenceTabs: React.FC<EvidenceTabsProps> = ({ sources, activeTabId, onSelectTab }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'log':
        return <TerminalIcon sx={{ fontSize: 13 }} />;
      case 'metric':
        return <AssessmentIcon sx={{ fontSize: 13 }} />;
      case 'browser':
        return <LanguageIcon sx={{ fontSize: 13 }} />;
      case 'alert':
        return <WarningAmberIcon sx={{ fontSize: 13 }} />;
      default:
        return undefined;
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
      {sources.map((src) => {
        const isActive = src.id === activeTabId;
        const icon = getIcon(src.type);

        return (
          <Chip
            key={src.id}
            icon={icon}
            label={`${src.name} (${src.count ?? 0})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTab(src.id);
            }}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.7rem',
              fontWeight: isActive ? 650 : 500,
              fontFamily: typography.mono,
              cursor: 'pointer',
              backgroundColor: isActive ? accent.violetMuted : surface.sunken,
              color: isActive ? accent.violet : ink.secondary,
              border: `1px solid ${isActive ? accent.violetBorder : surface.border}`,
              '&:hover': {
                backgroundColor: isActive ? accent.violetMuted : surface.overlay,
                color: ink.primary,
              },
              '& .MuiChip-icon': {
                color: isActive ? accent.violet : ink.secondary,
              },
            }}
          />
        );
      })}
    </Stack>
  );
};
