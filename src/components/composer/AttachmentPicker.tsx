// src/components/composer/AttachmentPicker.tsx
// One picker workflow for project, file and folder attachment.
//
// Deliberately a single component rather than three dialogs. Choosing a file
// and choosing a folder differ only in what a selection means at the end; both
// start from "which project", and duplicating that step three times would
// invite the three copies to drift.
//
// Boundaries this surface exists to hold:
//
//   - selection is confined to registered projects, always;
//   - the composer never reads the filesystem, so listings come from the host
//     through the workspace API;
//   - cancelling returns nothing and creates nothing;
//   - file and folder attachments are references. Nothing is read here.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  TextField,
  Typography,
} from '@mui/material';
import type { AttachableWorkspace } from '../../composer/contextTypes';
import { accent, ink, radius, surface, typography } from '../../theme/tokens';
import { transition } from '../../theme/motion';
import { LatestOnly } from '../../composer/pickerCoordinator';

/**
 * The only kinds this dialog can express.
 *
 * Narrowed from ContextKind on purpose: a note is typed inline and a web link
 * has its own entry surface, so neither should be representable here. Widening
 * it would be the first step towards a second attachment pipeline.
 */
export type PickerKind = 'project' | 'file' | 'folder';

export interface AttachmentPickerProps {
  /** Which kind of selection is being made. */
  kind: PickerKind | null;
  projects: readonly AttachableWorkspace[];
  /** Lists relative paths inside a project. Host-owned; the composer has no
   *  filesystem access of its own. */
  listPaths: (project: AttachableWorkspace) => Promise<string[]>;
  onCancel: () => void;
  /** Runs after the closing transition, when focus can safely leave the dialog. */
  onExited?: () => void;
  onChoose: (selection: {
    kind: PickerKind;
    project: AttachableWorkspace;
    /**
     * Path relative to the project root. Omitted when the project itself is
     * the selection.
     *
     * Named for what it is. The field was called `path` and documented as
     * absolute while carrying a relative entry, which is the sort of mismatch
     * that survives until someone concatenates it with something.
     * Constructing the absolute locator is App's job, since App owns the
     * registered project root.
     */
    relativePath?: string;
  }) => void;
}

/**
 * Keep only entries that are safe to display and to attach.
 *
 * The listing arrives from the server. Even a trusted server can return an
 * absolute path, a traversal, or a non-string, and the picker turns whatever it
 * receives into a locator. Filtering here means a malformed response produces a
 * shorter list rather than an attachment pointing outside the project.
 */
export function sanitisePaths(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const clean: string[] = [];
  for (const entry of payload) {
    if (typeof entry !== 'string') continue;
    const value = entry.trim();
    if (!value) continue;
    if (value.startsWith('/') || /^[a-z]:[\\/]/i.test(value)) continue; // absolute
    if (value.includes('\0')) continue;
    if (value.includes('\\')) continue; // backslash separators

    // Every segment must be a real name. `.`, `..` and empty segments were all
    // accepted before, so `./src/file.ts`, `src/./file.ts` and `src//file.ts`
    // passed through and became locators containing them.
    const segments = value.split('/');
    if (segments.some((part) => part === '' || part === '.' || part === '..')) continue;

    clean.push(value);
  }
  return clean;
}

/**
 * Directories whose contents are build or tooling output.
 *
 * Named explicitly rather than treating every dot-directory as generated:
 * `.github` holds workflows a person may well want to attach, and `.vscode`
 * holds settings. Guessing from the leading dot would hide those too.
 *
 * Generated files stay searchable and attachable; they are simply not what the
 * first screen should be full of.
 */
const GENERATED_ROOTS = [
  '.astro',
  '.content-collections',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'dist',
  'build',
  'out',
  'coverage',
  'node_modules',
  '__pycache__',
  'target',
  'vendor',
];

/** Whether a relative path lives under a known output directory. */
export function isGeneratedPath(relativePath: string): boolean {
  const segments = relativePath.split('/');
  return segments.some((segment) => GENERATED_ROOTS.includes(segment));
}

/** Split a listing into ordinary project files and generated output. */
export function partitionGenerated(paths: readonly string[]): {
  ordinary: string[];
  generated: string[];
} {
  const ordinary: string[] = [];
  const generated: string[] = [];
  for (const path of paths) {
    (isGeneratedPath(path) ? generated : ordinary).push(path);
  }
  return { ordinary, generated };
}

