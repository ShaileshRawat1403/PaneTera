// src/components/workstation/NativePickerModal.tsx
// Explicit Native File and Folder Chooser Modal.
//
// Distinct from project selection, this modal presents explicit file/folder
// grant creation with short-lived (15-minute) tokens, SHA-256 hash previews, and
// least authority enforcement per PANETERA_WORKSTATION_CONTRACT.md.

import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import SecurityIcon from '@mui/icons-material/Security';
import TimerIcon from '@mui/icons-material/Timer';
import { accent, elevation, ink, radius, surface, typography } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';

export interface NativeGrantResult {
  token: string;
  type: 'file' | 'folder';
  targetPath: string;
  name: string;
  sha256: string;
  sizeBytes: number;
  expiresAt: number;
}

interface NativePickerModalProps {
  open: boolean;
  type: 'file' | 'folder';
  token?: string;
  onClose: () => void;
  onGrantCreated: (grant: NativeGrantResult) => void;
}

export function NativePickerModal({
  open,
  type,
  token,
  onClose,
  onGrantCreated,
}: NativePickerModalProps): React.ReactElement {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFile = type === 'file';

  const handleCreateGrant = async () => {
    if (!targetPath.trim()) {
      setError('Please enter a target path');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const endpoint = isFile ? '/api/native-grants/file' : '/api/native-grants/folder';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetPath: targetPath.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create native grant');
      }

      onGrantCreated(data.grant);
      setTargetPath('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error granting access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      disablePortal={typeof process !== 'undefined' && process.env.NODE_ENV === 'test'}
      onClose={onClose}
      aria-labelledby="native-picker-title"
      aria-describedby="native-picker-description"
      PaperProps={{
        sx: {
          width: 'min(520px, 94vw)',
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.md}px`,
          boxShadow: elevation.overlay,
          color: ink.primary,
          p: 1,
        },
      }}
    >
      <DialogTitle id="native-picker-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        {isFile ? (
          <InsertDriveFileIcon sx={{ color: accent.violet, fontSize: 22 }} />
        ) : (
          <FolderIcon sx={{ color: accent.violet, fontSize: 22 }} />
        )}
        <Typography variant="h6" component="span" sx={{ fontWeight: 650, color: ink.primary }}>
          {isFile ? 'Grant Explicit File Access' : 'Grant Explicit Folder Access'}
        </Typography>
      </DialogTitle>

      <DialogContent id="native-picker-description">
        <Typography variant="body2" sx={{ color: ink.secondary, mb: 2, lineHeight: 1.6 }}>
          Select a specific local filesystem {type}. PaneTera will create a short-lived (15-minute),
          expiring grant. Only metadata digests (SHA-256) are retained in Headroom.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
          <Chip
            icon={<TimerIcon sx={{ fontSize: 14 }} />}
            label="15m Expiration"
            size="small"
            sx={{
              backgroundColor: surface.sunken,
              border: `1px solid ${surface.border}`,
              color: ink.secondary,
              fontSize: '0.75rem',
            }}
          />
          <Chip
            icon={<SecurityIcon sx={{ fontSize: 14 }} />}
            label="Revocable Grant"
            size="small"
            sx={{
              backgroundColor: surface.sunken,
              border: `1px solid ${surface.border}`,
              color: ink.secondary,
              fontSize: '0.75rem',
            }}
          />
        </Stack>

        <TextField
          fullWidth
          size="small"
          label={isFile ? 'Absolute file path' : 'Absolute folder path'}
          placeholder={isFile ? '/Users/.../project/src/index.ts' : '/Users/.../project/src'}
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
          error={Boolean(error)}
          helperText={error}
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: surface.sunken,
              borderRadius: `${radius.sm}px`,
              fontFamily: typography.mono,
              fontSize: '0.8125rem',
              '& fieldset': { borderColor: surface.border },
              '&:hover fieldset': { borderColor: surface.borderStrong },
              '&.Mui-focused fieldset': { borderColor: accent.violetBorder },
            },
            '& .MuiInputLabel-root': { color: ink.secondary },
          }}
        />
      </DialogContent>

      <Divider sx={{ borderColor: surface.border, my: 1 }} />

      <DialogActions sx={{ px: 3, pb: 1.5 }}>
        <Button onClick={onClose} sx={{ color: ink.secondary, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          disabled={loading || !targetPath.trim()}
          onClick={handleCreateGrant}
          sx={{
            color: ink.onAccent,
            backgroundColor: accent.violet,
            borderRadius: `${radius.sm}px`,
            px: 2.5,
            py: 0.75,
            fontWeight: 650,
            textTransform: 'none',
            transition: transition(['background-color', 'opacity']),
            '&:hover': { backgroundColor: accent.violetHover },
            '&.Mui-disabled': { backgroundColor: accent.violetMuted, color: ink.disabled },
          }}
        >
          {loading ? 'Creating Grant…' : 'Grant Access'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
