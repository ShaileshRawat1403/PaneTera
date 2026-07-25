import React from 'react';
import { Box, Typography, Card, CardContent, Chip, Divider, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import FunctionsIcon from '@mui/icons-material/Functions';
import ClassIcon from '@mui/icons-material/Class';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { accent, ink, surface } from '../../theme/cssTokens';

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
      <Card sx={{ backgroundColor: surface.raised, border: `1px solid ${surface.border}`, borderRadius: '12px' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: ink.muted }}>Analyzing static structure...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card sx={{ backgroundColor: surface.raised, border: `1px solid ${surface.border}`, borderRadius: '12px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <CodeIcon sx={{ color: accent.violet }} />
            <Typography variant="subtitle1" sx={{ color: ink.primary, fontWeight: 600 }}>Static Structure Scan</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: ink.secondary }}>
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
    <Card sx={{ backgroundColor: surface.raised, border: `1px solid ${surface.border}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* Disclaimer Banner */}
      <Box sx={{ backgroundColor: accent.violetMuted, borderBottom: `1px solid ${surface.border}`, px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon sx={{ color: accent.violet, fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600, fontSize: '13px' }}>
            Structure Scan: <span style={{ fontFamily: 'monospace', color: accent.violet }}>{data.filePath.split('/').pop()}</span>
          </Typography>
        </Box>
        <Chip label="static scan, approximate" size="small" sx={{ height: '18px', fontSize: '10px', backgroundColor: accent.violetMuted, color: accent.violet, border: `1px solid ${accent.violetBorder}`, fontWeight: 600 }} />
      </Box>

      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {data.warnings.map((warn, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 2, backgroundColor: surface.sunken, border: `1px solid ${surface.border}`, borderRadius: '6px' }}>
            <WarningAmberIcon sx={{ color: accent.violet, fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: ink.secondary }}>{warn}</Typography>
          </Box>
        ))}

        {!hasContent && (
          <Typography variant="body2" sx={{ color: ink.muted, fontStyle: 'italic' }}>
            No imports, exports, functions, or classes detected in this file.
          </Typography>
        )}

        {/* Functions Section */}
        {data.functions.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Functions ({data.functions.length})
            </Typography>
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {data.functions.map((func, i) => (
                  <ListItem key={i} button onClick={() => onNavigateToLine?.(func.line)} sx={{ px: 1, py: 0.5, borderRadius: '4px', '&:hover': { backgroundColor: surface.sunken } }}>
                    <ListItemIcon sx={{ minWidth: 26 }}><FunctionsIcon sx={{ fontSize: 14, color: accent.violet }} /></ListItemIcon>
                    <ListItemText
                      primary={<span style={{ fontFamily: 'monospace', fontSize: '12px', color: ink.primary }}>{func.name}</span>}
                      secondary={func.exported && <Chip label="exported" size="small" sx={{ height: '14px', fontSize: '8px', backgroundColor: accent.violetMuted, color: accent.violet, border: `1px solid ${accent.violetBorder}`, ml: 1 }} />}
                    />
                    <Typography variant="caption" sx={{ color: ink.muted, fontFamily: 'monospace' }}>L{func.line}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}

        {/* Classes Section */}
        {data.classes.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Classes ({data.classes.length})
            </Typography>
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {data.classes.map((cls, i) => (
                  <ListItem key={i} button onClick={() => onNavigateToLine?.(cls.line)} sx={{ px: 1, py: 0.5, borderRadius: '4px', '&:hover': { backgroundColor: surface.sunken } }}>
                    <ListItemIcon sx={{ minWidth: 26 }}><ClassIcon sx={{ fontSize: 14, color: accent.violet }} /></ListItemIcon>
                    <ListItemText primary={<span style={{ fontFamily: 'monospace', fontSize: '12px', color: ink.primary }}>{cls.name}</span>} />
                    <Typography variant="caption" sx={{ color: ink.muted, fontFamily: 'monospace' }}>L{cls.line}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        )}

        {/* Exports Section */}
        {data.exports.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
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
                      backgroundColor: surface.sunken,
                      color: ink.primary,
                      border: `1px solid ${surface.border}`,
                      '&:hover': { backgroundColor: surface.raised }
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
            <Divider sx={{ my: 1.5, borderColor: surface.border }} />
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
              Imports ({data.imports.length})
            </Typography>
            <Box sx={scrollbarStyles}>
              <List dense sx={{ p: 0 }}>
                {data.imports.map((imp, i) => (
                  <ListItem key={i} button onClick={() => onNavigateToLine?.(imp.line)} sx={{ px: 1, py: 0.5, borderRadius: '4px', '&:hover': { backgroundColor: surface.sunken } }}>
                    <ListItemIcon sx={{ minWidth: 26 }}><ImportExportIcon sx={{ fontSize: 14, color: accent.violet }} /></ListItemIcon>
                    <ListItemText
                      primary={<span style={{ fontFamily: 'monospace', fontSize: '11px', color: ink.primary, wordBreak: 'break-all' }}>{imp.source}</span>}
                      secondary={<span style={{ fontSize: '9px', color: ink.secondary }}>{imp.kind}</span>}
                    />
                    <Typography variant="caption" sx={{ color: ink.muted, fontFamily: 'monospace' }}>L{imp.line}</Typography>
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
