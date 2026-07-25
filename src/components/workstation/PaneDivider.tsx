import * as React from 'react';
import { Box } from '@mui/material';
import { accent, ink, surface } from '../../theme/cssTokens';
import { transition, duration } from '../../theme/motion';

interface PaneDividerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onReset: () => void;
}

export function PaneDivider({ label, value, min, max, onChange, onReset }: PaneDividerProps) {
  const drag = React.useRef<{ startX: number; startWidth: number } | null>(null);

  React.useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      onChange(drag.current.startWidth + event.clientX - drag.current.startX);
    };
    const stop = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [onChange]);

  return (
    <Box
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      title="Drag to resize. Double-click to reset."
      onPointerDown={(event) => {
        event.preventDefault();
        drag.current = { startX: event.clientX, startWidth: value };
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); onChange(value - (event.shiftKey ? 32 : 8)); }
        if (event.key === 'ArrowRight') { event.preventDefault(); onChange(value + (event.shiftKey ? 32 : 8)); }
        if (event.key === 'Home') { event.preventDefault(); onChange(min); }
        if (event.key === 'End') { event.preventDefault(); onChange(max); }
      }}
      sx={{
        width: 7,
        cursor: 'col-resize',
        backgroundColor: surface.border,
        position: 'relative',
        touchAction: 'none',
        transition: transition(['background-color'], duration.quick),
        // Expanded invisible hit zone for easier pointer targeting.
        '&::after': { content: '""', position: 'absolute', inset: '0 -4px' },
        // Centered grip indicator using pure box-shadow dots
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 3,
          height: 3,
          borderRadius: '50%',
          backgroundColor: ink.muted,
          boxShadow: `0 -6px 0 ${ink.muted}, 0 6px 0 ${ink.muted}`,
          opacity: 0.6,
          transition: transition(['opacity', 'background-color'], duration.quick),
        },
        '&:hover, &:focus-visible': {
          backgroundColor: accent.violet,
          outline: 'none',
          '&::before': {
            opacity: 1,
            backgroundColor: ink.onAccent,
            boxShadow: `0 -6px 0 ${ink.onAccent}, 0 6px 0 ${ink.onAccent}`,
          },
        },
      }}
    />
  );
}
