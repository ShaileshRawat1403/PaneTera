import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Chip } from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import { surface, ink, accent, status, radius, typography, elevation } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

interface McpPrompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

interface McpPromptViewerProps {
  prompt: McpPrompt;
  serverName?: string;
  onSubmitToComposer?: (resolvedPrompt: string) => void;
}

export function McpPromptViewer({
  prompt,
  serverName = 'Connected MCP Server',
  onSubmitToComposer,
}: McpPromptViewerProps) {
  const [argValues, setArgValues] = useState<Record<string, string>>({});

  const handleArgChange = (name: string, val: string) => {
    setArgValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleAttach = () => {
    const formattedArgs = Object.entries(argValues)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const resolved = `Prompt: ${prompt.name}\n${prompt.description ? prompt.description + '\n' : ''}${formattedArgs ? 'Arguments: ' + formattedArgs : ''}`;
    if (onSubmitToComposer) {
      onSubmitToComposer(resolved);
    }
  };

  const isFormValid = (prompt.arguments || []).every((arg) => {
    if (arg.required && !argValues[arg.name]?.trim()) return false;
    return true;
  });

  return (
    <Box
      sx={{
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.md}px`,
        boxShadow: elevation.card,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RateReviewIcon sx={{ color: accent.violet, fontSize: 20 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }}>
              {prompt.name}
            </Typography>
            <Typography variant="caption" sx={{ color: ink.muted, fontSize: '11px' }}>
              {serverName}
            </Typography>
          </Box>
        </Box>
        <Chip
          label="MCP Prompt Template"
          size="small"
          sx={{
            height: 20,
            fontSize: '10px',
            backgroundColor: accent.violetMuted,
            color: accent.violet,
            border: `1px solid ${accent.violetBorder}`,
          }}
        />
      </Box>

      {prompt.description && (
        <Typography variant="body2" sx={{ color: ink.secondary, fontSize: '13px', lineHeight: 1.5 }}>
          {prompt.description}
        </Typography>
      )}

      {/* Arguments */}
      {(prompt.arguments || []).length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, fontSize: '11px' }}>
            TEMPLATE ARGUMENTS
          </Typography>
          {(prompt.arguments || []).map((arg) => (
            <Box key={arg.name}>
              <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 0.5, fontSize: '12px' }}>
                {arg.name} {arg.required && <span style={{ color: status.danger }}>*</span>}
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={arg.description || `Value for ${arg.name}`}
                value={argValues[arg.name] || ''}
                onChange={(e) => handleArgChange(arg.name, e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '13px',
                    backgroundColor: surface.sunken,
                    '& fieldset': { borderColor: surface.border },
                    '&:hover fieldset': { borderColor: surface.borderStrong },
                    '&.Mui-focused fieldset': { borderColor: accent.violet },
                  },
                }}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Action */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Button
          size="small"
          disabled={!isFormValid}
          onClick={handleAttach}
          sx={{
            backgroundColor: accent.violet,
            color: ink.onAccent,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '13px',
            px: 2.5,
            py: 0.75,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': { backgroundColor: accent.violetHover },
            '&.Mui-disabled': { backgroundColor: surface.sunken, color: ink.muted },
          }}
        >
          Attach Prompt to Conversation
        </Button>
      </Box>
    </Box>
  );
}
