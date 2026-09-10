// src/components/workbench/BlenderStateCanvas.tsx
//
// Apple Pro Studio Floating 3D Workbench for Blender in PaneTera.
// Features a full-canvas 100% immersive 3D viewport with floating, collapsible
// glassmorphic HUD pods for scene outliner hierarchy and precision transforms.

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Stack,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import VideocamIcon from '@mui/icons-material/Videocam';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PaletteIcon from '@mui/icons-material/Palette';
import TuneIcon from '@mui/icons-material/Tune';
import SearchIcon from '@mui/icons-material/Search';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { surface, ink, accent, status, radius, typography, elevation } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import type { BlenderSourceState, BlenderObjectState } from '../../surfaces/blenderSurface';
import { Blender3DViewport } from './Blender3DViewport';

export interface BlenderStateCanvasProps {
  state: BlenderSourceState;
  onSelectObject?: (objectId: string) => void;
}

export function BlenderStateCanvas({
  state,
  onSelectObject,
}: BlenderStateCanvasProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>(
    state.selectedObjectId || state.objects[0]?.id || '',
  );
  const [isOutlinerOpen, setIsOutlinerOpen] = useState<boolean>(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  const activeObj: BlenderObjectState | undefined = state.objects.find(
    (o) => o.id === (selectedId || state.selectedObjectId),
  ) || state.objects[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectObject?.(id);
  };

  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return state.objects;
    const q = searchQuery.toLowerCase();
    return state.objects.filter(
      (o) => o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q),
    );
  }, [state.objects, searchQuery]);

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'LIGHT': return <LightbulbIcon sx={{ fontSize: 14, color: status.brass }} />;
      case 'CAMERA': return <VideocamIcon sx={{ fontSize: 14, color: accent.violet }} />;
      default: return <ViewInArIcon sx={{ fontSize: 14, color: accent.violet }} />;
    }
  };

  return (
    <Box
      data-testid="blender-state-canvas"
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        backgroundColor: surface.canvas,
        color: ink.primary,
        overflow: 'hidden',
      }}
    >
      {/* ── 1. Full-Canvas 100% Immersive 3D Viewport ─────────────────── */}
      <Box sx={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        <Blender3DViewport
          objects={state.objects}
          selectedObjectId={activeObj?.id}
          onSelectObject={handleSelect}
          viewportSnapshotUrl={state.viewportSnapshotUrl}
          activeEngine={state.runtime.activeEngine}
        />
      </Box>

      {/* ── 2. Top Floating Glassmorphic Studio Control Bar ──────────── */}
      <Box
        sx={{
          position: 'absolute',
          top: 14,
          left: 16,
          right: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Left Status Capsule */}
        <Box
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.75,
            py: 0.75,
            borderRadius: `${radius.pill}px`,
            backgroundColor: surface.overlay,
            border: `1px solid ${surface.border}`,
            boxShadow: elevation.raised,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: status.brass,
                boxShadow: `0 0 8px ${status.brass}`,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', color: ink.primary }}>
              {state.fileName || 'scifi_outpost_mech.blend'}
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.72rem' }}>
            {state.objects.length} objs · {state.runtime.activeEngine || 'CYCLES'}
          </Typography>

          <Chip
            size="small"
            label={`Blender ${state.runtime.blenderVersion || '5.2'}`}
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontFamily: typography.mono,
              fontWeight: 700,
              backgroundColor: accent.violetMuted,
              color: accent.violet,
              border: `1px solid ${accent.violetBorder}`,
            }}
          />
        </Box>

        {/* Right Studio Actions Pill */}
        <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CameraAltOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{
              height: 32,
              borderRadius: `${radius.pill}px`,
              backgroundColor: surface.overlay,
              borderColor: surface.border,
              color: ink.secondary,
              fontSize: '0.75rem',
              textTransform: 'none',
              px: 1.5,
              '&:hover': {
                borderColor: accent.violetBorder,
                color: ink.primary,
                backgroundColor: surface.raised,
              },
            }}
          >
            Capture Viewport
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<FactCheckOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{
              height: 32,
              borderRadius: `${radius.pill}px`,
              backgroundColor: surface.overlay,
              borderColor: surface.border,
              color: ink.secondary,
              fontSize: '0.75rem',
              textTransform: 'none',
              px: 1.5,
              '&:hover': {
                borderColor: accent.violetBorder,
                color: ink.primary,
                backgroundColor: surface.raised,
              },
            }}
          >
            Audit Geometry
          </Button>
        </Stack>
      </Box>

      {/* ── 3. Floating Glassmorphic Outliner Pod (Left) ──────────────── */}
      <Box
        sx={{
          position: 'absolute',
          top: 60,
          bottom: 16,
          left: 16,
          width: isOutlinerOpen ? 280 : 'auto',
          zIndex: 8,
          pointerEvents: 'none',
          transition: transition(['width', 'transform']),
        }}
      >
        {!isOutlinerOpen ? (
          <Tooltip title="Expand Scene Outliner" placement="right">
            <IconButton
              onClick={() => setIsOutlinerOpen(true)}
              sx={{
                pointerEvents: 'auto',
                backgroundColor: surface.overlay,
                border: `1px solid ${surface.border}`,
                color: ink.secondary,
                borderRadius: `${radius.pill}px`,
                p: 1,
                boxShadow: elevation.raised,
                '&:hover': {
                  color: ink.primary,
                  borderColor: accent.violetBorder,
                  transform: 'scale(1.05)',
                },
              }}
            >
              <LayersOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Box
            sx={{
              pointerEvents: 'auto',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: `${radius.lg}px`,
              backgroundColor: surface.overlay,
              border: `1px solid ${surface.border}`,
              boxShadow: elevation.raised,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${surface.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <LayersOutlinedIcon sx={{ fontSize: 16, color: accent.violet }} />
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: ink.primary, fontSize: '0.72rem' }}>
                  Scene Outliner
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setIsOutlinerOpen(false)} sx={{ color: ink.muted, p: 0.5 }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>

            {/* Search */}
            <Box sx={{ p: 1.25, pb: 0.5 }}>
              <TextField
                size="small"
                placeholder="Filter objects…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 14, color: ink.muted }} />
                    </InputAdornment>
                  ),
                  sx: {
                    height: 28,
                    fontSize: '0.75rem',
                    backgroundColor: surface.sunken,
                    borderRadius: `${radius.pill}px`,
                    color: ink.primary,
                    '& fieldset': { borderColor: surface.border },
                    '&:hover fieldset': { borderColor: accent.violetBorder },
                  },
                }}
                fullWidth
              />
            </Box>

            {/* Tree Items */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
              {state.collections.length > 0 && !searchQuery.trim() ? (
                state.collections.map((col) => (
                  <Box key={col.name} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.4, color: ink.muted }}>
                      <FolderIcon sx={{ fontSize: 13, color: ink.muted }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
                        {col.name}
                      </Typography>
                    </Box>

                    <Box sx={{ pl: 1.25 }}>
                      {filteredObjects
                        .filter((o) => col.objectIds.includes(o.id) || col.objectIds.includes(o.name))
                        .map((obj) => {
                          const isSelected = obj.id === activeObj?.id;
                          return (
                            <Box
                              key={obj.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelect(obj.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSelect(obj.id);
                                }
                              }}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 1.2,
                                py: 0.6,
                                mb: 0.4,
                                borderRadius: `${radius.sm}px`,
                                backgroundColor: isSelected ? accent.violetMuted : 'transparent',
                                border: `1px solid ${isSelected ? accent.violetBorder : 'transparent'}`,
                                cursor: 'pointer',
                                transition: transition(['background-color', 'border-color']),
                                '&:hover': {
                                  backgroundColor: isSelected ? accent.violetMuted : surface.raised,
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                {getObjectIcon(obj.type)}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: isSelected ? 700 : 500,
                                    color: isSelected ? accent.violet : ink.primary,
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  {obj.name}
                                </Typography>
                              </Box>
                              {obj.faceCount !== undefined && obj.faceCount > 0 && (
                                <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.65rem', fontFamily: typography.mono }}>
                                  {obj.faceCount}p
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                    </Box>
                  </Box>
                ))
              ) : (
                filteredObjects.map((obj) => {
                  const isSelected = obj.id === activeObj?.id;
                  return (
                    <Box
                      key={obj.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(obj.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(obj.id);
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1.2,
                        py: 0.6,
                        mb: 0.4,
                        borderRadius: `${radius.sm}px`,
                        backgroundColor: isSelected ? accent.violetMuted : 'transparent',
                        border: `1px solid ${isSelected ? accent.violetBorder : 'transparent'}`,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: isSelected ? accent.violetMuted : surface.raised,
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {getObjectIcon(obj.type)}
                        <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? accent.violet : ink.primary, fontSize: '0.78rem' }}>
                          {obj.name}
                        </Typography>
                      </Box>
                      <Chip size="small" label={obj.type} sx={{ height: 16, fontSize: '0.6rem' }} />
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── 4. Floating Glassmorphic Inspector Pod (Right) ────────────── */}
      <Box
        sx={{
          position: 'absolute',
          top: 60,
          bottom: 16,
          right: 16,
          width: isInspectorOpen ? 310 : 'auto',
          zIndex: 8,
          pointerEvents: 'none',
          transition: transition(['width', 'transform']),
        }}
      >
        {!isInspectorOpen ? (
          <Tooltip title="Expand Inspector" placement="left">
            <IconButton
              onClick={() => setIsInspectorOpen(true)}
              sx={{
                pointerEvents: 'auto',
                backgroundColor: surface.overlay,
                border: `1px solid ${surface.border}`,
                color: ink.secondary,
                borderRadius: `${radius.pill}px`,
                p: 1,
                boxShadow: elevation.raised,
                '&:hover': {
                  color: ink.primary,
                  borderColor: accent.violetBorder,
                  transform: 'scale(1.05)',
                },
              }}
            >
              <TuneIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Box
            sx={{
              pointerEvents: 'auto',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: `${radius.lg}px`,
              backgroundColor: surface.overlay,
              border: `1px solid ${surface.border}`,
              boxShadow: elevation.raised,
              overflowY: 'auto',
              p: 1.75,
              gap: 1.5,
            }}
          >
            {activeObj && (
              <>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontSize: '0.92rem', fontWeight: 700, color: ink.primary }}>
                      {activeObj.name}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: typography.mono, color: ink.muted, fontSize: '0.68rem' }}>
                      ID: {activeObj.id}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setIsInspectorOpen(false)} sx={{ color: ink.muted, p: 0.5 }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>

                {/* Transforms */}
                <Box sx={{ backgroundColor: surface.sunken, p: 1.25, borderRadius: `${radius.md}px`, border: `1px solid ${surface.border}` }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: ink.secondary, fontSize: '0.68rem', mb: 1, display: 'block' }}>
                    Transforms
                  </Typography>

                  {/* Location */}
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.65rem', mb: 0.25, display: 'block' }}>Location (meters)</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                      {['X', 'Y', 'Z'].map((axis, i) => (
                        <Box key={`loc-${axis}`} sx={{ display: 'flex', alignItems: 'center', backgroundColor: surface.canvas, px: 0.6, py: 0.3, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
                          <Typography sx={{ color: i === 0 ? '#ef4444' : i === 1 ? '#22c55e' : '#3b82f6', fontWeight: 800, fontSize: '0.65rem', mr: 0.4 }}>{axis}</Typography>
                          <Typography sx={{ fontFamily: typography.mono, fontSize: '0.72rem', color: ink.primary }}>
                            {(activeObj.location[i] ?? 0).toFixed(2)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Rotation */}
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.65rem', mb: 0.25, display: 'block' }}>Rotation</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                      {['X', 'Y', 'Z'].map((axis, i) => (
                        <Box key={`rot-${axis}`} sx={{ display: 'flex', alignItems: 'center', backgroundColor: surface.canvas, px: 0.6, py: 0.3, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
                          <Typography sx={{ color: i === 0 ? '#ef4444' : i === 1 ? '#22c55e' : '#3b82f6', fontWeight: 800, fontSize: '0.65rem', mr: 0.4 }}>{axis}</Typography>
                          <Typography sx={{ fontFamily: typography.mono, fontSize: '0.72rem', color: ink.primary }}>
                            {(activeObj.rotation[i] ?? 0).toFixed(1)}°
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Scale */}
                  <Box>
                    <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.65rem', mb: 0.25, display: 'block' }}>Scale</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                      {['X', 'Y', 'Z'].map((axis, i) => (
                        <Box key={`scale-${axis}`} sx={{ display: 'flex', alignItems: 'center', backgroundColor: surface.canvas, px: 0.6, py: 0.3, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
                          <Typography sx={{ color: i === 0 ? '#ef4444' : i === 1 ? '#22c55e' : '#3b82f6', fontWeight: 800, fontSize: '0.65rem', mr: 0.4 }}>{axis}</Typography>
                          <Typography sx={{ fontFamily: typography.mono, fontSize: '0.72rem', color: ink.primary }}>
                            {(activeObj.scale[i] ?? 1).toFixed(2)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>

                {/* Modifiers */}
                <Box sx={{ backgroundColor: surface.sunken, p: 1.25, borderRadius: `${radius.md}px`, border: `1px solid ${surface.border}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <AutoFixHighIcon sx={{ fontSize: 14, color: accent.violet }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: ink.secondary, fontSize: '0.68rem' }}>
                      Modifier Stack ({activeObj.modifiers.length})
                    </Typography>
                  </Box>

                  {activeObj.modifiers.length === 0 ? (
                    <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic', display: 'block' }}>
                      No active modifiers
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {activeObj.modifiers.map((mod, idx) => (
                        <Box key={`${mod.name}-${idx}`} sx={{ p: 0.75, backgroundColor: surface.canvas, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', color: ink.primary }}>
                              {mod.name}
                            </Typography>
                            <Chip size="small" label={mod.type} sx={{ height: 16, fontSize: '0.6rem', backgroundColor: accent.violetMuted, color: accent.violet }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Shaders */}
                <Box sx={{ backgroundColor: surface.sunken, p: 1.25, borderRadius: `${radius.md}px`, border: `1px solid ${surface.border}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <PaletteIcon sx={{ fontSize: 14, color: status.brass }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: ink.secondary, fontSize: '0.68rem' }}>
                      Materials & Shaders ({activeObj.materials.length})
                    </Typography>
                  </Box>

                  {activeObj.materials.length === 0 ? (
                    <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic', display: 'block' }}>
                      Default material
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {activeObj.materials.map((mat, idx) => (
                        <Box key={`${mat.name}-${idx}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 0.6, backgroundColor: surface.canvas, borderRadius: `${radius.sm}px`, border: `1px solid ${surface.border}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: mat.emission ? accent.violet : ink.muted }} />
                            <Typography variant="body2" sx={{ fontSize: '0.74rem', fontWeight: 600, color: ink.primary }}>
                              {mat.name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: ink.muted, fontFamily: typography.mono }}>
                            {mat.nodeType}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
