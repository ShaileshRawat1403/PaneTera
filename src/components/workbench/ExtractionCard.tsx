import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import { surface, ink, accent, status, radius, typography } from '../../theme/cssTokens';

interface BrowserExtraction {
  type: string;
  textContent?: string;
  structuredData?: Record<string, unknown>;
  links?: Array<{ text: string; url: string }>;
  images?: string[];
  imageUrl?: string;
  code?: string;
  language?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
}

interface ExtractionCardProps {
  data: BrowserExtraction;
}

/**
 * Unified extraction card with type-specific rendering.
 * Uses lightweight <pre> and sanitized display-safe views.
 */
export default function ExtractionCard({ data }: ExtractionCardProps) {
  switch (data.type) {
    case 'screenshot':
      return <ScreenshotCard data={data} />;
    case 'text':
      return <TextCard data={data} />;
    case 'structured-data':
      return <StructuredDataCard data={data} />;
    case 'links':
      return <LinksCard data={data} />;
    case 'images':
      return <ImagesCard data={data} />;
    case 'code-block':
      return <CodeBlockCard data={data} />;
    case 'table':
      return <TableCard data={data} />;
    case 'article':
      return <ArticleCard data={data} />;
    case 'outline':
      return <OutlineCard data={data} />;
    case 'metadata':
      return <MetadataCard data={data} />;
    default:
      return <FallbackCard data={data} />;
  }
}

function ScreenshotCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Screenshot
      </Typography>
      {data.imageUrl ? (
        <Box
          component="img"
          src={data.imageUrl}
          alt="Browser screenshot"
          sx={{
            width: '100%',
            borderRadius: `${radius.sm}px`,
            border: `1px solid ${surface.border}`,
          }}
        />
      ) : (
        <Typography variant="body2" sx={{ color: ink.muted }}>
          No image available
        </Typography>
      )}
    </Box>
  );
}

function TextCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Extracted Text
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: ink.primary,
          whiteSpace: 'pre-wrap',
          fontFamily: typography.sans,
          lineHeight: 1.6,
        }}
      >
        {data.textContent || 'No text extracted'}
      </Typography>
    </Box>
  );
}

function StructuredDataCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Structured Data
      </Typography>
      <Box
        component="pre"
        sx={{
          p: 1.5,
          backgroundColor: surface.sunken,
          borderRadius: `${radius.sm}px`,
          fontSize: '12px',
          fontFamily: typography.mono,
          color: ink.secondary,
          overflow: 'auto',
          maxHeight: '300px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(data.structuredData, null, 2)}
      </Box>
    </Box>
  );
}

function LinksCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Links
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {(data.links || []).map((link, i) => (
          <Box
            component="li"
            key={i}
            sx={{
              py: 0.75,
              borderBottom: i < (data.links?.length || 0) - 1 ? `1px solid ${surface.border}` : 'none',
            }}
          >
            <Link
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: accent.violet,
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {link.text}
            </Link>
            <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 0.25 }}>
              {link.url}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ImagesCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Images
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
        }}
      >
        {(data.images || []).map((img, i) => (
          <Box
            key={i}
            component="img"
            src={img}
            alt={`Extracted image ${i + 1}`}
            sx={{
              width: '100%',
              borderRadius: `${radius.sm}px`,
              border: `1px solid ${surface.border}`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function CodeBlockCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ color: ink.primary, fontWeight: 600 }}>
          Code Block
        </Typography>
        {data.language && (
          <Typography
            variant="caption"
            sx={{
              px: 1,
              py: 0.25,
              backgroundColor: accent.violetMuted,
              color: accent.violet,
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: typography.mono,
            }}
          >
            {data.language}
          </Typography>
        )}
      </Box>
      <Box
        component="pre"
        sx={{
          p: 1.5,
          backgroundColor: surface.sunken,
          borderRadius: `${radius.sm}px`,
          fontSize: '12px',
          fontFamily: typography.mono,
          color: ink.primary,
          overflow: 'auto',
          maxHeight: '300px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.5,
        }}
      >
        {data.code || 'No code content'}
      </Box>
    </Box>
  );
}

function TableCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
        overflow: 'auto',
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Table
      </Typography>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        {data.table?.headers && (
          <Box component="thead">
            <Box component="tr">
              {data.table.headers.map((header, i) => (
                <Box
                  component="th"
                  key={i}
                  sx={{
                    p: 1,
                    backgroundColor: surface.sunken,
                    border: `1px solid ${surface.border}`,
                    color: ink.primary,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  {header}
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <Box component="tbody">
          {data.table?.rows.map((row, i) => (
            <Box component="tr" key={i}>
              {row.map((cell, j) => (
                <Box
                  component="td"
                  key={j}
                  sx={{
                    p: 1,
                    border: `1px solid ${surface.border}`,
                    color: ink.secondary,
                  }}
                >
                  {cell}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function ArticleCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Article
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: ink.primary,
          whiteSpace: 'pre-wrap',
          fontFamily: typography.sans,
          lineHeight: 1.6,
        }}
      >
        {data.textContent || 'No article content'}
      </Typography>
    </Box>
  );
}

function OutlineCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Outline
      </Typography>
      <Box
        component="pre"
        sx={{
          p: 1.5,
          backgroundColor: surface.sunken,
          borderRadius: `${radius.sm}px`,
          fontSize: '12px',
          fontFamily: typography.mono,
          color: ink.secondary,
          overflow: 'auto',
          maxHeight: '300px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {data.textContent || 'No outline content'}
      </Box>
    </Box>
  );
}

function MetadataCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Metadata
      </Typography>
      <Box
        component="pre"
        sx={{
          p: 1.5,
          backgroundColor: surface.sunken,
          borderRadius: `${radius.sm}px`,
          fontSize: '12px',
          fontFamily: typography.mono,
          color: ink.secondary,
          overflow: 'auto',
          maxHeight: '300px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(data.structuredData, null, 2)}
      </Box>
    </Box>
  );
}

function FallbackCard({ data }: ExtractionCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.sm}px`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: ink.primary, mb: 1.5, fontWeight: 600 }}>
        Extraction
      </Typography>
      <Box
        component="pre"
        sx={{
          p: 1.5,
          backgroundColor: surface.sunken,
          borderRadius: `${radius.sm}px`,
          fontSize: '12px',
          fontFamily: typography.mono,
          color: ink.secondary,
          overflow: 'auto',
          maxHeight: '300px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </Box>
    </Box>
  );
}
