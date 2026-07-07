import React from 'react';
import { Box } from '@mui/material';

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  direction: 'left' | 'right';
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, direction }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    let previousX = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const movementX = moveEvent.clientX - previousX;
      previousX = moveEvent.clientX;
      const deltaX = direction === 'left' 
        ? movementX 
        : -movementX;
      onResize(deltaX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        width: '6px',
        cursor: 'col-resize',
        position: 'absolute',
        top: 0,
        bottom: 0,
        [direction === 'left' ? 'right' : 'left']: '-3px',
        zIndex: 100,
        background: 'transparent',
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: 'rgba(127, 85, 240, 0.4)',
        },
        '&:active': {
          backgroundColor: '#7f5af0',
        }
      }}
    />
  );
};
