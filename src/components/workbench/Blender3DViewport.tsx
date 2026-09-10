// src/components/workbench/Blender3DViewport.tsx
//
// Interactive Studio-Grade 3D Viewport for Blender in PaneTera.
// Provides hardware-accelerated 3D perspective projection, orbital camera,
// interactive object picking, 3D orientation gizmo, and solid/wireframe rendering.

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import GridOnIcon from '@mui/icons-material/GridOn';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import type { BlenderObjectState } from '../../surfaces/blenderSurface';
import { accent, ink, radius, surface, typography } from '../../theme/cssTokens';

interface Blender3DViewportProps {
  objects: readonly BlenderObjectState[];
  selectedObjectId?: string | null;
  onSelectObject?: (objectId: string) => void;
  viewportSnapshotUrl?: string | null;
  activeEngine?: string;
}

type ShadingMode = 'solid' | 'wireframe' | 'snapshot';

interface Vec3 { x: number; y: number; z: number }

function project3D(
  v: Vec3,
  rotX: number,
  rotY: number,
  panX: number,
  panY: number,
  zoom: number,
  width: number,
  height: number
): { x: number; y: number; z: number; visible: boolean } {
  // Yaw rotation around Z/Y
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = v.x * cosY - v.y * sinY;
  const y1 = v.x * sinY + v.y * cosY;
  const z1 = v.z;

  // Pitch rotation
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;
  const x2 = x1;

  const cameraDist = 8.0;
  const eyeZ = y2 + cameraDist;
  if (eyeZ <= 0.1) return { x: 0, y: 0, z: eyeZ, visible: false };

  const fov = 400 * zoom;
  const projX = (x2 / eyeZ) * fov + width / 2 + panX;
  const projY = (-z2 / eyeZ) * fov + height / 2 + panY;

  return { x: projX, y: projY, z: eyeZ, visible: true };
}

