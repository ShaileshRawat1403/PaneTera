import React from 'react';
import { Box } from '@mui/material';
import { ResizeHandle } from './ResizeHandle';

interface WorkbenchShellProps {
  leftRailWidth: number;
  rightFeedWidth: number;
  isLeftRailCollapsed: boolean;
  isRightFeedCollapsed: boolean;
  onLeftResize: (deltaX: number) => void;
  onRightResize: (deltaX: number) => void;
  leftRailContent: React.ReactNode;
  rightFeedContent: React.ReactNode;
  children: React.ReactNode;
}

export const WorkbenchShell: React.FC<WorkbenchShellProps> = ({
  leftRailWidth,
  rightFeedWidth,
  isLeftRailCollapsed,
  isRightFeedCollapsed,
  onLeftResize,
  onRightResize,
  leftRailContent,
  rightFeedContent,
  children
}) => {
  const leftWidth = isLeftRailCollapsed ? 64 : Math.max(240, isNaN(leftRailWidth) ? 280 : leftRailWidth);
  const rightWidth = isRightFeedCollapsed ? 48 : Math.max(320, isNaN(rightFeedWidth) ? 380 : rightFeedWidth);

  return (
    <Box
      sx={{
        display: 'flex',
        flexGrow: 1,
        height: '100%',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden'
      }}
    >
      {/* ZONE 1: Left Context Rail */}
      <Box
        sx={{
          width: leftWidth,
          minWidth: leftWidth,
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(9, 9, 11, 0.4)',
          position: 'relative',
          transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          p: isLeftRailCollapsed ? 1.5 : 3,
          boxSizing: 'border-box'
        }}
      >
        {leftRailContent}

        {/* Resize handle on right border of left rail */}
        {!isLeftRailCollapsed && (
          <ResizeHandle onResize={onLeftResize} direction="left" />
        )}
      </Box>

      {/* ZONE 2: Middle Main Workbench Inspector */}
      <Box
        sx={{
          flex: 1,
          minWidth: '520px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#08090b'
        }}
      >
        {children}
      </Box>

      {/* ZONE 3: Right Intelligence Feed */}
      <Box
        sx={{
          width: rightWidth,
          minWidth: rightWidth,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'rgba(9, 9, 11, 0.15)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative',
          transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}
      >
        {/* Resize handle on left border of right feed */}
        {!isRightFeedCollapsed && (
          <ResizeHandle onResize={onRightResize} direction="right" />
        )}

        {rightFeedContent}
      </Box>
    </Box>
  );
};
