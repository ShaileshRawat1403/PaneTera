import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { surface, ink, accent, status, radius, elevation } from '../../theme/cssTokens';
import { transition } from '../../theme/motion';
import { BrowserEvidenceSurface } from './BrowserEvidenceSurface';
import type { BrowserEvidenceRecord } from './browserEvidenceSurfaceModel';

interface BrowserEvidenceCanvasProps {
  records?: BrowserEvidenceRecord[];
  onReturnToPreview: () => void;
}

interface ExtractionSummary {
  extractionId: string;
  parentCaptureId?: string;
  type: string;
  capturedAt: string;
  truncated?: boolean;
  title?: string;
  url?: string;
}

function getIconForType(type: string): string {
  switch (type) {
    case 'screenshot':
      return '📸';
    case 'text':
      return '📝';
    case 'structured-data':
      return '📊';
    case 'links':
      return '🔗';
    case 'images':
      return '🖼️';
    default:
      return '📄';
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

function extractHostname(url?: string): string {
  if (!url) return 'Unknown';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Split-pane evidence canvas: left panel shows extraction list, right panel shows detail.
 * Fetches extractions from the MCP server via browser_list_extractions tool.
 */
export function BrowserEvidenceCanvas({ records, onReturnToPreview }: BrowserEvidenceCanvasProps) {
  const [extractions, setExtractions] = useState<ExtractionSummary[]>(() => {
    if (records && records.length > 0) {
      return records.map((r) => ({
        extractionId: r.extractionId || r.captureId || 'ext',
        parentCaptureId: r.captureId,
        type: r.capability || 'text',
        capturedAt: r.source?.capturedAt || new Date().toISOString(),
        title: r.source?.title || r.title,
        url: r.source?.url || r.url,
      }));
    }
    return [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (records && records.length > 0) {
      return records[0].extractionId || records[0].captureId || null;
    }
    return null;
  });
  const [loading, setLoading] = useState(!records);
  const [error, setError] = useState<string | null>(null);

  // Fetch extractions on mount and auto-refresh every 10 seconds
  useEffect(() => {
    if (records && records.length > 0) return;
    const fetchExtractions = async () => {
      try {
        setLoading(true);
        const resp = await fetch('/api/evidence');
        if (resp.ok) {
          const data = await resp.json();
          const items: ExtractionSummary[] = [
            ...(data.extractions || []).map((e: any) => ({
              extractionId: e.extractionId || e.parentCaptureId || 'ext',
              parentCaptureId: e.parentCaptureId,
              type: e.capability || e.type || 'text',
              capturedAt: e.source?.capturedAt || new Date().toISOString(),
              title: e.source?.title || e.title || 'Extraction',
              url: e.source?.url || e.url,
            })),
            ...(data.observations || []).map((o: any) => ({
              extractionId: o.captureId || 'obs',
              parentCaptureId: o.captureId,
              type: 'observation',
              capturedAt: o.capturedAt || new Date().toISOString(),
              title: o.title || 'Observation',
              url: o.url,
            })),
          ];
          if (items.length > 0) setExtractions(items);
          setError(null);
        }
      } catch {
        setError('Failed to load evidence');
      } finally {
        setLoading(false);
      }
    };

    void fetchExtractions();
    const interval = setInterval(fetchExtractions, 10_000);
    return () => clearInterval(interval);
  }, [records]);

  const selectedExtraction = useMemo(() => {
    if (!selectedId) return null;
    return extractions.find((e) => e.extractionId === selectedId || e.parentCaptureId === selectedId);
  }, [extractions, selectedId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (extractions.length === 0) return;

      const currentIndex = extractions.findIndex(
        (e) => e.extractionId === selectedId || e.parentCaptureId === selectedId
      );

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = Math.max(0, currentIndex - 1);
        const newExtraction = extractions[newIndex];
        setSelectedId(newExtraction.extractionId || newExtraction.parentCaptureId || null);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = Math.min(extractions.length - 1, currentIndex + 1);
        const newExtraction = extractions[newIndex];
        setSelectedId(newExtraction.extractionId || newExtraction.parentCaptureId || null);
      } else if (e.key === 'Escape') {
        onReturnToPreview();
      }
    },
    [extractions, selectedId, onReturnToPreview]
  );

  // Convert ExtractionSummary to BrowserEvidenceRecord for the detail view
  const selectedRecord: BrowserEvidenceRecord | null = useMemo(() => {
    if (records && records.length > 0 && selectedId) {
      const match = records.find((r) => r.extractionId === selectedId || r.captureId === selectedId);
      if (match) return match;
    }
    if (!selectedExtraction) return null;
    return {
      captureId: selectedExtraction.parentCaptureId,
      extractionId: selectedExtraction.extractionId,
      title: selectedExtraction.title,
      url: selectedExtraction.url,
      capturedAt: selectedExtraction.capturedAt,
      truncated: selectedExtraction.truncated,
    };
  }, [selectedExtraction, records, selectedId]);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        backgroundColor: surface.canvas,
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Left Panel: Extraction List */}
      <Box
        sx={{
          width: 300,
          flexShrink: 0,
          borderRight: `1px solid ${surface.border}`,
          overflowY: 'auto',
          backgroundColor: surface.raised,
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }}>
              Evidence History
            </Typography>
            <Typography variant="caption" sx={{ color: ink.muted }}>
              {extractions.length} capture{extractions.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ color: accent.violet }} />
            </Box>
          )}

          {error && (
            <Box
              sx={{
                p: 2,
                backgroundColor: status.dangerMuted,
                border: `1px solid ${status.danger}`,
                borderRadius: `${radius.sm}px`,
              }}
            >
              <Typography variant="caption" sx={{ color: status.danger }}>
                {error}
              </Typography>
            </Box>
          )}

          {!loading && !error && extractions.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: ink.muted }}>
                No extractions yet
              </Typography>
              <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 1 }}>
                Use the browser operator to capture evidence
              </Typography>
            </Box>
          )}

          {!loading && !error && extractions.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {extractions.map((extraction) => {
                const id = extraction.extractionId || extraction.parentCaptureId || '';
                const isSelected = selectedId === id;

                return (
                  <Box
                    key={id}
                    onClick={() => setSelectedId(id)}
                    sx={{
                      p: 1.5,
                      backgroundColor: isSelected ? accent.violetMuted : surface.base,
                      border: `1px solid ${isSelected ? accent.violetBorder : surface.border}`,
                      borderRadius: `${radius.sm}px`,
                      cursor: 'pointer',
                      transition: transition(['background-color', 'border-color']),
                      '&:hover': {
                        backgroundColor: isSelected ? accent.violetHover : surface.raisedHover,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '16px' }}>{getIconForType(extraction.type)}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: ink.primary,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {extractHostname(extraction.url)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: ink.muted,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {extraction.title || extraction.type}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 0.5, fontSize: '10px' }}>
                      {formatDate(extraction.capturedAt)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Panel: Detail View */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {selectedRecord ? (
          <BrowserEvidenceSurface record={selectedRecord} onReturnToPreview={onReturnToPreview} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: ink.muted }}>
                Select an extraction to view
              </Typography>
              <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 1 }}>
                Use arrow keys to navigate, Enter to select
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
