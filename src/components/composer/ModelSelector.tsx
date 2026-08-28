import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { accent, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import type { ModelDescriptor } from '../../hooks/useModelSelection';

interface ModelSelectorProps {
  models: ModelDescriptor[];
  activeModel: ModelDescriptor | null;
  onSelect: (model: ModelDescriptor) => void;
  disabled?: boolean;
  /** When true, programmatically opens the dropdown. */
  externalOpenKey?: number;
}

const providerColors: Record<string, string> = {
  /* eslint-disable no-restricted-syntax --
     Provider brand colours, not theme colours. These identify OpenAI,
     Anthropic, Google and Ollama and must stay exact in both themes; routing
     them through a palette token would misrepresent someone else's mark. */
  openai: '#10A37F',
  anthropic: '#D97757',
  google: '#4285F4',
  ollama: '#8B5CF6',
  /* eslint-enable no-restricted-syntax */
};

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  ollama: 'Local',
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  activeModel,
  onSelect,
  disabled = false,
  externalOpenKey = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Respond to external open requests (Cmd+M)
  useEffect(() => {
    if (externalOpenKey > 0) setOpen(true);
  }, [externalOpenKey]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelDescriptor[]>);

  const providerOrder: Array<ModelDescriptor['provider']> = ['openai', 'anthropic', 'google', 'ollama'];

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <Box
        onClick={() => !disabled && setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: `${radius.pill}px`,
          backgroundColor: open ? accent.violetMuted : surface.overlay,
          border: `1px solid ${open ? accent.violetBorder : surface.border}`,
          cursor: disabled ? 'default' : 'pointer',
          transition: transition(['background-color', 'border-color', 'box-shadow']),
          '&:hover': disabled ? {} : {
            backgroundColor: accent.violetMuted,
            borderColor: accent.violetBorder,
            boxShadow: elevation.focusRing,
          },
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: activeModel ? providerColors[activeModel.provider] || status.neutral : status.neutral,
            flexShrink: 0,
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: ink.primary,
            fontWeight: 500,
            fontFamily: typography.mono,
            fontSize: '0.7rem',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {activeModel?.name || 'Select model'}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 14,
            color: ink.muted,
            transition: transition(['transform']),
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Box>

      {open && (
        <Box
          ref={menuRef}
          sx={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            mb: 1,
            minWidth: 320,
            maxHeight: 400,
            overflowY: 'auto',
            backgroundColor: surface.overlay,
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: `1px solid ${surface.border}`,
            borderRadius: `${radius.md}px`,
            boxShadow: elevation.overlay,
            zIndex: 1300,
            py: 0.5,
          }}
        >
          {providerOrder.map((provider) => {
            const providerModels = groupedModels[provider];
            if (!providerModels?.length) return null;

            return (
              <Box key={provider}>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: providerColors[provider],
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: ink.muted,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontSize: '0.65rem',
                    }}
                  >
                    {providerLabels[provider]}
                  </Typography>
                </Box>

                {providerModels.map((model) => {
                  const isActive = model.id === activeModel?.id;
                  const isHovered = hoveredIndex === models.indexOf(model);

                  return (
                    <Box
                      key={model.id}
                      onClick={() => {
                        onSelect(model);
                        setOpen(false);
                      }}
                      onMouseEnter={() => setHoveredIndex(models.indexOf(model))}
                      onMouseLeave={() => setHoveredIndex(-1)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 0.75,
                        mx: 0.5,
                        borderRadius: `${radius.sm}px`,
                        cursor: 'pointer',
                        backgroundColor: isHovered ? accent.violetMuted : 'transparent',
                        transition: transition(['background-color']),
                        '&:active': {
                          backgroundColor: accent.violetSelected,
                        },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: isActive ? accent.violet : ink.primary,
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '0.8125rem',
                          }}
                        >
                          {model.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: ink.muted,
                            display: 'block',
                            fontSize: '0.6875rem',
                          }}
                        >
                          {model.description}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                          size="small"
                          label={model.cost}
                          sx={{
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            backgroundColor: model.cost === 'low' ? status.successMuted : model.cost === 'high' ? status.dangerMuted : status.brassMuted,
                            color: model.cost === 'low' ? status.success : model.cost === 'high' ? status.danger : status.brass,
                            border: `1px solid ${model.cost === 'low' ? status.success : model.cost === 'high' ? status.danger : status.brass}`,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        {isActive && (
                          <CheckIcon sx={{ fontSize: 16, color: accent.violet }} />
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
