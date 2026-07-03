import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Divider, IconButton, Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Grid, Card, CardContent, CardActionArea, Tooltip, LinearProgress, Tabs, Tab, Chip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';
import CodeIcon from '@mui/icons-material/Code';
import DnsIcon from '@mui/icons-material/Dns';
import InfoIcon from '@mui/icons-material/Info';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import ViewStreamIcon from '@mui/icons-material/ViewStream';

export type { FeedItem } from '../../shared/uiComponent';
import type { FeedItem } from '../../shared/uiComponent';

interface PreviewProps {
  previewFeed: FeedItem[];
  onClose: () => void;
  onAction: (query: string) => void;
  onRemoveItem: (id: string) => void;
  onClearFeed: () => void;
  token: string;
}

// 3D MacBook Screen Simulator with beveled aluminum hinge base
const LaptopBrowserFrame: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => {
  return (
    <Box
      sx={{
        width: '100%',
        perspective: '1200px',
        mt: 2,
        mb: 1.5
      }}
    >
      <Box
        sx={{
          background: 'rgba(24, 24, 27, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px 16px 4px 4px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 100px rgba(127, 85, 240, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          transform: 'perspective(1200px) rotateX(1deg) rotateY(-0.5deg)',
          transformStyle: 'preserve-3d',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            transform: 'perspective(1200px) rotateX(3.5deg) rotateY(-1.8deg) translateZ(10px)',
            borderColor: 'rgba(127, 85, 240, 0.35)',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), 0 0 120px rgba(127, 85, 240, 0.08)'
          }
        }}
      >
        {/* macOS Window Controls Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2.5,
            py: 1.25,
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ff5f56', boxShadow: '0 0 4px #ff5f56' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ffbd2e', boxShadow: '0 0 4px #ffbd2e' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#27c93f', boxShadow: '0 0 4px #27c93f' }} />
          </Box>

          {/* URL Address bar */}
          <Box
            sx={{
              flexGrow: 1,
              mx: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              py: 0.5,
              px: 2,
              transition: 'all 0.3s ease'
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                color: '#8e8e93',
                fontSize: '0.7rem',
                letterSpacing: '0.02em',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: 280
              }}
            >
              {url}
            </Typography>
          </Box>
        </Box>

        {/* Viewport Content */}
        <Box sx={{ p: 2.5, background: '#070709', minHeight: 180 }}>
          {children}
        </Box>
      </Box>

      {/* MacBook Bottom hinge and silver aluminum stand simulation */}
      <Box
        sx={{
          height: '6px',
          width: '98%',
          margin: '0 auto',
          background: 'linear-gradient(90deg, #3f3f46 0%, #71717a 50%, #3f3f46 100%)',
          borderRadius: '0 0 16px 16px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(255, 255, 255, 0.1) inset',
          borderTop: '1px solid rgba(0,0,0,0.4)',
          position: 'relative',
          zIndex: 5
        }}
      />
    </Box>
  );
};

