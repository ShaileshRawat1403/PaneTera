// src/components/chat/AgentThinkingIndicator.tsx
//
// Apple-Grade Synaptic Agent Thinking & Reasoning Indicator for PaneTera.
// Displays an active reasoning pulse with concentric synaptic ripple waves,
// animated waveform dots, and elapsed stopwatch timer, adhering to theme tokens
// and reduced motion invariants.

import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { accent, elevation, ink, radius, surface, typography } from '../../theme/cssTokens';
import { prefersReducedMotion } from '../../theme/motion';

interface AgentThinkingIndicatorProps {
  label?: string;
  subtext?: string;
}

const THINKING_PHRASES = [
  'Inspecting application state…',
  'Analyzing AST & domain logic…',
  'Verifying precondition digests…',
  'Synthesizing governed plan…',
];

export const AgentThinkingIndicator: React.FC<AgentThinkingIndicatorProps> = ({
  label,
  subtext,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((prev) => prev + 0.5);
    }, 500);

    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2800);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(phraseTimer);
    };
  }, []);

  const displayPhrase = label || THINKING_PHRASES[phraseIndex];

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        my: 1,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.md}px`,
        boxShadow: elevation.card,
        maxWidth: 420,
      }}
    >
      {/* ── Glowing AI Status Node with Synaptic Ripple ──────────────── */}
      <Box
        sx={{
          position: 'relative',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Core Synaptic Dot */}
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: accent.violet,
            boxShadow: `0 0 8px ${accent.violet}`,
          }}
        />

        {/* Orbit Ring */}
        {!reduced && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `1.5px solid ${accent.violetBorder}`,
              borderTopColor: accent.violet,
              '@keyframes panetera-spin': {
                from: { transform: 'rotate(0deg)' },
                to: { transform: 'rotate(360deg)' },
              },
              animation: 'panetera-spin 1.2s linear infinite',
            }}
          />
        )}

        {/* Apple-style Synaptic Expansion Ripple */}
        {!reduced && (
          <Box
            sx={{
              position: 'absolute',
              inset: -3,
              borderRadius: '50%',
              border: `1px solid ${accent.violet}`,
              opacity: 0,
              '@keyframes panetera-synaptic-ripple': {
                '0%': { transform: 'scale(0.8)', opacity: 0.7 },
                '100%': { transform: 'scale(1.9)', opacity: 0 },
              },
              animation: 'panetera-synaptic-ripple 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
            }}
          />
        )}
      </Box>

      {/* ── Text & Bouncing Waveform Dots ───────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: ink.primary,
              letterSpacing: '-0.01em',
            }}
          >
            {displayPhrase}
          </Typography>

          {/* 3 Fluid Waveform Dots */}
          {!reduced && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 3.5,
                    height: 3.5,
                    borderRadius: '50%',
                    backgroundColor: accent.violet,
                    '@keyframes panetera-dot-bounce': {
                      '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.35 },
                      '40%': { transform: 'scale(1.25)', opacity: 1 },
                    },
                    animation: `panetera-dot-bounce 1.3s infinite ease-in-out ${i * 0.18}s`,
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {subtext && (
          <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.6875rem' }}>
            {subtext}
          </Typography>
        )}
      </Box>

      {/* ── Monospace Stopwatch Timer ───────────────────────────────── */}
      <Typography
        variant="caption"
        sx={{
          fontFamily: typography.mono,
          fontSize: '0.6875rem',
          color: ink.secondary,
          backgroundColor: surface.sunken,
          px: 0.85,
          py: 0.25,
          borderRadius: `${radius.sm}px`,
          border: `1px solid ${surface.border}`,
          flexShrink: 0,
        }}
      >
        {seconds.toFixed(1)}s
      </Typography>
    </Box>
  );
};
