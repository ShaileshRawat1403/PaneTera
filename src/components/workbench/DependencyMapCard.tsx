import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Chip, Divider, List, ListItem, ListItemIcon, ListItemText, FormControlLabel, Switch } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BlockIcon from '@mui/icons-material/Block';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import { accent, ink, status as statusToken } from '../../theme/cssTokens';

interface DependencyNode {
  path: string;
  language: string;
  status: 'resolved' | 'external' | 'blocked' | 'missing' | 'skipped';
  reason?: string;
}

interface DependencyEdge {
  from: string;
  to: string;
  importSource: string;
  status: string;
}

interface DependencyData {
  entryPoint: string;
  maxDepth: number;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  warnings: string[];
}

interface DependencyMapCardProps {
  data: DependencyData | null;
  loading: boolean;
  onSelectNode?: (node: DependencyNode) => void;
}

export const DependencyMapCard: React.FC<DependencyMapCardProps> = ({ data, loading, onSelectNode }) => {
  const [localOnly, setLocalOnly] = useState(false);
  if (loading) {
    return (
      <Card sx={{ background: 'rgba(20, 20, 25, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: ink.disabled }}>Mapping dependency routes...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card sx={{ background: 'rgba(20, 20, 25, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <DeviceHubIcon sx={{ color: ink.disabled }} />
            <Typography variant="subtitle1" sx={{ color: ink.primary, fontWeight: 600 }}>Dependency Map</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: ink.disabled }}>
            Select a source file and trigger "Map Dependencies" to calculate code routing paths.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const filteredNodes = localOnly
    ? data.nodes.filter(n => n.status !== 'external')
    : data.nodes;

  const filteredEdges = localOnly
    ? data.edges.filter(edge => {
        const toNode = data.nodes.find(n => n.path === edge.to);
        const fromNode = data.nodes.find(n => n.path === edge.from);
        return (!toNode || toNode.status !== 'external') && (!fromNode || fromNode.status !== 'external');
      })
    : data.edges;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircleOutlineIcon sx={{ color: statusToken.success, fontSize: 15 }} />;
      case 'blocked':
        return <BlockIcon sx={{ color: statusToken.danger, fontSize: 15 }} />;
      case 'missing':
        return <ErrorOutlineIcon sx={{ color: statusToken.brass, fontSize: 15 }} />;
      default:
        return <HelpOutlineIcon sx={{ color: ink.disabled, fontSize: 15 }} />;
    }
  };

  const getStatusChip = (status: string, reason?: string) => {
    // Annotated, because a token is a literal string type: inferring from the
    // initialiser would pin `color` to the ink.disabled value alone.
    let color: string = ink.disabled;
    let bg = 'rgba(255,255,255,0.05)';
    let border = 'rgba(255,255,255,0.1)';
    let displayStatus = status;

    if (status === 'resolved') {
      color = statusToken.success;
      bg = 'rgba(34, 197, 94, 0.05)';
      border = 'rgba(34, 197, 94, 0.15)';
    } else if (status === 'blocked') {
      color = statusToken.danger;
      bg = 'rgba(239, 68, 68, 0.05)';
      border = 'rgba(239, 68, 68, 0.15)';
    } else if (status === 'missing') {
      color = statusToken.brass;
      bg = 'rgba(245, 158, 11, 0.05)';
      border = 'rgba(245, 158, 11, 0.15)';
      displayStatus = 'unresolved'; // Map missing status to unresolved
    }

    return (
      <Chip 
        label={reason ? `${displayStatus}: ${reason}` : displayStatus} 
        size="small" 
        sx={{ height: '18px', fontSize: '9px', background: bg, color, border: `1px solid ${border}`, fontWeight: 600 }} 
      />
    );
  };

  const scrollbarStyles = {
    maxHeight: '180px',
    overflowY: 'auto',
    pr: 0.5,
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '2px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: 'rgba(255, 255, 255, 0.2)',
    },
  };

  return (
    <Card sx={{ background: 'rgba(20, 20, 25, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Disclaimer Banner */}
      <Box sx={{ background: 'rgba(127, 85, 240, 0.05)', borderBottom: '1px solid rgba(127, 85, 240, 0.1)', px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeviceHubIcon sx={{ color: accent.violet, fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: ink.secondary, fontWeight: 600, fontSize: '13px' }}>
            Dependency Map: <span style={{ fontFamily: 'monospace', color: accent.violet }}>{data.entryPoint.split('/').pop()}</span>
          </Typography>
        </Box>
        <Chip label="static scan, approximate" size="small" sx={{ height: '18px', fontSize: '10px', background: 'rgba(127, 85, 240, 0.15)', color: accent.violet, border: '1px solid rgba(127, 85, 240, 0.3)', fontWeight: 600 }} />
      </Box>

      {/* Helper text block & Filter Switch */}
      <Box sx={{ px: 2, py: 1, background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" sx={{ color: ink.disabled, fontStyle: 'italic', fontSize: '10px' }}>
          Static dependency map. Approximate. No code execution.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={localOnly}
              onChange={(e) => setLocalOnly(e.target.checked)}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: accent.violet },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent.violet }
              }}
            />
          }
          label={<span style={{ fontSize: '10px', color: ink.secondary, fontWeight: 600 }}>Show local files only</span>}
          sx={{ m: 0 }}
        />
      </Box>

      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {data.warnings.map((warn, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 2, background: 'rgba(224, 86, 36, 0.05)', border: '1px solid rgba(224, 86, 36, 0.15)', borderRadius: '6px' }}>
            <ErrorOutlineIcon sx={{ color: statusToken.brass, fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: statusToken.brassMuted }}>{warn}</Typography>
          </Box>
        ))}

        {/* Nodes List */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
            Resolved Files & Targets ({filteredNodes.length})
          </Typography>
          <Box sx={scrollbarStyles}>
            <List dense sx={{ p: 0 }}>
              {filteredNodes.map((node, i) => (
                <ListItem 
                  key={i} 
                  onClick={() => onSelectNode?.(node)} 
                  sx={{ 
                    px: 1.5, 
                    py: 0.8, 
                    mb: 0.5, 
                    background: 'rgba(255,255,255,0.01)', 
                    borderRadius: '6px', 
                    border: '1px solid rgba(255,255,255,0.02)', 
                    cursor: 'pointer',
                    '&:hover': { background: 'rgba(255,255,255,0.03)' } 
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 26 }}>{getStatusIcon(node.status)}</ListItemIcon>
                  <ListItemText
                    primary={<span style={{ fontFamily: 'monospace', fontSize: '11px', color: ink.primary }}>{node.path}</span>}
                    secondary={node.language && <span style={{ fontSize: '9px', color: ink.disabled }}>{node.language}</span>}
                  />
                  {getStatusChip(node.status, node.reason)}
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Edges / Routes List */}
        <Box>
          <Typography variant="caption" sx={{ color: ink.disabled, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1.5 }}>
            Dependency Routing Paths ({filteredEdges.length})
          </Typography>
          {filteredEdges.length === 0 ? (
            <Typography variant="body2" sx={{ color: ink.disabled, fontStyle: 'italic' }}>
              No child imports or dependencies detected.
            </Typography>
          ) : (
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {filteredEdges.map((edge, i) => (
                  <ListItem key={i} sx={{ px: 1, py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: ink.muted }}>{edge.from.split('/').pop()}</span>
                          <ArrowRightAltIcon sx={{ fontSize: 14, color: ink.disabled }} />
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: ink.primary, fontWeight: 600 }}>{edge.to.split('/').pop()}</span>
                          <Chip label={edge.importSource} size="small" variant="outlined" sx={{ height: '14px', fontSize: '8px', color: ink.disabled, borderColor: 'rgba(255,255,255,0.1)' }} />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
