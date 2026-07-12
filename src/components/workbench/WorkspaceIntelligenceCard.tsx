// src/components/workbench/WorkspaceIntelligenceCard.tsx
import React, { useMemo } from 'react';
import { Box, Typography, Grid, Paper, Chip, Stack, List, ListItem, ListItemText, Tooltip } from '@mui/material';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LayersIcon from '@mui/icons-material/Layers';
import ArticleIcon from '@mui/icons-material/Article';

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface IntelligenceProps {
  files: FileInfo[];
  workspaceName: string;
}

export const WorkspaceIntelligenceCard: React.FC<IntelligenceProps> = ({ files, workspaceName }) => {
  const analysis = useMemo(() => {
    const safeFiles = files || [];
    const fileNames = new Set(safeFiles.map(f => f.name));
    const paths = new Set(safeFiles.map(f => f.path));

    // 1. Tech Stack Detection
    const stack: Array<{ name: string; confidence: 'detected' | 'likely' | 'unknown' }> = [];
    
    // NestJS detection
    if (fileNames.has('nest-cli.json') || paths.has('src/app.module.ts')) {
      stack.push({ name: 'NestJS Backend Framework', confidence: 'detected' });
    }
    // Next.js detection
    if (fileNames.has('next.config.js') || fileNames.has('next.config.mjs') || paths.has('.next')) {
      stack.push({ name: 'Next.js Web Framework', confidence: 'detected' });
    }
    // React + Vite detection
    if (fileNames.has('vite.config.ts') || fileNames.has('vite.config.js')) {
      stack.push({ name: 'React SPA (Vite)', confidence: 'detected' });
    } else if (fileNames.has('package.json') && !fileNames.has('nest-cli.json') && !fileNames.has('next.config.js')) {
      stack.push({ name: 'Node.js Application', confidence: 'likely' });
    }
    // Python detection
    if (fileNames.has('requirements.txt') || fileNames.has('Pipfile') || fileNames.has('pyproject.toml')) {
      stack.push({ name: 'Python Repository', confidence: 'detected' });
    } else if (safeFiles.some(f => f.name.endsWith('.py'))) {
      stack.push({ name: 'Python Scripts', confidence: 'likely' });
    }
    // Rust detection
    if (fileNames.has('Cargo.toml')) {
      stack.push({ name: 'Rust Cargo Package', confidence: 'detected' });
    }

    if (stack.length === 0) {
      stack.push({ name: 'Generic Source Repository', confidence: 'unknown' });
    }

    // 2. Documentation audits
    const docs = {
      readme: fileNames.has('README.md') || fileNames.has('readme.md'),
      security: fileNames.has('SECURITY.md') || fileNames.has('security.md'),
      license: fileNames.has('LICENSE') || fileNames.has('license')
    };

    // 3. Entry Points detection
    const entryPoints: string[] = [];
    const entryCandidates = [
      'src/main.tsx',
      'src/main.ts',
      'src/index.ts',
      'src/index.js',
      'server/index.ts',
      'server.mjs',
      'main.py',
      'app.py',
      'src/app.ts',
      'index.js'
    ];
    entryCandidates.forEach(cand => {
      if (paths.has(cand) || fileNames.has(cand)) {
        entryPoints.push(cand);
      }
    });

    return { stack, docs, entryPoints };
  }, [files]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        background: 'rgba(255, 255, 255, 0.01)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '10px',
        mb: 3
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <MemoryIcon sx={{ color: '#7f5af0', fontSize: 16 }} />
        <Typography variant="body2" sx={{ fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.01em' }}>
          Workspace Intelligence Dashboard
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {/* Tech Stack Column */}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            DETECTED TECH STACK
          </Typography>
          <Stack spacing={1}>
            {analysis.stack.map((tech, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <Typography variant="body2" sx={{ color: '#e4e4e7', fontSize: '0.72rem', fontWeight: 600 }}>{tech.name}</Typography>
                <Chip
                  label={tech.confidence.toUpperCase()}
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: '0.5rem',
                    fontWeight: 900,
                    background: tech.confidence === 'detected' ? 'rgba(34,197,94,0.08)' : (tech.confidence === 'likely' ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.03)'),
                    color: tech.confidence === 'detected' ? '#22c55e' : (tech.confidence === 'likely' ? '#38bdf8' : '#71717a')
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Grid>

        {/* Documentation Coverage Column */}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            DOCUMENTATION COVERAGE
          </Typography>
          <Stack spacing={1}>
            {/* README */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArticleIcon sx={{ fontSize: 13, color: '#a1a1aa' }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>README.md</Typography>
              </Box>
              {analysis.docs.readme ? (
                <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 13 }} />
              ) : (
                <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 13 }} />
              )}
            </Box>
            {/* SECURITY */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArticleIcon sx={{ fontSize: 13, color: '#a1a1aa' }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>SECURITY.md</Typography>
              </Box>
              {analysis.docs.security ? (
                <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 13 }} />
              ) : (
                <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 13 }} />
              )}
            </Box>
            {/* LICENSE */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArticleIcon sx={{ fontSize: 13, color: '#a1a1aa' }} />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>LICENSE</Typography>
              </Box>
              {analysis.docs.license ? (
                <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 13 }} />
              ) : (
                <WarningAmberIcon sx={{ color: '#71717a', fontSize: 13 }} />
              )}
            </Box>
          </Stack>
        </Grid>

        {/* Workspace Entry Points Column */}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" sx={{ color: '#71717a', fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            KEY ENTRY POINTS
          </Typography>
          {analysis.entryPoints.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#71717a', fontStyle: 'italic' }}>None auto-detected.</Typography>
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              {analysis.entryPoints.map((ep, idx) => (
                <Chip
                  key={idx}
                  label={ep}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    fontFamily: 'monospace',
                    background: 'rgba(127, 85, 240, 0.04)',
                    borderColor: 'rgba(127, 85, 240, 0.15)',
                    color: '#b794f4',
                    borderWidth: 1,
                    borderStyle: 'solid'
                  }}
                />
              ))}
            </Stack>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
};
