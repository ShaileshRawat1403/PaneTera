import React, { useState, useEffect } from 'react';
import { Box, Typography, InputBase, List, ListItemButton, ListItemText, Modal } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BuildIcon from '@mui/icons-material/Build';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';
import { surface, ink, accent, radius, elevation, typography } from '../../theme/cssTokens';

export interface QuickSwitcherItem {
  id: string;
  label: string;
  category: 'Workbench Card' | 'Project' | 'Drawer';
  shortcut?: string;
  action: () => void;
}

interface QuickSwitcherModalProps {
  open: boolean;
  onClose: () => void;
  items?: QuickSwitcherItem[];
}

const DEFAULT_ITEMS: QuickSwitcherItem[] = [
  { id: 'soothsayer', label: 'Soothsayer Live App Workbench', category: 'Workbench Card', action: () => {} },
  { id: 'mcp-rig', label: 'MCP Capabilities & Rig Governance', category: 'Drawer', action: () => {} },
  { id: 'evidence', label: 'Browser Evidence & Observations', category: 'Workbench Card', action: () => {} },
  { id: 'starter-form', label: 'Starter Post Form', category: 'Workbench Card', action: () => {} },
];

export function QuickSwitcherModal({ open, onClose, items = DEFAULT_ITEMS }: QuickSwitcherModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim()));

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      filteredItems[selectedIndex].action();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      keepMounted
      disablePortal={process.env.NODE_ENV === 'test'}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: '12vh',
        backdropFilter: 'blur(4px)',
        zIndex: 1300,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.md}px`,
          boxShadow: elevation.overlay,
          outline: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Search Bar Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: `1px solid ${surface.border}`,
            backgroundColor: surface.sunken,
          }}
        >
          <SearchIcon sx={{ color: ink.muted, fontSize: 20 }} />
          <InputBase
            autoFocus
            placeholder="Type a command or search workbench cards... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              flex: 1,
              color: ink.primary,
              fontSize: '14px',
              fontFamily: typography.sans,
            }}
          />
        </Box>

        {/* Item List */}
        <List sx={{ p: 1, maxHeight: '350px', overflowY: 'auto' }}>
          {filteredItems.length === 0 ? (
            <Typography variant="body2" sx={{ p: 2, color: ink.muted, textAlign: 'center' }}>
              No matching commands or workbench cards found.
            </Typography>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <ListItemButton
                  key={item.id}
                  selected={isSelected}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  sx={{
                    borderRadius: `${radius.sm}px`,
                    mb: 0.5,
                    backgroundColor: isSelected ? surface.sunken : 'transparent',
                    borderLeft: isSelected ? `3px solid ${accent.violet}` : '3px solid transparent',
                    '&:hover': {
                      backgroundColor: surface.sunken,
                    },
                  }}
                >
                  <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: isSelected ? accent.violet : ink.muted }}>
                    {item.category === 'Workbench Card' && <DashboardIcon sx={{ fontSize: 18 }} />}
                    {item.category === 'Drawer' && <BuildIcon sx={{ fontSize: 18 }} />}
                    {item.category === 'Project' && <DescriptionIcon sx={{ fontSize: 18 }} />}
                  </Box>
                  <ListItemText
                    primary={item.label}
                    secondary={item.category}
                    primaryTypographyProps={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: ink.primary }}
                    secondaryTypographyProps={{ fontSize: '11px', color: ink.muted }}
                  />
                </ListItemButton>
              );
            })
          )}
        </List>
      </Box>
    </Modal>
  );
}
