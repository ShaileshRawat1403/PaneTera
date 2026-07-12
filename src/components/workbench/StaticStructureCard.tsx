import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Divider, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import FunctionsIcon from '@mui/icons-material/Functions';
import ClassIcon from '@mui/icons-material/Class';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface ImportSymbol {
  source: string;
  kind: 'package' | 'relative' | 'alias' | 'unknown';
  line: number;
}

interface ExportSymbol {
  name: string;
  kind: string;
  line: number;
}

interface FunctionSymbol {
  name: string;
  line: number;
  exported: boolean;
}

interface ClassSymbol {
  name: string;
  line: number;
  exported: boolean;
}

interface StructureData {
  filePath: string;
  language: string;
  imports: ImportSymbol[];
  exports: ExportSymbol[];
  functions: FunctionSymbol[];
  classes: ClassSymbol[];
  warnings: string[];
}

interface StaticStructureCardProps {
  data: StructureData | null;
  loading: boolean;
  onNavigateToLine?: (line: number) => void;
}

export const StaticStructureCard: React.FC<StaticStructureCardProps> = ({ data, loading, onNavigateToLine }) => {
  if (loading) {
    return (
      <Card sx={{ background: 'rgba(20, 20, 25, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#71717a' }}>Analyzing static structure...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card sx={{ background: 'rgba(20, 20, 25, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <CodeIcon sx={{ color: '#71717a' }} />
            <Typography variant="subtitle1" sx={{ color: '#e4e4e7', fontWeight: 600 }}>Static Structure Scan</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#71717a' }}>
            Select a file (JS, TS, TSX, or Python) to view symbol structure analysis.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const hasContent = data.imports.length > 0 || data.exports.length > 0 || data.functions.length > 0 || data.classes.length > 0;

  // Custom scrollbar styles for lists
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
          <CodeIcon sx={{ color: '#a78bfa', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 600, fontSize: '13px' }}>
            Structure Scan: <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{data.filePath.split('/').pop()}</span>
          </Typography>
        </Box>
        <Chip label="static scan, approximate" size="small" sx={{ height: '18px', fontSize: '10px', background: 'rgba(127, 85, 240, 0.15)', color: '#b794f4', border: '1px solid rgba(127, 85, 240, 0.3)', fontWeight: 600 }} />
      </Box>

      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {data.warnings.map((warn, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 2, background: 'rgba(224, 86, 36, 0.05)', border: '1px solid rgba(224, 86, 36, 0.15)', borderRadius: '6px' }}>
            <WarningAmberIcon sx={{ color: '#f97316', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: '#fdba74' }}>{warn}</Typography>
          </Box>
        ))}

        {!hasContent && (
          <Typography variant="body2" sx={{ color: '#71717a', fontStyle: 'italic' }}>
            No imports, exports, functions, or classes detected in this file.
          </Typography>
        )}

        {/* Functions Section */}
        {data.functions.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Functions ({data.functions.length})
            </Typography>
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {data.functions.map((func, i) => (
                  <ListItem key={i} button onClick={() => onNavigateToLine?.(func.line)} sx={{ px: 1, py: 0.5, borderRadius: '4px', '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                    <ListItemIcon sx={{ minWidth: 26 }}><FunctionsIcon sx={{ fontSize: 14, color: '#60a5fa' }} /></ListItemIcon>
                    <ListItemText
                      primary={<span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e4e4e7' }}>{func.name}</span>}
                      secondary={func.exported && <Chip label="exported" size="small" sx={{ height: '14px', fontSize: '8px', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.2)', ml: 1 }} />}
                    />
                    <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace' }}>L{func.line}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}

        {/* Classes Section */}
        {data.classes.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Classes ({data.classes.length})
            </Typography>
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {data.classes.map((cls, i) => (
                  <ListItem key={i} button onClick={() => onNavigateToLine?.(cls.line)} sx={{ px: 1, py: 0.5, borderRadius: '4px', '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                    <ListItemIcon sx={{ minWidth: 26 }}><ClassIcon sx={{ fontSize: 14, color: '#f59e0b' }} /></ListItemIcon>
                    <ListItemText primary={<span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e4e4e7' }}>{cls.name}</span>} />
                    <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace' }}>L{cls.line}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}

        {/* Exports Section */}
        {data.exports.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Exports ({data.exports.length})
            </Typography>
            <Box sx={{ ...scrollbarStyles, maxHeight: '120px' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {data.exports.map((exp, i) => (
                  <Chip
                    key={i}
                    label={`${exp.name} (${exp.kind})`}
                    onClick={() => onNavigateToLine?.(exp.line)}
                    size="small"
                    sx={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      background: 'rgba(34, 197, 94, 0.05)',
                      color: '#4ade80',
                      border: '1px solid rgba(34, 197, 94, 0.15)',
                      '&:hover': { background: 'rgba(34, 197, 94, 0.1)' }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {/* Imports Section */}
        {data.imports.length > 0 && (
          <Box>
            <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />
            <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Imports ({data.imports.length})
            </Typography>
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {data.imports.map((imp, i) => (
                  <ListItem key={i} button onClick={() => onNavigateToLine?.(imp.line)} sx={{ px: 1, py: 0.5, borderRadius: '4px', '&:hover': { background: 'rgba(255,255,255,0.02)' } }}>
                    <ListItemIcon sx={{ minWidth: 26 }}><ImportExportIcon sx={{ fontSize: 14, color: '#a78bfa' }} /></ListItemIcon>
                    <ListItemText
                      primary={<span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#d4d4d8', wordBreak: 'break-all' }}>{imp.source}</span>}
                      secondary={<span style={{ fontSize: '9px', color: imp.kind === 'relative' ? '#fb7185' : imp.kind === 'alias' ? '#38bdf8' : '#a1a1aa' }}>{imp.kind}</span>}
                    />
                    <Typography variant="caption" sx={{ color: '#71717a', fontFamily: 'monospace' }}>L{imp.line}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
