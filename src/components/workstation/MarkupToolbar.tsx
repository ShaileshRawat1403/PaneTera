import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, TextField } from '@mui/material';
import { surface, ink, accent, status, radius, elevation } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import { useCanvasSelection } from './CanvasSelectionProvider';

interface MarkupToolbarProps {
  onAnnotate: (text: string, annotation: string) => void;
  onExplain: (text: string) => void;
  onSearch: (text: string) => void;
}

export default function MarkupToolbar({ onAnnotate, onExplain, onSearch }: MarkupToolbarProps) {
  const { selection, clearSelection } = useCanvasSelection();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selection) {
      setPosition({
        x: selection.rect.left + selection.rect.width / 2,
        y: selection.rect.bottom + 8,
      });
    } else {
      setPosition(null);
    }
  }, [selection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        clearSelection();
        setShowAnnotationInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSelection]);

  if (!selection || !position) return null;

  return (
    <Box
      ref={toolbarRef}
      sx={{
        position: 'fixed',
        zIndex: 1300,
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
        animation: 'fadeIn 0.15s ease-out',
        '@keyframes fadeIn': {
          from: { opacity: 0, transform: 'translateX(-50%) translateY(-4px)' },
          to: { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
        },
      }}
    >
      <Box
        sx={{
          backgroundColor: surface.overlay,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.md}px`,
          boxShadow: elevation.overlay,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <Button
          size="small"
          onClick={() => onExplain(selection.text)}
          sx={{
            backgroundColor: accent.violetMuted,
            color: accent.violet,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '12px',
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': {
              backgroundColor: accent.violetHover,
            },
          }}
        >
          Explain
        </Button>
        <Button
          size="small"
          onClick={() => onSearch(selection.text)}
          sx={{
            backgroundColor: 'transparent',
            color: ink.secondary,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '12px',
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': {
              backgroundColor: surface.raisedHover,
            },
          }}
        >
          Search
        </Button>
        <Button
          size="small"
          onClick={() => setShowAnnotationInput(!showAnnotationInput)}
          sx={{
            backgroundColor: 'transparent',
            color: ink.secondary,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '12px',
            minWidth: 'auto',
            px: 1.5,
            py: 0.75,
            borderRadius: `${radius.sm}px`,
            transition: transition(['background-color']),
            '&:hover': {
              backgroundColor: surface.raisedHover,
            },
          }}
        >
          Annotate
        </Button>
      </Box>

      {showAnnotationInput && (
        <Box
          sx={{
            mt: 1,
            backgroundColor: surface.overlay,
            border: `1px solid ${surface.border}`,
            borderRadius: `${radius.md}px`,
            boxShadow: elevation.overlay,
            p: 2,
          }}
        >
          <TextField
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="Add your annotation..."
            multiline
            rows={3}
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: surface.sunken,
                borderRadius: `${radius.sm}px`,
                fontSize: '13px',
                '& fieldset': { borderColor: surface.border },
                '&:hover fieldset': { borderColor: surface.borderStrong },
                '&.Mui-focused fieldset': { borderColor: accent.violet },
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
            <Button
              size="small"
              onClick={() => {
                setShowAnnotationInput(false);
                setAnnotationText('');
              }}
              sx={{
                color: ink.secondary,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              onClick={() => {
                onAnnotate(selection.text, annotationText);
                clearSelection();
                setShowAnnotationInput(false);
                setAnnotationText('');
              }}
              sx={{
                backgroundColor: accent.violet,
                color: ink.onAccent,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12px',
                px: 2,
                py: 0.75,
                borderRadius: `${radius.sm}px`,
                transition: transition(['background-color']),
                '&:hover': {
                  backgroundColor: accent.violetHover,
                },
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
