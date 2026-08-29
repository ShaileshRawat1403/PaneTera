import React, { useMemo } from 'react';
import { Box, Typography, Grid, Paper, Chip, Stack } from '@mui/material';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArticleIcon from '@mui/icons-material/Article';
import { accent, ink, status, surface } from '../../theme/cssTokens';

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface IntelligenceProps {
  files: FileInfo[];
  workspaceName: string;
}

export const WorkspaceIntelligenceCard: React.FC<IntelligenceProps> = ({ files }) => {
  const analysis = useMemo(() => {
    const safeFiles = files || [];
    const fileNames = new Set(safeFiles.map(f => f.name));
    const paths = new Set(safeFiles.map(f => f.path));

    const stack: Array<{ name: string; confidence: 'detected' | 'likely' | 'unknown' }> = [];

    if (fileNames.has('nest-cli.json') || paths.has('src/app.module.ts')) {
      stack.push({ name: 'NestJS Backend Framework', confidence: 'detected' });
    }
    if (fileNames.has('next.config.js') || fileNames.has('next.config.mjs') || paths.has('.next')) {
      stack.push({ name: 'Next.js Web Framework', confidence: 'detected' });
    }
    if (fileNames.has('vite.config.ts') || fileNames.has('vite.config.js')) {
      stack.push({ name: 'React SPA (Vite)', confidence: 'detected' });
    } else if (fileNames.has('package.json') && !fileNames.has('nest-cli.json') && !fileNames.has('next.config.js')) {
      stack.push({ name: 'Node.js Application', confidence: 'likely' });
    }
    if (fileNames.has('requirements.txt') || fileNames.has('Pipfile') || fileNames.has('pyproject.toml')) {
      stack.push({ name: 'Python Repository', confidence: 'detected' });
    } else if (safeFiles.some(f => f.name.endsWith('.py'))) {
      stack.push({ name: 'Python Scripts', confidence: 'likely' });
    }
    if (fileNames.has('Cargo.toml')) {
      stack.push({ name: 'Rust Cargo Package', confidence: 'detected' });
    }

    if (stack.length === 0) {
      stack.push({ name: 'Generic Source Repository', confidence: 'unknown' });
    }

    const docs = {
      readme: fileNames.has('README.md') || fileNames.has('readme.md'),
      security: fileNames.has('SECURITY.md') || fileNames.has('security.md'),
      license: fileNames.has('LICENSE') || fileNames.has('license')
    };

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
        backgroundColor: surface.raised,
        borderColor: surface.border,
        borderRadius: '10px',
        mb: 3
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <MemoryIcon sx={{ color: accent.violet, fontSize: 16 }} />
        <Typography variant="body2" sx={{ fontWeight: 800, color: ink.primary, letterSpacing: '-0.01em' }}>
          Workspace Intelligence Dashboard
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {/* Tech Stack Column */}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            DETECTED TECH STACK
          </Typography>
          <Stack spacing={1}>
            {analysis.stack.map((tech, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, backgroundColor: surface.sunken, borderRadius: '6px', border: `1px solid ${surface.border}` }}>
                <Typography variant="body2" sx={{ color: ink.primary, fontSize: '0.72rem', fontWeight: 600 }}>{tech.name}</Typography>
                <Chip
                  label={tech.confidence.toUpperCase()}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    backgroundColor: tech.confidence === 'detected' ? accent.violetMuted : surface.sunken,
                    color: tech.confidence === 'detected' ? accent.violet : ink.muted
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Grid>

        {/* Documentation Coverage Column */}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            DOCUMENTATION COVERAGE
          </Typography>
          <Stack spacing={1}>
            {/* README */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: `1px solid ${surface.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArticleIcon sx={{ fontSize: 13, color: ink.secondary }} />
                <Typography variant="caption" sx={{ color: ink.primary, fontWeight: 600 }}>README.md</Typography>
              </Box>
              {analysis.docs.readme ? (
                <CheckCircleIcon sx={{ color: status.success, fontSize: 14 }} />
              ) : (
                <WarningAmberIcon sx={{ color: status.brass, fontSize: 14 }} />
              )}
            </Box>
            {/* SECURITY */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75, borderBottom: `1px solid ${surface.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArticleIcon sx={{ fontSize: 13, color: ink.secondary }} />
                <Typography variant="caption" sx={{ color: ink.primary, fontWeight: 600 }}>SECURITY.md</Typography>
              </Box>
              {analysis.docs.security ? (
                <CheckCircleIcon sx={{ color: status.success, fontSize: 14 }} />
              ) : (
                <WarningAmberIcon sx={{ color: status.brass, fontSize: 14 }} />
              )}
            </Box>
            {/* LICENSE */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArticleIcon sx={{ fontSize: 13, color: ink.secondary }} />
                <Typography variant="caption" sx={{ color: ink.primary, fontWeight: 600 }}>LICENSE</Typography>
              </Box>
              {analysis.docs.license ? (
                <CheckCircleIcon sx={{ color: status.success, fontSize: 14 }} />
              ) : (
                <WarningAmberIcon sx={{ color: ink.muted, fontSize: 14 }} />
              )}
            </Box>
          </Stack>
        </Grid>

        {/* Workspace Entry Points Column */}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 800, display: 'block', mb: 1, letterSpacing: '0.05em' }}>
            KEY ENTRY POINTS
          </Typography>
          {analysis.entryPoints.length === 0 ? (
            <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic' }}>None auto-detected.</Typography>
          ) : (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              {analysis.entryPoints.map((ep, idx) => (
                <Chip
                  key={idx}
                  label={ep}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontFamily: 'monospace',
                    backgroundColor: accent.violetMuted,
                    borderColor: accent.violetBorder,
                    color: accent.violet,
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

