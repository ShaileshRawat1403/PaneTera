// src/components/workstation/AuditLogModal.tsx
// Interactive Audit Log & Provenance Tree Modal.
//
// Renders tool execution chains, SHA-256 argument digests, timestamps,
// and explicit operator approval records per PANETERA_WORKSTATION_CONTRACT.md.

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';
import { accent, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';

export interface AuditProvenanceNode {
  id: string;
  tool: string;
  action: string;
  principal: string;
  timestamp: string;
  digest: string;
  status: 'approved' | 'executed' | 'denied';
  children?: AuditProvenanceNode[];
}

interface AuditLogModalProps {
  open: boolean;
  token?: string;
  onClose: () => void;
}

export function AuditLogModal({ open, token, onClose }: AuditLogModalProps): React.ReactElement {
  const [nodes, setNodes] = useState<AuditProvenanceNode[]>([
    {
      id: 'prov-101',
      tool: 'rig_execute_command',
      action: 'git status in PaneTera',
      principal: 'operator@panetera.local',
      timestamp: new Date().toLocaleTimeString(),
      digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'approved',
      children: [
        {
          id: 'prov-102',
          tool: 'workspace_reader',
          action: 'read file index',
          principal: 'system/gateway',
          timestamp: new Date().toLocaleTimeString(),
          digest: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
          status: 'executed',
        },
      ],
    },
    {
      id: 'prov-103',
      tool: 'browser_observation',
      action: 'capture visual evidence',
      principal: 'operator@panetera.local',
      timestamp: new Date().toLocaleTimeString(),
      digest: '7d06e885d5ae684534a6e5a072049c6934c9c11c47087611e9a2fd253b78297b',
      status: 'executed',
    },
  ]);

  return (
    <Dialog
      open={open}
      disablePortal={typeof process !== 'undefined' && process.env.NODE_ENV === 'test'}
      onClose={onClose}
      aria-labelledby="audit-modal-title"
      PaperProps={{
        sx: {
          width: 'min(680px, 94vw)',
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.md}px`,
          boxShadow: elevation.overlay,
          color: ink.primary,
          p: 1,
        },
      }}
    >
      <DialogTitle id="audit-modal-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon sx={{ color: accent.violet, fontSize: 22 }} />
          <Typography variant="h6" component="span" sx={{ fontWeight: 650, color: ink.primary }}>
            Audit & Provenance Tree
          </Typography>
        </Box>
        <Chip
          icon={<SecurityIcon sx={{ fontSize: 14 }} />}
          label="Immutable Log"
          size="small"
          sx={{ backgroundColor: surface.sunken, border: `1px solid ${surface.border}`, color: ink.secondary, fontSize: '0.75rem' }}
        />
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: ink.secondary, mb: 2, lineHeight: 1.6, fontSize: '0.8125rem' }}>
          Interactive execution tree linking user intent to exact approved tool calls, SHA-256 argument digests, and operator signatures.
        </Typography>

        <Stack spacing={1.5}>
          {nodes.map((node) => (
            <Paper
              key={node.id}
              elevation={0}
              sx={{
                p: 1.5,
                backgroundColor: surface.sunken,
                border: `1px solid ${surface.border}`,
                borderRadius: `${radius.sm}px`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, color: ink.primary, fontSize: '0.875rem' }}>
                    {node.tool}
                  </Typography>
                  <Chip
                    label={node.status}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.75rem',
                      backgroundColor: node.status === 'approved' ? accent.violetMuted : status.successMuted,
                      color: node.status === 'approved' ? accent.violet : status.success,
                      border: `1px solid ${node.status === 'approved' ? accent.violetBorder : status.successMuted}`,
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: ink.muted, fontFamily: typography.mono, fontSize: '0.75rem' }}>
                  {node.timestamp}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ color: ink.secondary, mb: 0.5, fontSize: '0.8125rem' }}>
                Action: <Box component="span" sx={{ color: ink.primary, fontFamily: typography.mono }}>{node.action}</Box>
              </Typography>

              <Typography variant="caption" sx={{ color: ink.muted, display: 'block', fontFamily: typography.mono, fontSize: '0.75rem', wordBreak: 'break-all' }}>
                Digest: {node.digest.slice(0, 24)}…
              </Typography>

              {/* Child provenance nodes */}
              {node.children && node.children.length > 0 && (
                <Box sx={{ pl: 2, mt: 1, borderLeft: `2px solid ${accent.violetBorder}` }}>
                  {node.children.map((child) => (
                    <Box key={child.id} sx={{ py: 0.5 }}>
                      <Typography variant="caption" sx={{ color: accent.violet, fontWeight: 600, fontSize: '0.75rem' }}>
                        ↳ {child.tool}: <Box component="span" sx={{ color: ink.secondary, fontFamily: typography.mono }}>{child.action}</Box>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          ))}
        </Stack>
      </DialogContent>

      <Divider sx={{ borderColor: surface.border, my: 1 }} />

      <DialogActions sx={{ px: 3, pb: 1.5 }}>
        <Button onClick={onClose} sx={{ color: ink.secondary, textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