/**
 * Derive the distinct directories from a flat list of relative file paths.
 *
 * Folders come from the attachable files, so a directory containing no
 * attachable file does not appear. The dialog says so rather than leaving the
 * absence unexplained.
 */
export function foldersFrom(paths: readonly string[]): string[] {
  const folders = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    parts.pop();
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part;
      folders.add(prefix);
    }
  }
  return [...folders].sort();
}

const MAX_ROWS = 200;

export function visiblePathSections(
  paths: readonly string[],
  showGenerated: boolean,
  maxRows = MAX_ROWS,
): {
  ordinaryShown: string[];
  ordinaryTotal: number;
  generatedShown: string[];
  generatedTotal: number;
  total: number;
} {
  const { ordinary, generated } = partitionGenerated(paths);
  return {
    ordinaryShown: ordinary.slice(0, maxRows),
    ordinaryTotal: ordinary.length,
    generatedShown: showGenerated ? generated.slice(0, maxRows) : [],
    generatedTotal: generated.length,
    total: ordinary.length + generated.length,
  };
}

const titles: Record<PickerKind, string> = {
  project: 'Choose a project',
  file: 'Choose a file',
  folder: 'Choose a folder',
};

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  kind,
  projects,
  listPaths,
  onCancel,
  onExited,
  onChoose,
}) => {
  const [project, setProject] = useState<AttachableWorkspace | null>(null);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showGenerated, setShowGenerated] = useState(false);
  // Discards a listing that arrives for a project the user has left.
  const latest = React.useRef(new LatestOnly());

  const open = kind !== null;
  const needsPath = kind === 'file' || kind === 'folder';

  // Reset whenever the kind changes, not only on close. Switching straight from
  // "choose file" to "choose folder" keeps the dialog open, so a close-only
  // reset would carry the previous project and listing into the new selection.
  useEffect(() => {
    setProject(null);
    setPaths(null);
    setFilter('');
    setFailure(null);
    setShowGenerated(false);
  }, [kind]);

  // A project chosen for a file or folder attachment needs its listing. When
  // the project itself is the attachment, no listing is fetched at all.
  useEffect(() => {
    if (!project || !needsPath) return;

    const token = latest.current.begin();
    setLoading(true);
    setPaths(null);
    setFailure(null);

    listPaths(project)
      .then((result) => {
        // Only the newest request may write. A listing for project A arriving
        // after the user moved to project B is discarded rather than shown
        // under B's name.
        if (latest.current.isCurrent(token)) setPaths(sanitisePaths(result));
      })
      .catch(() => {
        if (latest.current.isCurrent(token)) setFailure('That project could not be listed.');
      })
      .finally(() => {
        if (latest.current.isCurrent(token)) setLoading(false);
      });

    return () => {
      latest.current.cancel();
    };
  }, [project, needsPath, listPaths]);

  const entries = useMemo(() => {
    if (!paths) return visiblePathSections([], showGenerated);

    const source = kind === 'folder' ? foldersFrom(paths) : paths;
    const needle = filter.trim().toLowerCase();
    const matched = needle ? source.filter((entry) => entry.toLowerCase().includes(needle)) : source;

    // Ordinary project files first. Generated output previously filled the
    // first 200 rows of a 375-file project, so a person looking for README.md
    // had to filter before seeing anything they wrote.
    return visiblePathSections(matched, showGenerated);
  }, [paths, kind, filter, showGenerated]);

  const rowSx = {
    borderRadius: `${radius.sm}px`,
    py: 0.75,
    transition: transition(['background-color']),
    '&:hover': { backgroundColor: accent.violetMuted },
  } as const;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="sm"
      aria-labelledby="attachment-picker-title"
      TransitionProps={{ onExited }}
      PaperProps={{
        sx: {
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          borderRadius: `${radius.lg}px`,
        },
      }}
    >
      <DialogTitle id="attachment-picker-title" sx={{ color: ink.primary, fontSize: '1rem' }}>
        {kind ? titles[kind] ?? 'Choose' : 'Choose'}
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: surface.border, minHeight: 240 }}>
        {projects.length === 0 && (
          <Typography variant="body2" sx={{ color: ink.secondary }}>
            No projects are registered yet, so there is nothing to attach from.
          </Typography>
        )}

        {/* Step one: which project. Always first, for every kind. */}
        {projects.length > 0 && !project && (
          <List disablePadding>
            {projects.map((candidate) => (
              <ListItemButton
                key={candidate.id}
                sx={rowSx}
                onClick={() => {
                  if (kind === 'project') {
                    onChoose({ kind, project: candidate });
                    return;
                  }
                  setProject(candidate);
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: ink.primary }}>
                    {candidate.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: ink.secondary, fontFamily: typography.mono, fontSize: 11 }}
                    noWrap
                  >
                    {candidate.path}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}

        {/* Step two: which path inside that project. */}
        {project && needsPath && (
          <Box>
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
              In {project.name}
            </Typography>

            <TextField
              fullWidth
              size="small"
              placeholder={kind === 'folder' ? 'Filter folders' : 'Filter files'}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              inputProps={{ 'aria-label': kind === 'folder' ? 'Filter folders' : 'Filter files' }}
              sx={{ mb: 1 }}
            />

            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={14} sx={{ color: accent.violet }} />
                <Typography variant="caption" sx={{ color: ink.secondary }}>
                  Listing
                </Typography>
              </Box>
            )}

            {failure && (
              <Typography role="alert" variant="body2" sx={{ color: ink.secondary }}>
                {failure}
              </Typography>
            )}

            {/*
              Nothing below renders while a listing is in flight. Showing the
              previous project's rows under a new project's heading, even for a
              moment, is worse than showing nothing.
            */}
            {!loading && !failure && entries.total === 0 && (
              <Typography variant="body2" sx={{ color: ink.secondary }}>
                {kind === 'folder'
                  ? 'No folders to show. Folders are derived from attachable files, so a folder with none does not appear.'
                  : 'Nothing matches.'}
              </Typography>
            )}

            {!loading && kind === 'folder' && entries.total > 0 && (
              <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
                Folders are derived from attachable files.
              </Typography>
            )}

            {!loading && entries.generatedTotal > 0 && (
              <Button
                size="small"
                onClick={() => setShowGenerated((current) => !current)}
                sx={{ color: ink.secondary, mb: 1, px: 0.5 }}
              >
                {showGenerated
                  ? `Hide generated files (${entries.generatedTotal})`
                  : `Show generated files (${entries.generatedTotal})`}
              </Button>
            )}

            {!loading && entries.ordinaryTotal > MAX_ROWS && (
              <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
                Showing the first {MAX_ROWS} of {entries.ordinaryTotal} project files. Filter to narrow the list.
              </Typography>
            )}

            <List disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {!loading && entries.ordinaryShown.map((entry) => (
                <ListItemButton
                  key={entry}
                  sx={rowSx}
                  onClick={() => onChoose({ kind, project, relativePath: entry })}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: ink.primary, fontFamily: typography.mono, fontSize: 12 }}
                  >
                    {entry}
                  </Typography>
                </ListItemButton>
              ))}

              {!loading && showGenerated && entries.generatedShown.length > 0 && (
                <Box
                  component="li"
                  sx={{ listStyle: 'none', color: ink.secondary, px: 1, pt: 1.5, pb: 0.5 }}
                >
                  <Typography variant="caption">Generated files</Typography>
                </Box>
              )}

              {!loading && entries.generatedShown.map((entry) => (
                <ListItemButton
                  key={entry}
                  sx={rowSx}
                  onClick={() => onChoose({ kind, project, relativePath: entry })}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: ink.secondary, fontFamily: typography.mono, fontSize: 12 }}
                  >
                    {entry}
                  </Typography>
                </ListItemButton>
              ))}
            </List>

            {!loading && showGenerated && entries.generatedTotal > MAX_ROWS && (
              <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 1 }}>
                Showing the first {MAX_ROWS} of {entries.generatedTotal} generated files. Filter to narrow the list.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {project && needsPath && (
          <Button onClick={() => setProject(null)} sx={{ color: ink.secondary }}>
            Back
          </Button>
        )}
        <Button onClick={onCancel} sx={{ color: ink.secondary }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};
