// src/components/workstation/CanvasStart.tsx
//
// Apple Pro Studio Bento Canvas for PaneTera.
// Features 3D perspective tilt parallax, dynamic cursor spotlight shaders,
// illuminated 3D icon pods, domain-accented studio chips, and atmospheric depth.

import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import CodeIcon from '@mui/icons-material/Code';
import { accent, elevation, ink, radius, status, surface, typography } from '../../theme/cssTokens';
import { duration, easing, enterStyles, prefersReducedMotion, transition } from '../../theme/motion';

export interface CanvasStartProps {
  onChooseProject: () => void;
  onConnectCapability: () => void;
  /** Move focus into the composer. Inserts and submits nothing. */
  onDescribeGoal: () => void;
  onOpenBlender?: () => void;
  onOpenReaper?: () => void;
  onOpenAst?: () => void;
}

const focusRing = {
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${surface.canvas}, 0 0 0 4px ${accent.violet}`,
    borderColor: accent.violetBorder,
  },
} as const;

interface BentoChip {
  label: string;
  icon: React.ReactNode;
  accentColor?: string;
  accentBg?: string;
  accentBorder?: string;
  onClick?: () => void;
}

interface BentoStartTileProps {
  title: string;
  detail: string;
  icon: React.ReactNode;
  hint?: string;
  chips?: BentoChip[];
  actionLabel: string;
  dataVariant: 'primary' | 'secondary' | 'describe-goal';
  isHero?: boolean;
  onClick: () => void;
}

function BentoStartTile({
  title,
  detail,
  icon,
  hint,
  chips,
  actionLabel,
  dataVariant,
  isHero = false,
  onClick,
}: BentoStartTileProps) {
  const isPrimary = dataVariant === 'primary';
  const reduced = prefersReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Nuanced Apple-style micro tilt: max 2.2 degrees
    const rotateX = ((y - centerY) / centerY) * -2.2;
    const rotateY = ((x - centerX) / centerX) * 2.2;

    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
    e.currentTarget.style.setProperty('--rot-x', `${rotateX.toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--rot-y', `${rotateY.toFixed(2)}deg`);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced) return;
    e.currentTarget.style.setProperty('--rot-x', '0deg');
    e.currentTarget.style.setProperty('--rot-y', '0deg');
  };

  return (
    <Button
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-variant={dataVariant}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        textAlign: 'left',
        textTransform: 'none',
        overflow: 'hidden',
        perspective: '1000px',
        transform: reduced
          ? 'none'
          : 'perspective(1000px) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg)) translateY(0px)',
        p: { xs: 2.75, md: isHero ? 3.5 : 3 },
        borderRadius: `${radius.md + 6}px`,
        border: `1px solid ${isPrimary ? accent.violetBorder : surface.border}`,
        backgroundColor: surface.raised,
        boxShadow: isPrimary
          ? `0 8px 30px rgba(var(--panetera-glass-violet-rgb), 0.12), ${elevation.card}`
          : elevation.card,
        transition: transition(
          ['background-color', 'border-color', 'box-shadow', 'transform'],
          duration.settled,
          easing.enter
        ),
        cursor: 'pointer',
        gridColumn: isHero ? { xs: '1 / -1', md: 'span 2' } : 'auto',

        // ── Spotlight Cursor Follower ────────────────────────────────
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          opacity: 0,
          transition: transition(['opacity'], duration.quick),
          background:
            'radial-gradient(380px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(var(--panetera-glass-violet-rgb), 0.12), transparent 75%)',
        },

        // ── Top Highlight Shimmer Edge ───────────────────────────────
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '1px',
          background: isPrimary
            ? `linear-gradient(90deg, transparent, ${accent.violet}, transparent)`
            : 'linear-gradient(90deg, transparent, rgba(var(--panetera-glass-border-rgb), 0.6), transparent)',
          opacity: isPrimary ? 0.9 : 0.4,
          transition: transition(['opacity']),
        },

        '&:hover': {
          backgroundColor: isPrimary ? accent.violetMuted : surface.raisedHover,
          borderColor: isPrimary ? accent.violet : surface.borderStrong,
          boxShadow: isPrimary
            ? `0 16px 40px rgba(var(--panetera-glass-violet-rgb), 0.2), ${elevation.cardHover}`
            : elevation.cardHover,
          transform: reduced
            ? 'none'
            : 'perspective(1000px) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg)) translateY(-3px) scale(1.008)',
          '&::after': {
            opacity: 1,
          },
          '&::before': {
            opacity: 1,
            background: `linear-gradient(90deg, transparent, ${accent.violet}, transparent)`,
          },
          '& .bento-arrow': {
            transform: 'translateX(4px)',
            color: accent.violet,
          },
          '& .bento-icon-box': {
            borderColor: accent.violetBorder,
            backgroundColor: accent.violetMuted,
            color: accent.violet,
            transform: 'scale(1.08)',
          },
        },
        '&:active': {
          transform: 'scale(0.985) translateY(0px)',
          transition: transition(['transform'], duration.instant),
        },
        ...focusRing,
      }}
    >
      {/* ── Card Body & Header ──────────────────────────────────────── */}
      <Box sx={{ width: '100%', mb: 1.75, position: 'relative', zIndex: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.75}>
            <Box
              className="bento-icon-box"
              sx={{
                width: isHero ? 46 : 38,
                height: isHero ? 46 : 38,
                borderRadius: `${radius.md}px`,
                backgroundColor: surface.sunken,
                border: `1px solid ${isPrimary ? accent.violetBorder : surface.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPrimary ? accent.violet : ink.secondary,
                boxShadow: isPrimary
                  ? '0 0 14px rgba(var(--panetera-glass-violet-rgb), 0.25)'
                  : 'none',
                transition: transition(['background-color', 'border-color', 'color', 'transform']),
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  color: ink.primary,
                  fontWeight: 700,
                  fontSize: { xs: '1rem', md: isHero ? '1.1875rem' : '1.0625rem' },
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </Typography>
              {isHero && (
                <Typography
                  variant="caption"
                  sx={{
                    color: accent.violet,
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Primary Workstation Hub
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Keyboard Shortcut Pill */}
          {hint && (
            <Typography
              component="span"
              variant="caption"
              sx={{
                px: 1,
                py: 0.3,
                borderRadius: `${radius.sm}px`,
                border: `1px solid ${surface.border}`,
                backgroundColor: surface.sunken,
                color: ink.secondary,
                fontFamily: typography.mono,
                fontSize: '0.75rem',
                fontWeight: 650,
              }}
            >
              {hint}
            </Typography>
          )}
        </Stack>

        <Typography
          variant="body2"
          sx={{
            color: ink.secondary,
            lineHeight: 1.6,
            fontSize: isHero ? '0.9375rem' : '0.875rem',
            maxWidth: isHero ? '62ch' : '100%',
          }}
        >
          {detail}
        </Typography>
      </Box>

      {/* ── Studio Capability Micro-Chips ───────────────────────────── */}
      {chips && chips.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2, flexWrap: 'wrap', gap: 0.75, position: 'relative', zIndex: 1 }}
        >
          {chips.map((chip, idx) => (
            <Box
              key={idx}
              component="span"
              role={chip.onClick ? 'button' : undefined}
              tabIndex={chip.onClick ? 0 : undefined}
              aria-label={chip.onClick ? `Open ${chip.label} workbench` : undefined}
              onClick={(e) => {
                if (chip.onClick) {
                  e.stopPropagation();
                  chip.onClick();
                }
              }}
              onKeyDown={(e) => {
                if (chip.onClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  e.stopPropagation();
                  chip.onClick();
                }
              }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.15,
                py: 0.4,
                borderRadius: `${radius.pill}px`,
                backgroundColor: chip.accentBg || surface.sunken,
                border: `1px solid ${chip.accentBorder || surface.border}`,
                color: chip.accentColor || ink.secondary,
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                cursor: chip.onClick ? 'pointer' : 'default',
                transition: transition(['border-color', 'color', 'background-color', 'transform', 'box-shadow']),
                '&:hover': {
                  borderColor: chip.accentBorder || accent.violetBorder,
                  color: ink.primary,
                  transform: chip.onClick ? 'scale(1.05) translateY(-1px)' : 'none',
                  boxShadow: chip.onClick
                    ? `0 2px 8px rgba(var(--panetera-glass-raised-rgb), 0.08), ${elevation.raised}`
                    : 'none',
                },
                '&:active': {
                  transform: chip.onClick ? 'scale(0.96)' : 'none',
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: chip.accentColor || ink.muted,
                  fontSize: 13,
                }}
              >
                {chip.icon}
              </Box>
              <span>{chip.label}</span>
            </Box>
          ))}
        </Stack>
      )}

      {/* ── Action Strip with Animated Drift Arrow ─────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          width: '100%',
          pt: 1.5,
          borderTop: `1px solid ${surface.border}`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: isPrimary ? accent.violet : ink.muted,
            fontWeight: 700,
            fontSize: '0.8125rem',
            letterSpacing: '0.02em',
          }}
        >
          {actionLabel}
        </Typography>
        <ArrowForwardIcon
          className="bento-arrow"
          sx={{
            fontSize: 16,
            color: isPrimary ? accent.violet : ink.muted,
            transition: transition(['transform', 'color']),
          }}
        />
      </Stack>
    </Button>
  );
}

export function CanvasStart({
  onChooseProject,
  onConnectCapability,
  onDescribeGoal,
  onOpenBlender,
  onOpenReaper,
  onOpenAst,
}: CanvasStartProps): React.ReactElement {
  return (
    <Box
      sx={{
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexGrow: 1,
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: surface.canvas,
        pt: { xs: 4, md: 6 },
        pb: { xs: 6, md: 10 },
        px: { xs: 2.5, md: 5 },
      }}
    >
      {/* ── Atmospheric Radial Aura ──────────────────────────────────── */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          maxWidth: 900,
          height: 380,
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(var(--panetera-glass-violet-rgb), 0.08), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Pane-Seam Architecture Grid Lines with Crossing Dots ─────── */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '8%',
            bottom: '8%',
            width: '1px',
            backgroundColor: surface.border,
            opacity: 0.25,
            display: { xs: 'none', lg: 'block' },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '44%',
            left: '6%',
            right: '6%',
            height: '1px',
            backgroundColor: surface.border,
            opacity: 0.2,
            display: { xs: 'none', lg: 'block' },
          }}
        />
        {/* Intersection Dot */}
        <Box
          sx={{
            position: 'absolute',
            left: 'calc(50% - 2.5px)',
            top: 'calc(44% - 2.5px)',
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: surface.borderStrong,
            opacity: 0.6,
            display: { xs: 'none', lg: 'block' },
          }}
        />
      </Box>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 980,
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 3.5, md: 4.5 },
          my: 'auto',
          ...enterStyles(),
        }}
      >
        {/* ── Studio Header & Goal Statement ──────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, maxWidth: 720 }}>
          {/* Luminous Status Crest */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.85,
              px: 1.2,
              py: 0.35,
              borderRadius: `${radius.pill}px`,
              backgroundColor: surface.sunken,
              border: `1px solid ${surface.border}`,
              alignSelf: 'flex-start',
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: accent.violet,
                boxShadow: `0 0 8px ${accent.violet}`,
              }}
            />
            <Typography
              variant="overline"
              sx={{
                color: ink.secondary,
                fontWeight: 700,
                fontSize: '0.6875rem',
                letterSpacing: '0.1em',
              }}
            >
              Governed Workbench
            </Typography>
          </Box>

          <Typography
            component="h1"
            sx={{
              color: ink.primary,
              fontSize: { xs: '1.625rem', md: '2.25rem' },
              lineHeight: 1.16,
              letterSpacing: '-0.03em',
              fontWeight: 750,
            }}
          >
            Choose a project or describe your goal
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: ink.secondary,
              lineHeight: 1.6,
              fontSize: { xs: '0.875rem', md: '0.9375rem' },
              maxWidth: '52ch',
            }}
          >
            Whatever you start takes shape here: a live application, a document, a result, or
            evidence you can inspect.
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: ink.muted,
              lineHeight: 1.6,
              fontSize: '0.78125rem',
            }}
          >
            Describe your goal in the composer, or press{' '}
            <Box
              component="span"
              sx={{
                px: 0.7,
                py: 0.15,
                borderRadius: `${radius.sm}px`,
                border: `1px solid ${surface.border}`,
                backgroundColor: surface.sunken,
                color: ink.secondary,
                fontFamily: typography.mono,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              /
            </Box>{' '}
            for quick actions.
          </Typography>
        </Box>

        {/* ── Asymmetric Studio Bento Grid ────────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {/* Hero Card: Choose a project */}
          <BentoStartTile
            title="Choose a project"
            detail="Open one of your registered projects or local git worktrees to explore live 3D models, audio tracks, and code structure."
            icon={<FolderOutlinedIcon sx={{ fontSize: 24 }} />}
            hint="⌘O"
            chips={[
              {
                label: '3D Studio (Blender)',
                icon: <ViewInArIcon sx={{ fontSize: 14 }} />,
                accentColor: accent.violet,
                accentBg: accent.violetMuted,
                accentBorder: accent.violetBorder,
                onClick: onOpenBlender,
              },
              {
                label: 'Audio DAW (REAPER)',
                icon: <EqualizerIcon sx={{ fontSize: 14 }} />,
                accentColor: status.brass,
                accentBg: status.brassMuted,
                accentBorder: status.brass,
                onClick: onOpenReaper,
              },
              {
                label: 'Workspace AST',
                icon: <CodeIcon sx={{ fontSize: 14 }} />,
                accentColor: ink.primary,
                accentBg: surface.sunken,
                accentBorder: surface.border,
                onClick: onOpenAst,
              },
            ]}
            actionLabel="Open Project Workspace"
            dataVariant="primary"
            isHero={true}
            onClick={onChooseProject}
          />

          {/* Card 2: Connect a capability */}
          <BentoStartTile
            title="Connect a capability"
            detail="Add an MCP server, CLI tool, or custom service in Rig with governed operator review."
            icon={<ElectricBoltIcon sx={{ fontSize: 22 }} />}
            hint="⌘R"
            chips={[
              {
                label: 'Governed Tools',
                icon: <ElectricBoltIcon sx={{ fontSize: 13 }} />,
                accentColor: accent.violet,
                accentBg: accent.violetMuted,
                accentBorder: accent.violetBorder,
              },
              {
                label: 'Deterministic Audit',
                icon: <CodeIcon sx={{ fontSize: 13 }} />,
                accentColor: ink.primary,
                accentBg: surface.sunken,
                accentBorder: surface.border,
              },
            ]}
            actionLabel="Configure Rig Capabilities"
            dataVariant="secondary"
            onClick={onConnectCapability}
          />

          {/* Card 3: Describe your goal */}
          <BentoStartTile
            title="Describe your goal"
            detail="Jump directly to the prompt composer and command real-time application execution."
            icon={<AutoAwesomeIcon sx={{ fontSize: 22 }} />}
            hint="/"
            chips={[
              {
                label: 'Natural Language',
                icon: <AutoAwesomeIcon sx={{ fontSize: 13 }} />,
                accentColor: accent.violet,
                accentBg: accent.violetMuted,
                accentBorder: accent.violetBorder,
              },
              {
                label: 'Live Mutation',
                icon: <ViewInArIcon sx={{ fontSize: 13 }} />,
                accentColor: ink.primary,
                accentBg: surface.sunken,
                accentBorder: surface.border,
              },
            ]}
            actionLabel="Focus Composer & Start"
            dataVariant="describe-goal"
            onClick={onDescribeGoal}
          />
        </Box>

        {/* ── Atmospheric Footer ─────────────────────────────────────── */}
        <Box
          sx={{
            pt: 1.5,
            borderTop: `1px solid ${surface.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: ink.muted,
              lineHeight: 1.6,
              fontSize: '0.75rem',
            }}
          >
            Applications, documents, results, and evidence take shape on this canvas as you work.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
