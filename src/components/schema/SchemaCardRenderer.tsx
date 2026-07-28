// src/components/schema/SchemaCardRenderer.tsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { PaneTeraCardSchema } from '../../../shared/schemaTypes';
import { schemaCardRegistry } from './SchemaCardRegistry';
import { WidgetMapper } from './WidgetMapper';
import { radius, status, surface, ink } from '../../theme/cssTokens';

interface SchemaCardRendererProps {
  schemaId: string;
  data: Record<string, unknown>;
  inlineSchema?: PaneTeraCardSchema;
  onAction?: (actionId: string, payload: Record<string, unknown>) => void;
}

export const SchemaCardRenderer: React.FC<SchemaCardRendererProps> = ({
  schemaId,
  data,
  inlineSchema,
  onAction,
}) => {
  const [schema, setSchema] = useState<PaneTeraCardSchema | null>(inlineSchema || null);
  const [loading, setLoading] = useState<boolean>(!inlineSchema);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inlineSchema) {
      setSchema(inlineSchema);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    schemaCardRegistry
      .getSchema(schemaId)
      .then((s) => {
        if (!isMounted) return;
        if (!s) {
          setError(`Schema '${schemaId}' could not be loaded.`);
        } else {
          setSchema(s);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error fetching schema');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [schemaId, inlineSchema]);

  if (loading) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: `${radius.md}px`,
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          color: ink.secondary,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <CircularProgress size={16} sx={{ color: ink.secondary }} />
        <Typography variant="caption" sx={{ color: ink.secondary }}>
          Loading schema card framework...
        </Typography>
      </Box>
    );
  }

  if (error || !schema) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: `${radius.md}px`,
          backgroundColor: status.dangerMuted,
          border: `1px solid ${status.danger}`,
          color: status.danger,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {error || `Schema '${schemaId}' unavailable.`}
        </Typography>
      </Box>
    );
  }

  return <WidgetMapper schema={schema} data={data} onAction={onAction} />;
};