// Architecture node connection flow diagram
const WorkspaceArchitectureMap: React.FC<{ onAction: (q: string) => void }> = ({ onAction }) => {
  return (
    <Box sx={{ mb: 2.5, p: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px' }}>
      <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, mb: 2, display: 'block', letterSpacing: '0.05em' }}>
        WORKSPACE INTERCONNECTION DIAGRAM
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', px: 1, py: 1 }}>
        {/* Node: Rook */}
        <Box 
          onClick={() => onAction('List files in rook')}
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            cursor: 'pointer',
            zIndex: 10,
            '&:hover .node-circle': {
              borderColor: '#7f5af0',
              boxShadow: '0 0 16px rgba(127, 85, 240, 0.45)',
              transform: 'scale(1.05)'
            }
          }}
        >
          <Box 
            className="node-circle"
            sx={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              background: '#09090b', 
              border: '2px solid rgba(127, 85, 240, 0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <FolderIcon sx={{ color: '#7f5af0', fontSize: 18 }} />
          </Box>
          <Typography variant="caption" sx={{ mt: 1, fontWeight: 700, color: '#cbd5e1', fontSize: '0.7rem' }}>rook</Typography>
        </Box>

        {/* Connector line 1 */}
        <Box sx={{ height: '2px', flexGrow: 1, background: 'linear-gradient(90deg, #7f5af0 0%, #38bdf8 100%)', opacity: 0.25, mx: 1 }} />

        {/* Node: Flowright */}
        <Box 
          onClick={() => onAction('List files in flowright')}
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            cursor: 'pointer',
            zIndex: 10,
            '&:hover .node-circle': {
              borderColor: '#38bdf8',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)',
              transform: 'scale(1.05)'
            }
          }}
        >
          <Box 
            className="node-circle"
            sx={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              background: '#09090b', 
              border: '2px solid rgba(56, 189, 248, 0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <FolderIcon sx={{ color: '#38bdf8', fontSize: 18 }} />
          </Box>
          <Typography variant="caption" sx={{ mt: 1, fontWeight: 700, color: '#cbd5e1', fontSize: '0.7rem' }}>flowright</Typography>
        </Box>

        {/* Connector line 2 */}
        <Box sx={{ height: '2px', flexGrow: 1, background: 'linear-gradient(90deg, #38bdf8 0%, #22c55e 100%)', opacity: 0.25, mx: 1 }} />

        {/* Node: Dax */}
        <Box 
          onClick={() => onAction('List workspaces')}
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            cursor: 'pointer',
            zIndex: 10,
            '&:hover .node-circle': {
              borderColor: '#22c55e',
              boxShadow: '0 0 16px rgba(34, 197, 94, 0.45)',
              transform: 'scale(1.05)'
            }
          }}
        >
          <Box 
            className="node-circle"
            sx={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              background: '#09090b', 
              border: '2px solid rgba(34, 197, 94, 0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <FolderIcon sx={{ color: '#22c55e', fontSize: 18 }} />
          </Box>
          <Typography variant="caption" sx={{ mt: 1, fontWeight: 700, color: '#cbd5e1', fontSize: '0.7rem' }}>dax</Typography>
        </Box>
      </Box>
    </Box>
  );
};

