// src/components/workstation/ResizableDrawer.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Drawer, Box, DrawerProps } from '@mui/material';
import { accent, elevation, ink, surface } from '../../theme/cssTokens';

interface ResizableDrawerProps extends Omit<DrawerProps, 'PaperProps'> {
  id: string;
  ariaLabel: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  children: React.ReactNode;
}

export const ResizableDrawer: React.FC<ResizableDrawerProps> = ({
  id,
  ariaLabel,
  open,
  onClose,
  defaultWidth = 520,
  minWidth = 340,
  maxWidth = 840,
  children,
  ...drawerProps
}) => {
  const [width, setWidth] = useState<number>(defaultWidth);
  const isResizingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth]);

  return (
    <Drawer
      id={id}
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      {...drawerProps}
      PaperProps={{
        role: 'region',
        'aria-label': ariaLabel,
        sx: {
          width: `min(${width}px, 94vw)`,
          backgroundColor: surface.raised,
          borderLeft: `1px solid ${surface.border}`,
          boxShadow: elevation.overlay,
          color: ink.primary,
          position: 'relative',
          overflow: 'hidden',
        },
      }}
    >
      {/* Left Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 100,
          transition: 'background-color 150ms ease',
          '&:hover': {
            backgroundColor: accent.violetMuted,
            borderLeft: `2px solid ${accent.violet}`,
          },
          '&:active': {
            backgroundColor: accent.violetHover,
          },
        }}
      />
      {children}
    </Drawer>
  );
};