export const Blender3DViewport: React.FC<Blender3DViewportProps> = ({
  objects,
  selectedObjectId,
  onSelectObject,
  viewportSnapshotUrl,
  activeEngine = 'CYCLES',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shading, setShading] = useState<ShadingMode>('solid');
  const [rotX, setRotX] = useState<number>(0.6); // Pitch
  const [rotY, setRotY] = useState<number>(-0.75); // Yaw
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.2);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseMovedDist = useRef<number>(0);

  const resetCamera = useCallback(() => {
    setRotX(0.6);
    setRotY(-0.75);
    setPan({ x: 0, y: 0 });
    setZoom(1.2);
  }, []);

  const snapView = (view: 'top' | 'front' | 'right' | 'iso') => {
    setPan({ x: 0, y: 0 });
    if (view === 'top') { setRotX(1.57); setRotY(0); }
    else if (view === 'front') { setRotX(0); setRotY(0); }
    else if (view === 'right') { setRotX(0); setRotY(-1.57); }
    else { setRotX(0.6); setRotY(-0.75); }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseMovedDist.current = 0;
    setIsInteracting(true);
    if (e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
    } else {
      isDraggingRef.current = true;
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current && !isPanningRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    mouseMovedDist.current += Math.abs(dx) + Math.abs(dy);
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (isPanningRef.current) {
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    } else if (isDraggingRef.current) {
      setRotY((prev) => prev + dx * 0.008);
      setRotX((prev) => Math.max(-1.5, Math.min(1.5, prev + dy * 0.008)));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsInteracting(false);
    isDraggingRef.current = false;
    isPanningRef.current = false;

    // If mouse was clicked without dragging, perform 3D hit test
    if (mouseMovedDist.current < 5 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Find nearest object to click
      let nearestId: string | null = null;
      let minDistance = 35; // 35px hit threshold

      for (const obj of objects) {
        const [ox, oy, oz] = obj.location;
        const proj = project3D({ x: ox, y: oy, z: oz }, rotX, rotY, pan.x, pan.y, zoom, width, height);
        if (proj.visible) {
          const dist = Math.hypot(proj.x - clickX, proj.y - clickY);
          if (dist < minDistance) {
            minDistance = dist;
            nearestId = obj.id;
          }
        }
      }

      if (nearestId && onSelectObject) {
        onSelectObject(nearestId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.max(0.3, Math.min(4.0, prev * factor)));
  };

  // Main 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || shading === 'snapshot') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    // Dark Studio Ambient Background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.8);
    bgGrad.addColorStop(0, '#1a1e27');
    bgGrad.addColorStop(1, '#090b0e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 3D Perspective Ground Grid
    const gridSize = 5;
    const gridStep = 1;
    ctx.strokeStyle = '#222733';
    ctx.lineWidth = 1;

    for (let x = -gridSize; x <= gridSize; x += gridStep) {
      const p1 = project3D({ x, y: -gridSize, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
      const p2 = project3D({ x, y: gridSize, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
      if (p1.visible && p2.visible) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    for (let y = -gridSize; y <= gridSize; y += gridStep) {
      const p1 = project3D({ x: -gridSize, y, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
      const p2 = project3D({ x: gridSize, y, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
      if (p1.visible && p2.visible) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // Origin XYZ Axes
    const origin = project3D({ x: 0, y: 0, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
    const axisX = project3D({ x: 2, y: 0, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
    const axisY = project3D({ x: 0, y: 2, z: 0 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
    const axisZ = project3D({ x: 0, y: 0, z: 2 }, rotX, rotY, pan.x, pan.y, zoom, width, height);

    if (origin.visible) {
      if (axisX.visible) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(axisX.x, axisX.y);
        ctx.stroke();
      }
      if (axisY.visible) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(axisY.x, axisY.y);
        ctx.stroke();
      }
      if (axisZ.visible) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(axisZ.x, axisZ.y);
        ctx.stroke();
      }
    }

    // Render Scene 3D Objects
    for (const obj of objects) {
      const isSelected = obj.id === selectedObjectId || obj.selected;
      const [ox, oy, oz] = obj.location;
      const [sx, sy, sz] = obj.scale;

      if (obj.type === 'MESH') {
        const hx = sx || 1;
        const hy = sy || 1;
        const hz = sz || 1;

        const verts: Vec3[] = [
          { x: ox - hx, y: oy - hy, z: oz - hz },
          { x: ox + hx, y: oy - hy, z: oz - hz },
          { x: ox + hx, y: oy + hy, z: oz - hz },
          { x: ox - hx, y: oy + hy, z: oz - hz },
          { x: ox - hx, y: oy - hy, z: oz + hz },
          { x: ox + hx, y: oy - hy, z: oz + hz },
          { x: ox + hx, y: oy + hy, z: oz + hz },
          { x: ox - hx, y: oy + hy, z: oz + hz },
        ];

        const projVerts = verts.map((v) => project3D(v, rotX, rotY, pan.x, pan.y, zoom, width, height));

        const faces = [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [2, 3, 7, 6],
          [0, 3, 7, 4],
          [1, 2, 6, 5],
        ];

        if (shading === 'solid') {
          for (let fi = 0; fi < faces.length; fi++) {
            const face = faces[fi];
            const pv = face.map((idx) => projVerts[idx]);
            if (pv.every((p) => p.visible)) {
              ctx.beginPath();
              ctx.moveTo(pv[0].x, pv[0].y);
              for (let i = 1; i < pv.length; i++) ctx.lineTo(pv[i].x, pv[i].y);
              ctx.closePath();

              ctx.fillStyle = isSelected
                ? 'rgba(56, 189, 248, 0.4)'
                : `rgba(100, 116, 139, ${0.28 + (fi % 3) * 0.15})`;
              ctx.fill();
              ctx.strokeStyle = isSelected ? '#00e5ff' : '#94a3b8';
              ctx.lineWidth = isSelected ? 2 : 1;
              ctx.stroke();
            }
          }
        } else {
          // Wireframe
          ctx.strokeStyle = isSelected ? '#00e5ff' : '#64748b';
          ctx.lineWidth = isSelected ? 2 : 1;
          const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7],
          ];
          for (const [a, b] of edges) {
            const pa = projVerts[a];
            const pb = projVerts[b];
            if (pa.visible && pb.visible) {
              ctx.beginPath();
              ctx.moveTo(pa.x, pa.y);
              ctx.lineTo(pb.x, pb.y);
              ctx.stroke();
            }
          }
        }

        // Object Name Label
        const centerProj = project3D({ x: ox, y: oy, z: oz + hz + 0.35 }, rotX, rotY, pan.x, pan.y, zoom, width, height);
        if (centerProj.visible) {
          ctx.font = `600 11px ${typography.mono}`;
          ctx.fillStyle = isSelected ? '#00e5ff' : '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText(obj.name, centerProj.x, centerProj.y);
        }
      } else if (obj.type === 'LIGHT') {
        const lp = project3D({ x: ox, y: oy, z: oz }, rotX, rotY, pan.x, pan.y, zoom, width, height);
        if (lp.visible) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, isSelected ? 8 : 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#00e5ff' : '#f59e0b';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.font = `500 10px ${typography.mono}`;
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'center';
          ctx.fillText(obj.name, lp.x, lp.y - 10);
        }
      } else if (obj.type === 'CAMERA') {
        const cp = project3D({ x: ox, y: oy, z: oz }, rotX, rotY, pan.x, pan.y, zoom, width, height);
        if (cp.visible) {
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, isSelected ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#00e5ff' : '#9333ea';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = `500 10px ${typography.mono}`;
          ctx.fillStyle = '#c084fc';
          ctx.textAlign = 'center';
          ctx.fillText(obj.name, cp.x, cp.y - 8);
        }
      }
    }

    // Draw Top-Right Mini Orientation Gizmo
    const gizmoX = width - 42;
    const gizmoY = 42;
    const gizmoLen = 22;

    const gOrigin = { x: gizmoX, y: gizmoY };
    const gX = { x: gizmoX + Math.cos(rotY) * gizmoLen, y: gizmoY - Math.sin(rotX) * Math.sin(rotY) * gizmoLen };
    const gY = { x: gizmoX - Math.sin(rotY) * gizmoLen, y: gizmoY - Math.sin(rotX) * Math.cos(rotY) * gizmoLen };
    const gZ = { x: gizmoX, y: gizmoY - Math.cos(rotX) * gizmoLen };

    // Gizmo Background Disc
    ctx.fillStyle = 'rgba(17, 20, 26, 0.85)';
    ctx.beginPath();
    ctx.arc(gizmoX, gizmoY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#272c36';
    ctx.lineWidth = 1;
    ctx.stroke();

    // X Vector (Red)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gOrigin.x, gOrigin.y);
    ctx.lineTo(gX.x, gX.y);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(gX.x, gX.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Y Vector (Green)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gOrigin.x, gOrigin.y);
    ctx.lineTo(gY.x, gY.y);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(gY.x, gY.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Z Vector (Blue)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gOrigin.x, gOrigin.y);
    ctx.lineTo(gZ.x, gZ.y);
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(gZ.x, gZ.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [objects, selectedObjectId, shading, rotX, rotY, pan, zoom]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 340,
        backgroundColor: '#0c0e12',
        borderRadius: `${radius.md}px`,
        overflow: 'hidden',
        border: `1px solid ${surface.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Floating Viewport Toolbar */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 12,
          right: 80,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pointerEvents: 'auto' }}>
          <ToggleButtonGroup
            size="small"
            value={shading}
            exclusive
            onChange={(_, val) => val && setShading(val)}
            sx={{
              backgroundColor: '#11141a',
              border: `1px solid ${surface.border}`,
              borderRadius: `${radius.sm}px`,
              '& .MuiToggleButton-root': {
                color: ink.secondary,
                py: 0.3,
                px: 1,
                fontSize: '0.72rem',
                fontFamily: typography.mono,
                fontWeight: 600,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: accent.violet,
                  backgroundColor: 'rgba(0, 229, 255, 0.12)',
                },
              },
            }}
          >
            <ToggleButton value="solid">
              <ViewInArIcon sx={{ fontSize: 14, mr: 0.5 }} /> Solid 3D
            </ToggleButton>
            <ToggleButton value="wireframe">
              <GridOnIcon sx={{ fontSize: 14, mr: 0.5 }} /> Wireframe
            </ToggleButton>
            {viewportSnapshotUrl && (
              <ToggleButton value="snapshot">
                <CameraAltIcon sx={{ fontSize: 14, mr: 0.5 }} /> Render
              </ToggleButton>
            )}
          </ToggleButtonGroup>

          <Typography
            variant="caption"
            sx={{
              backgroundColor: '#11141a',
              px: 1,
              py: 0.4,
              borderRadius: `${radius.sm}px`,
              color: ink.muted,
              fontFamily: typography.mono,
              fontSize: '0.7rem',
              border: `1px solid ${surface.border}`,
            }}
          >
            {activeEngine}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, pointerEvents: 'auto' }}>
          <Tooltip title="Snap to Isometric View">
            <IconButton
              size="small"
              onClick={() => snapView('iso')}
              sx={{
                backgroundColor: '#11141a',
                color: ink.secondary,
                border: `1px solid ${surface.border}`,
                '&:hover': { color: accent.violet, backgroundColor: surface.raisedHover },
              }}
            >
              <MyLocationIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Viewport Camera">
            <IconButton
              size="small"
              onClick={resetCamera}
              sx={{
                backgroundColor: '#11141a',
                color: ink.secondary,
                border: `1px solid ${surface.border}`,
                '&:hover': { color: accent.violet, backgroundColor: surface.raisedHover },
              }}
            >
              <RestartAltIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main 3D Canvas */}
      {shading === 'snapshot' && viewportSnapshotUrl ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <img
            src={viewportSnapshotUrl}
            alt="Blender Viewport Render"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: radius.sm }}
          />
        </Box>
      ) : (
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            cursor: isInteracting ? 'grabbing' : 'grab',
          }}
        />
      )}

      {/* Bottom Hint Banner */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 12,
          display: 'flex',
          gap: 1.5,
          pointerEvents: 'none',
        }}
      >
        <Typography variant="caption" sx={{ color: ink.muted, fontSize: '0.68rem', fontFamily: typography.mono }}>
          <strong style={{ color: ink.secondary }}>Click object</strong>: Select · <strong style={{ color: ink.secondary }}>Drag</strong>: Orbit · <strong style={{ color: ink.secondary }}>Right-Drag</strong>: Pan · <strong style={{ color: ink.secondary }}>Scroll</strong>: Zoom
        </Typography>
      </Box>
    </Box>
  );
};