// Sub-component for individual FileList items with tabs
const FileListFeedCard: React.FC<{ data: any; onAction: (q: string) => void }> = ({ data, onAction }) => {
  const [tabValue, setTabValue] = useState(0);

  const getWorkspaceStats = (name: string) => {
    return {
      stack: [],
      desc: `${name} — registered workspace`,
      nodes: []
    };
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.06)', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)} sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, fontSize: '0.75rem', fontWeight: 600 } }}>
          <Tab label="Files" />
          <Tab label="Architecture" />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <Box
          sx={{
            maxHeight: 320,
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(0,0,0,0.1)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <List dense sx={{ p: 0 }}>
            {data.files.map((file: string, idx: number) => (
              <ListItem key={idx} disablePadding divider={idx < data.files.length - 1} sx={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                <ListItemButton onClick={() => onAction(`Read file ${file} in ${data.workspace}`)} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <InsertDriveFileIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={file}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { fontFamily: 'monospace', color: '#cbd5e1', fontSize: '0.8rem' }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      ) : (
        <Box sx={{ py: 0.5 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <InfoIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#cbd5e1' }}>
                Workspace Telemetry
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.5 }}>
              {getWorkspaceStats(data.workspace).desc}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {getWorkspaceStats(data.workspace).stack.map((tech, tIdx) => (
                <Chip key={tIdx} label={tech} size="small" sx={{ height: 18, fontSize: '0.65rem', background: 'rgba(127, 85, 240, 0.08)', color: '#b794f4' }} />
              ))}
            </Stack>
          </Paper>

          <Typography variant="caption" sx={{ fontWeight: 600, color: '#cbd5e1', display: 'block', mb: 1 }}>
            Dependency Hierarchy
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {getWorkspaceStats(data.workspace).nodes.map((node, nIdx) => (
              <React.Fragment key={nIdx}>
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    width: '100%',
                    background: 'rgba(127, 85, 240, 0.02)',
                    border: '1px solid rgba(127, 85, 240, 0.12)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <DnsIcon sx={{ fontSize: 12, color: '#7f5af0' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
                    {node}
                  </Typography>
                </Paper>
                {nIdx < getWorkspaceStats(data.workspace).nodes.length - 1 && (
                  <Box sx={{ height: 12, width: 1, background: 'rgba(127, 85, 240, 0.3)' }} />
                )}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Sub-component for sequential line-by-line Code Streaming
const CodePreviewFeedCard: React.FC<{ data: any }> = ({ data }) => {
  const [lines, setLines] = useState<string[]>([]);
  const rawLines = data.content.split('\n');

  useEffect(() => {
    setLines([]);
    let index = 0;
    const interval = setInterval(() => {
      if (index < rawLines.length) {
        setLines(prev => [...prev, rawLines[index]]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [data.content]);

  return (
    <Box
      sx={{
        background: '#040405',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.03)',
        p: 2,
        maxHeight: 350,
        overflow: 'auto'
      }}
    >
      <Typography
        component="pre"
        sx={{
          fontFamily: 'Fira Code, monospace',
          fontSize: '0.75rem',
          color: '#cbd5e1',
          margin: 0,
          lineHeight: 1.5,
          whiteSpace: 'pre'
        }}
      >
        {lines.map((line, i) => (
          <Box key={i} sx={{ display: 'flex', animation: 'fadeIn 0.1s ease-in-out' }}>
            <Box sx={{ width: 30, pr: 2, textAlign: 'right', color: 'rgba(255,255,255,0.15)', userSelect: 'none' }}>
              {i + 1}
            </Box>
            <Box sx={{ flexGrow: 1, whiteSpace: 'pre' }}>{line}</Box>
          </Box>
        ))}
        {lines.length < rawLines.length && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
            <Box sx={{ width: 30, pr: 2 }} />
            <span className="terminal-cursor" style={{ width: 6, height: 12 }} />
          </Box>
        )}
      </Typography>
    </Box>
  );
};

// Sub-component for sequential search card animations
const SearchResultsFeedCard: React.FC<{ data: any; onAction: (q: string) => void }> = ({ data, onAction }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    let index = 0;
    const interval = setInterval(() => {
      if (index < data.results.length) {
        setVisibleCount(prev => prev + 1);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [data.results]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {data.results.slice(0, visibleCount).map((res: any, idx: number) => (
        <Paper key={idx} sx={{ p: 1.5, background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px', animation: 'cardFadeIn 0.3s ease-in-out forwards' }} variant="outlined">
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
            onClick={() => onAction(`Read file ${res.file} in ${data.workspace}`)}
          >
            <CodeIcon sx={{ mr: 1, color: '#7f5af0', fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, textDecoration: 'underline', color: '#cbd5e1' }}>
              {res.file}
            </Typography>
          </Box>
          <Divider sx={{ my: 0.75, borderColor: 'rgba(255,255,255,0.03)' }} />
          {res.matches.map((match: string, matchIdx: number) => (
            <Box
              key={matchIdx}
              sx={{
                fontFamily: 'monospace',
                color: '#94a3b8',
                pl: 1.5,
                py: 0.25,
                borderLeft: '2px solid #7f5af0',
                fontSize: '0.75rem',
                my: 0.5,
                background: 'rgba(127, 85, 240, 0.01)',
                borderRadius: '6px',
                overflowX: 'auto',
                whiteSpace: 'pre'
              }}
            >
              {match}
            </Box>
          ))}
        </Paper>
      ))}
    </Box>
  );
};

// Sub-component for sequential Web search simulation card
const WebSearchFeedCard: React.FC<{ data: any; token: string }> = ({ data, token }) => {
  const [activeUrl, setActiveUrl] = useState(data.url);
  const [isViewingAsset, setIsViewingAsset] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const [showApiManager, setShowApiManager] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [mockApiKeys, setMockApiKeys] = useState<{ id: string; name: string; key: string }[]>([
    { id: '1', name: 'Production-Key', key: 'sk-proj-vertex-a29d...' }
  ]);

  useEffect(() => {
    setVisibleCount(0);
    let index = 0;
    const interval = setInterval(() => {
      if (index < data.results.length) {
        setVisibleCount(prev => prev + 1);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [data.results]);

  const handleLinkClick = (e: React.MouseEvent, title: string, link: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveUrl(link);
    setIsViewingAsset(true);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pctX = (clickX / rect.width) * 100;
    const pctY = (clickY / rect.height) * 100;
    
    // Add ripple animation data
    const newId = Date.now();
    setRipples(prev => [...prev, { x: Math.round(clickX), y: Math.round(clickY), id: newId }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newId));
    }, 800);

    // Hotspot 1: "Manage API Keys" blue button (around horizontal 60-70%, vertical 76-86%)
    if (pctX >= 58 && pctX <= 72 && pctY >= 76 && pctY <= 86) {
      setShowApiManager(true);
      return;
    }

    // Hotspot 2: Code block copy button area (around horizontal 74-84%, vertical 53-63%)
    if (pctX >= 74 && pctX <= 84 && pctY >= 53 && pctY <= 63) {
      // Demo placeholder only — never copy realistic-looking secrets.
      navigator.clipboard.writeText("demo-placeholder-not-a-real-key");
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
      return;
    }

    // Clicks in the simulated viewport stay client-side (ripple only).
    // The old /api/web/click bridge pretended clicks reached a live
    // screen; removed with its backend endpoint.
  };

  return (
    <LaptopBrowserFrame url={activeUrl}>
      {!isViewingAsset ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.results.slice(0, visibleCount).map((res: any, idx: number) => (
            <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, animation: 'cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography
                  variant="body2"
                  component="a"
                  href={res.link}
                  onClick={(e) => handleLinkClick(e, res.title, res.link)}
                  sx={{
                    fontWeight: 600,
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  {res.title}
                </Typography>
                <Chip label="SECURE PASS" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(34, 197, 94, 0.08)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.15)' }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#a1a1aa', fontSize: '0.75rem', lineHeight: 1.4 }}>
                {res.snippet}
              </Typography>
              <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.65rem', fontFamily: 'monospace' }}>
                {res.link}
              </Typography>
              {idx < data.results.length - 1 && <Divider sx={{ mt: 1, borderColor: 'rgba(255,255,255,0.03)' }} />}
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ animation: 'cardFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, letterSpacing: '0.05em' }}>
                LIVE VIEWPORT PREVIEW (CLICK TO INTERACT)
              </Typography>
              <Chip label="INDEX MATCH: 94%" size="small" sx={{ height: 16, fontSize: '0.55rem', background: 'rgba(127, 85, 240, 0.08)', color: '#b794f4', border: '1px solid rgba(127, 85, 240, 0.15)' }} />
            </Box>
            <Button
              size="small"
              onClick={() => {
                setActiveUrl(data.url);
                setIsViewingAsset(false);
              }}
              sx={{
                fontSize: '0.65rem',
                py: 0.25,
                px: 1.5,
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px'
              }}
            >
              Back to Search
            </Button>
          </Box>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: '8px',
              overflow: 'hidden',
              borderColor: 'rgba(255, 255, 255, 0.06)',
              background: '#09090b',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              cursor: 'crosshair',
              position: 'relative'
            }}
          >
            <img
              src="/web_search_asset_screenshot.jpg"
              alt="Live Screen Mockup Viewport"
              onClick={handleImageClick}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            {ripples.map(r => (
              <Box
                key={r.id}
                sx={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid #7f5af0',
                  backgroundColor: 'rgba(127, 85, 240, 0.25)',
                  pointerEvents: 'none',
                  animation: 'rippleEffect 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards'
                }}
              />
            ))}

            {/* Live API key manager overlay */}
            {showApiManager && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'rgba(9, 9, 11, 0.95)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  p: 3,
                  animation: 'fadeIn 0.2s ease-out',
                  zIndex: 20
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f4f4f5', fontFamily: 'Plus Jakarta Sans' }}>
                    API Keys Manager
                  </Typography>
                  <IconButton size="small" onClick={() => setShowApiManager(false)} sx={{ color: '#a0aec0' }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                  <input
                    type="text"
                    placeholder="Key name (e.g. Staging-Secret)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    style={{
                      flexGrow: 1,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: '#cbd5e1',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (!newKeyName.trim()) return;
                      const randKey = 'sk-proj-vertex-' + Math.random().toString(36).substr(2, 6) + '...';
                      setMockApiKeys(prev => [...prev, { id: Date.now().toString(), name: newKeyName, key: randKey }]);
                      setNewKeyName('');
                    }}
                    sx={{
                      background: '#7f5af0',
                      color: '#fff',
                      fontSize: '0.7rem',
                      py: 0.5,
                      px: 2,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: 700,
                      borderRadius: '6px',
                      textTransform: 'none',
                      '&:hover': { background: '#6c4ad0' }
                    }}
                  >
                    Create Key
                  </Button>
                </Box>

                <Typography variant="caption" sx={{ color: '#8e8e93', mb: 1, display: 'block', fontWeight: 600 }}>
                  ACTIVE SYSTEM KEYS
                </Typography>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }} className="scroll-container">
                  {mockApiKeys.map(k => (
                    <Box
                      key={k.id}
                      sx={{
                        p: 1.5,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.75rem' }}>
                          {k.name}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#71717a', fontSize: '0.65rem' }}>
                          {k.key}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        onClick={() => {
                          setMockApiKeys(prev => prev.filter(x => x.id !== k.id));
                        }}
                        sx={{ color: '#ef4444', fontSize: '0.6rem', minWidth: 0, p: 0.5 }}
                      >
                        REVOKE
                      </Button>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Clipboard Copy Notification */}
            {copiedNotification && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#22c55e',
                  color: '#fff',
                  px: 2,
                  py: 0.75,
                  borderRadius: '99px',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  animation: 'fadeIn 0.2s ease-out',
                  zIndex: 25
                }}
              >
                Mock API Key copied to clipboard!
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </LaptopBrowserFrame>
  );
};

// Sub-component for sequential workflows and CI/CD runs
const WorkflowsFeedCard: React.FC<{ data: any }> = ({ data }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" sx={{ color: '#8e8e93', fontFamily: 'monospace' }}>
        Workflow execution history for workspace: {data.workspace}
      </Typography>
      {data.workflows.map((wf: any, idx: number) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            p: 2,
            background: 'rgba(255, 255, 255, 0.01)',
            borderColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: wf.status === 'success' ? '#22c55e' : '#ef4444',
                boxShadow: wf.status === 'success' ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
              }}
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#f4f4f5' }}>
                {wf.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#a0aec0', fontSize: '0.65rem' }}>
                  Run {wf.lastRun}
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />
                <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.65rem' }}>
                  {wf.date}
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 0.5 }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#7f5af0', fontSize: '0.65rem' }}>
                  {wf.branch} ({wf.commit})
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: '#cbd5e1', fontSize: '0.7rem' }}>
              {wf.duration}
            </Typography>
            <Chip
              label={wf.status.toUpperCase()}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.55rem',
                fontWeight: 700,
                background: wf.status === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                color: wf.status === 'success' ? '#22c55e' : '#ef4444',
                border: wf.status === 'success' ? '1px solid rgba(34, 197, 94, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                mt: 0.5
              }}
            />
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

// Sub-component for task process execution stdout/stderr streams
const ExecutionLogsFeedCard: React.FC<{ data: any; procId: string; token: string }> = ({ data, procId, token }) => {
  const [isRunning, setIsRunning] = useState(true);

  const handleStop = async () => {
    try {
      const resp = await fetch('/api/execute/kill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ procId })
      });
      if (resp.ok) {
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Failed to terminate process:', err);
    }
  };

  useEffect(() => {
    // Check exit status logs for completion
    const lastLog = data.logs[data.logs.length - 1] || '';
    if (lastLog.includes('Process completed')) {
      setIsRunning(false);
    }
  }, [data.logs]);

  return (
    <Box
      sx={{
        background: '#040405',
        p: 2,
        borderRadius: '12px',
        border: '1px solid rgba(127, 85, 240, 0.12)'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: isRunning ? '#7f5af0' : '#71717a', fontWeight: 700 }}>
          EXECUTING: {data.command}
        </Typography>
        {isRunning && (
          <Button
            size="small"
            onClick={handleStop}
            sx={{
              fontSize: '0.6rem',
              py: 0.25,
              px: 1.5,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '4px'
            }}
          >
            TERMINATE TASK
          </Button>
        )}
      </Box>
      <Typography
        component="div"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: '#cbd5e1',
          lineHeight: 1.5,
          maxHeight: 220,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap'
        }}
      >
        {data.logs.map((log: string, lIdx: number) => (
          <Box key={lIdx} sx={{ mb: 0.5 }}>
            {log}
          </Box>
        ))}
        {isRunning && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
            <span className="terminal-cursor" style={{ width: 6, height: 12 }} />
          </Box>
        )}
      </Typography>
    </Box>
  );
};

// Sub-component for Git tree status and commit histories
const GitHistoryFeedCard: React.FC<{ data: any }> = ({ data }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
        <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
          WORKING TREE STATUS
        </Typography>
        <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8', m: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
          {data.status || 'Clean working tree.'}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
        <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
          RECENT WORKSPACE COMMITS
        </Typography>
        <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1', m: 0, overflowX: 'auto', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {data.log || 'No commit logs available.'}
        </Typography>
      </Paper>
    </Box>
  );
};

// Sub-component for active Desktop applications statuses
const DesktopAppsFeedCard: React.FC<{ token: string }> = ({ token }) => {
  const [apps, setApps] = useState<{ name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/desktop/apps', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setApps(data.apps || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <LinearProgress sx={{ my: 2 }} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="caption" sx={{ color: '#8e8e93', fontFamily: 'monospace', mb: 0.5 }}>
        Running developer desktop applications checklist
      </Typography>
      {apps.map((app, idx) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            p: 1.5,
            background: 'rgba(255,255,255,0.01)',
            borderColor: 'rgba(255,255,255,0.04)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#cbd5e1' }}>
            {app.name}
          </Typography>
          <Chip
            label={app.status.toUpperCase()}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 700,
              background: app.status === 'Running' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              color: app.status === 'Running' ? '#22c55e' : '#71717a',
              border: app.status === 'Running' ? '1px solid rgba(34, 197, 94, 0.15)' : '1px solid rgba(255,255,255,0.06)'
            }}
          />
        </Paper>
      ))}
    </Box>
  );
};

export const PreviewPanel: React.FC<PreviewProps> = ({ previewFeed, onClose, onAction, onRemoveItem, onClearFeed, token }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [previewFeed]);

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(20, 20, 25, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.01)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ViewStreamIcon sx={{ color: '#7f5af0', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
            Intelligence Feed
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {previewFeed.length > 0 && (
              <Tooltip title="Clear Feed Dashboard">
                <IconButton size="small" onClick={onClearFeed} sx={{ color: '#a0aec0' }}>
                  <ClearAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={onClose} sx={{ color: '#a0aec0' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Preview Feed Body */}
      <Box className="scroll-container" sx={{ flexGrow: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {previewFeed.length === 0 ? (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              p: 4,
              textAlign: 'center',
              minHeight: '100%',
              position: 'relative'
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(127, 85, 240, 0.04)',
                border: '1px solid rgba(127, 85, 240, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                boxShadow: '0 0 20px rgba(127, 85, 240, 0.05)'
              }}
            >
              <TerminalIcon sx={{ fontSize: 32, color: '#7f5af0' }} />
            </Box>
            <Typography variant="body1" sx={{ color: '#f4f4f5', fontWeight: 600, mb: 1 }}>
              Intelligence Feed
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280, fontSize: '0.85rem', lineHeight: 1.6 }}>
              Interactive files, telemetry statistics, and search components will stream here as you explore.
            </Typography>
          </Box>
        ) : (
          previewFeed.map((item) => (
            <Paper
              key={item.id}
              elevation={0}
              className="feed-card-animation"
              sx={{
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                p: 0.5
              }}
            >
              {/* Card Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1,
                  background: 'rgba(255, 255, 255, 0.005)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                }}
              >
                <Typography variant="caption" sx={{ color: '#b794f4', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  {item.type === 'WorkspaceList' && 'WORKSPACES'}
                  {item.type === 'FileList' && `FILE INDEX: ${item.data.workspace}`}
                  {item.type === 'CodePreview' && `CODE: ${item.data.workspace}/${item.data.path}`}
                  {item.type === 'SearchResults' && `SEARCH: "${item.data.keyword}"`}
                  {item.type === 'WebSearch' && `WEB SEARCH: "${item.data.keyword}"`}
                  {item.type === 'WorkflowsList' && `PIPELINES: ${item.data.workspace}`}
                  {item.type === 'ExecutionLogs' && `TASK CONSOLE`}
                  {item.type === 'GitHistory' && `GIT STATUS: ${item.data.workspace}`}
                  {item.type === 'DesktopApps' && `SYSTEM APP TELEMETRY`}
                  {item.type === 'TerminalLogs' && 'TERMINAL SCAN'}
                  {item.type === 'MemoryRecall' && 'MEMORY RECALL'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                    {item.timestamp}
                  </Typography>
                  {item.type === 'CodePreview' && (
                    <Tooltip title={copiedId === item.id ? "Copied!" : "Copy code"}>
                      <IconButton size="small" onClick={() => handleCopy(item.data.content, item.id)} sx={{ color: '#a0aec0', p: 0.25 }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton size="small" onClick={() => onRemoveItem(item.id)} sx={{ color: '#a0aec0', p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Box>
              </Box>

              {/* Card Content */}
              <Box sx={{ p: 2 }}>
                {item.type === 'WorkspaceList' && (
                  <Box>
                    {/* Architecture diagram */}
                    <WorkspaceArchitectureMap onAction={onAction} />
                    
                    <Grid container spacing={1.5}>
                      {item.data.map((ws: any, idx: number) => (
                        <Grid item xs={12} key={idx}>
                          <Card sx={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                            <CardActionArea onClick={() => onAction(`List files in ${ws.name}`)}>
                              <CardContent sx={{ p: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                  <FolderIcon color="primary" sx={{ mr: 1, fontSize: 18 }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#f4f4f5' }}>
                                    {ws.name}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {ws.path}
                                </Typography>
                              </CardContent>
                            </CardActionArea>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {item.type === 'FileList' && (
                  <FileListFeedCard data={item.data} onAction={onAction} />
                )}

                {item.type === 'CodePreview' && (
                  <CodePreviewFeedCard data={item.data} />
                )}

                {item.type === 'SearchResults' && (
                  <LaptopBrowserFrame url={`https://portal.local/search?q=${encodeURIComponent(item.data.keyword)}`}>
                    <SearchResultsFeedCard data={item.data} onAction={onAction} />
                  </LaptopBrowserFrame>
                )}

                {item.type === 'WebSearch' && (
                  <WebSearchFeedCard data={item.data} token={token} />
                )}

                {item.type === 'WorkflowsList' && (
                  <WorkflowsFeedCard data={item.data} />
                )}

                {item.type === 'ExecutionLogs' && (
                  <ExecutionLogsFeedCard data={item.data} procId={item.id} token={token} />
                )}

                {item.type === 'GitHistory' && (
                  <GitHistoryFeedCard data={item.data} />
                )}

                {item.type === 'DesktopApps' && (
                  <DesktopAppsFeedCard token={token} />
                )}

                {item.type === 'TerminalLogs' && (
                  <Box
                    sx={{
                      background: '#040405',
                      p: 1.5,
                      borderRadius: '12px',
                      border: '1px solid rgba(127, 85, 240, 0.12)',
                      maxHeight: 280,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <Typography component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8', lineHeight: 1.5 }}>
                      {item.data.logs.map((log: string, lIdx: number) => (
                        <Box key={lIdx} sx={{ mb: 0.5, display: 'flex', alignItems: 'flex-start' }}>
                          <Box sx={{ color: '#22c55e', mr: 1, userSelect: 'none' }}>❯</Box>
                          <Box sx={{ flexGrow: 1, whiteSpace: 'pre-wrap' }}>{log}</Box>
                        </Box>
                      ))}
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Box sx={{ color: '#22c55e', mr: 1, userSelect: 'none' }}>❯</Box>
                        <Box sx={{ color: '#a0aec0' }}>running active query scan</Box>
                        <span className="terminal-cursor" style={{ width: 6, height: 12 }} />
                      </Box>
                    </Typography>
                  </Box>
                )}

                {item.type === 'MemoryRecall' && (
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, rgba(109,40,217,0.08) 0%, rgba(15,10,30,0.95) 100%)',
                      p: 1.5,
                      borderRadius: '12px',
                      border: '1px solid rgba(109,40,217,0.25)',
                      maxHeight: 260,
                      overflowY: 'auto',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        boxShadow: '0 0 8px rgba(124,58,237,0.6)',
                        flexShrink: 0
                      }} />
                      <Typography sx={{ fontSize: '0.7rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                        ROOK MEMORY — workspace context recalled
                      </Typography>
                    </Box>
                    {(item.data.memories as string[]).map((mem: string, mIdx: number) => (
                      <Box key={mIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                        <Box sx={{ color: '#7c3aed', fontSize: '0.7rem', mt: '2px', flexShrink: 0 }}>—</Box>
                        <Typography sx={{ fontSize: '0.78rem', color: '#c4b5fd', lineHeight: 1.5, fontFamily: 'monospace' }}>
                          {mem}
                        </Typography>
                      </Box>
                    ))}
                    {(item.data.memories as string[]).length === 0 && (
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace', fontStyle: 'italic' }}>
                        No prior context found. Memory will populate as you explore workspaces.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          ))
        )}
        <div ref={feedEndRef} />
      </Box>
    </Paper>
  );
};
