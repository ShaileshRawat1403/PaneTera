import React, { useCallback, useRef } from 'react';
import { Box } from '@mui/material';

interface WorkbenchLayoutProps {
  leftPanelWidth: number;
  onWidthChange: (width: number) => void;
  renderLeft: React.ReactNode;
  renderRight: React.ReactNode;
}

export const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({ 
  leftPanelWidth, 
  onWidthChange, 
  renderLeft, 
  renderRight 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(300, Math.min(moveEvent.clientX - rect.left, rect.width - 300));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      
      // Fire settled layout change audit event
      fetch('/api/workbench/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'workbench.layout.change',
          operation: 'split-drag',
          resultStatus: 'success'
        })
      }).catch(() => {});
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [onWidthChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newWidth = leftPanelWidth;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newWidth = Math.max(300, leftPanelWidth - 20);
      onWidthChange(newWidth);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      newWidth = leftPanelWidth + 20; // We can't easily bound max without DOM access here, but standard bounds apply on next render
      onWidthChange(newWidth);
    }
    
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      fetch('/api/workbench/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'workbench.layout.change',
          operation: 'split-keyboard',
          resultStatus: 'success'
        })
      }).catch(() => {});
    }
  }, [leftPanelWidth, onWidthChange]);

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        display: 'grid', 
        gridTemplateColumns: `${leftPanelWidth}px 4px 1fr`,
        width: '100vw', 
        height: '100vh',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {renderLeft}
      </Box>
      
      <Box
        role="separator"
        aria-valuenow={leftPanelWidth}
        aria-valuemin={300}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        sx={{
          bgcolor: 'rgba(255,255,255,0.05)',
          cursor: 'col-resize',
          '&:hover': { bgcolor: 'rgba(127, 85, 240, 0.4)' },
          '&:focus': { bgcolor: 'rgba(127, 85, 240, 0.6)', outline: 'none' },
          transition: 'background-color 0.2s',
          zIndex: 10
        }}
      />
      
      <Box sx={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#09090b' }}>
        {renderRight}
      </Box>
    </Box>
  );
};
