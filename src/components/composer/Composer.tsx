// src/components/composer/Composer.tsx
// The single door: natural language, `/` actions, and `+` attachments.
//
// Two inputs, two paths, one meeting point:
//   - text (typed or slash) -> resolveIntent -> IntentEnvelope
//   - attachments           -> ContextItem records in the tray
// They combine only at submit. There is no path from an attachment into the
// intent resolver, and that separation is the point.
//
// Interaction logic lives in composerMachine.ts so it is testable without a
// DOM. This component renders state and forwards events.
//
// Slice boundaries: no persistence, no transport, no filesystem read, no
// execution, no Headroom envelope assembly.

import React, { KeyboardEvent, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Button, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import { accent, elevation, ink, radius, surface, typography } from '../../theme/tokens';
import { enterStyles, transition } from '../../theme/motion';
import { SlashMenu } from './SlashMenu';
import { AttachmentMenu } from './AttachmentMenu';
import { WebLinkEntry } from './WebLinkEntry';
import { ContextChips } from './ContextChips';
import {
  INITIAL_COMPOSER_STATE,
  boundedIndex,
  composerReducer,
  isMenuOpen,
  visibleCommands,
} from '../../composer/composerMachine';
import type { ComposerEffect, ComposerEvent } from '../../composer/composerMachine';
import { resolveIntent, DEFAULT_RESOLVER_CONTEXT } from '../../composer/intentResolver';
import type { ResolverContext } from '../../composer/intentResolver';
import type { IntentEnvelope } from '../../composer/intentTypes';
import {
  EMPTY_MATERIAL,
  EMPTY_TRAY,
  attachContextItem,
  clearContext,
  dropMaterial,
  includedItems,
  materialFor,
  putMaterial,
  removeContextItem,
  setContextIncluded,
  trayMeasurement,
} from '../../composer/contextTray';
import type { AttachRequest, ContextTray, MaterialStore } from '../../composer/contextTray';
import type {
  AttachmentAvailability,
  ContextItem,
  ContextKind,
} from '../../composer/contextTypes';

export interface ComposerSubmission {
  intent: IntentEnvelope;
  context: ContextItem[];
  /** Exact transient content for items that carry it, keyed by context id. */
  material: Record<string, string>;
}

interface Props {
  onSubmit: (submission: ComposerSubmission) => void;
  resolverContext?: Partial<Omit<ResolverContext, 'includedContextCount'>>;
  /**
   * Host-provided attachment picker for workspace-scoped kinds. Absent means
   * those options are shown disabled: the composer never reads the filesystem
   * itself, and external filesystem selection waits for temporary attachment
   * scopes.
   */
  onRequestAttachment?: (kind: ContextKind) => Promise<AttachRequest | null>;
  /** What the host can actually do. Drives which menu rows exist at all. */
  availability?: Partial<AttachmentAvailability>;
  placeholder?: string;
}

const DEFAULT_AVAILABILITY: AttachmentAvailability = {
  hasWorkspacePicker: false,
  hasProjects: false,
  // Web links need no host capability: validation is local and the result is a
  // reference, so this is on by default.
  hasWebLinks: true,
};

const LIST_ID = 'panetera-slash-menu';
const optionId = (index: number) => `${LIST_ID}-option-${index}`;

/**
 * Capabilities the composer performs itself.
 *
 * Clearing context is a tray operation, and the tray lives here. Declaring it
 * host-side would require a host executor that does nothing, which is the
 * placeholder pattern capability derivation is meant to rule out.
 */
export const COMPOSER_OWNED_CAPABILITIES = ['headroom:clear'] as const;

export const Composer: React.FC<Props> = ({
  onSubmit,
  resolverContext,
  onRequestAttachment,
  availability,
  placeholder = 'Ask PaneTera, type / for actions…',
}) => {
  const [tray, setTray] = useState<ContextTray>(EMPTY_TRAY);
  const [webEntryOpen, setWebEntryOpen] = useState(false);
  const [material, setMaterial] = useState<MaterialStore>(EMPTY_MATERIAL);
  const [attachAnchor, setAttachAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const included = includedItems(tray);
  const measurement = trayMeasurement(tray);

  // Context clearing is performed here, by the component that owns the tray, so
  // the composer declares it rather than the host. A host-side no-op would be
  // exactly the placeholder that capability derivation exists to prevent.
  const context: ResolverContext = {
    ...DEFAULT_RESOLVER_CONTEXT,
    ...resolverContext,
    includedContextCount: included.length,
    supportedCapabilities: [
      ...(resolverContext?.supportedCapabilities ?? []),
      ...COMPOSER_OWNED_CAPABILITIES,
    ],
  };

  const [state, rawDispatch] = useReducer(
    (current: typeof INITIAL_COMPOSER_STATE, event: ComposerEvent) =>
      composerReducer(current, event).state,
    INITIAL_COMPOSER_STATE,
  );
  const attachButtonRef = React.useRef<HTMLButtonElement>(null);

  // Effects are produced by the reducer and applied here. Running them outside
  // the reducer keeps the machine pure and testable.
  const dispatch = (event: ComposerEvent, domEvent?: KeyboardEvent) => {
    const { effects } = composerReducer(state, event);
    rawDispatch(event);
    for (const effect of effects) applyEffect(effect, domEvent);
  };

  const applyEffect = (effect: ComposerEffect, domEvent?: KeyboardEvent) => {
    switch (effect.type) {
      case 'preventDefault':
        domEvent?.preventDefault();
        break;
      case 'focus-input':
        inputRef.current?.focus();
        break;
      case 'submit':
        submit();
        break;
      case 'commit-note':
        commitNote(effect.body);
        break;
      default:
        break;
    }
  };

  const commands = useMemo(() => visibleCommands(state), [state]);
  const menuOpen = isMenuOpen(state) && commands.length > 0;
  const activeIndex = boundedIndex(state);
  // An open note draft blocks submission, matching the reducer, so the control
  // reflects the same rule rather than looking available and doing nothing.
  const canSend = state.value.trim().length > 0 && state.noteDraft === null;

  const submit = () => {
    const trimmed = state.value.trim();
    if (!trimmed) return;

    const intent = resolveIntent(trimmed, context);

    // `/clear-context` acts on the tray. It is still a resolved intent rather
    // than a special-cased keystroke, so it is auditable like any other.
    if (intent.family === 'headroom' && intent.args.action === 'clear') {
      if (intent.readiness === 'ready') {
        setTray(clearContext());
        setMaterial(EMPTY_MATERIAL);
        rawDispatch({ type: 'notice', message: 'Context cleared. No source data was deleted.' });
      } else {
        rawDispatch({ type: 'notice', message: intent.missing[0]?.prompt ?? null });
      }
      rawDispatch({ type: 'clear-value' });
      return;
    }

    onSubmit({ intent, context: included, material: materialFor(included, material) });
    rawDispatch({ type: 'clear-value' });
    rawDispatch({ type: 'notice', message: null });
  };

  const menuAvailability: AttachmentAvailability = {
    ...DEFAULT_AVAILABILITY,
    ...availability,
    // Derived, not declared: the picker exists only if the host supplied one.
    hasWorkspacePicker: Boolean(onRequestAttachment) && (availability?.hasWorkspacePicker ?? true),
  };

  const handleAttach = async (kind: ContextKind) => {
    // Notes and web links are entered inline; everything else goes through the
    // host's governed picker. Neither path touches the intent resolver.
    // The menu is already closing when this runs. Both inline editors mount
    // with autoFocus, and `disableRestoreFocus` on the menu stops MUI pulling
    // focus back to the Add context button afterwards.
    if (kind === 'note') {
      dispatch({ type: 'note-start' });
      return;
    }
    if (kind === 'web') {
      setWebEntryOpen(true);
      return;
    }
    if (!onRequestAttachment) return;

    const request = await onRequestAttachment(kind);
    // The host resolves only after its picker has finished closing, so this
    // focus cannot be stolen by the dialog's focus-restoration lifecycle.
    inputRef.current?.focus();
    // A cancelled picker resolves null and creates nothing.
    if (!request) return;
    commitAttachment(request);
  };

  const closeWebEntry = () => {
    setWebEntryOpen(false);
    inputRef.current?.focus();
  };

  const commitWebLink = (link: { url: string; label: string }) => {
    closeWebEntry();
    commitAttachment({ kind: 'web', label: link.label, locator: link.url });
  };

  const commitAttachment = (request: AttachRequest) => {
    const result = attachContextItem(tray, request);
    if (!result.ok) {
      rawDispatch({ type: 'notice', message: rejectionMessage(result.reason) });
      return;
    }
    setTray(result.tray);
    if (typeof result.material === 'string') {
      setMaterial(putMaterial(material, result.item.id, result.material));
    }
    rawDispatch({ type: 'notice', message: null });
  };

  const commitNote = (body: string) => {
    commitAttachment({
      kind: 'note',
      label: body.length > 32 ? `${body.slice(0, 32)}…` : body,
      locator: `note:${Date.now()}:${body.length}`,
      noteBody: body,
    });
  };

  const removeItem = (id: string) => {
    setTray(removeContextItem(tray, id));
    setMaterial(dropMaterial(material, id));
  };

  return (
    <Box>
      <ContextChips
        items={tray}
        onRemove={removeItem}
        onToggleIncluded={(id, next) => setTray(setContextIncluded(tray, id, next))}
      />

      {menuOpen && (
        <SlashMenu
          commands={commands}
          activeIndex={activeIndex}
          onSelect={(command) => dispatch({ type: 'select-command', command })}
          onPointIndex={(index) => rawDispatch({ type: 'point-command', index })}
          listId={LIST_ID}
          optionId={optionId}
        />
      )}

      {webEntryOpen && (
        <WebLinkEntry onAdd={commitWebLink} onCancel={closeWebEntry} />
      )}

      {state.noteDraft !== null && (
        <Paper
          sx={{
            p: 1.25,
            mb: 1,
            borderRadius: `${radius.md}px`,
            backgroundColor: surface.overlay,
            border: `1px solid ${surface.border}`,
            boxShadow: elevation.raised,
            ...enterStyles(),
          }}
        >
          {/*
            No commit on blur. Escape and Cmd/Ctrl+Enter both move focus to the
            main input, which fires blur synchronously against the pre-update
            draft: Escape could discard and then re-attach the stale note, and
            an explicit commit could attach it twice. Attaching is an explicit
            act with a button, which removes the race rather than sequencing it.
          */}
          <TextField
            fullWidth
            multiline
            minRows={2}
            autoFocus
            variant="standard"
            placeholder="Paste text or write a note…"
            value={state.noteDraft}
            onChange={(event) => rawDispatch({ type: 'note-change', value: event.target.value })}
            onKeyDown={(event) =>
              dispatch(
                {
                  type: 'note-key',
                  key: event.key,
                  shiftKey: event.shiftKey,
                  metaKey: event.metaKey,
                  ctrlKey: event.ctrlKey,
                },
                event,
              )
            }
            InputProps={{
              disableUnderline: true,
              inputProps: { 'aria-label': 'Note text' },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: ink.muted, flex: 1 }}>
              Enter adds a line. Cmd or Ctrl + Enter attaches.
            </Typography>
            <Button
              size="small"
              onClick={() => dispatch({ type: 'note-cancel' })}
              sx={{ color: ink.secondary, '&:hover': { backgroundColor: surface.sunken } }}
            >
              Discard
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              disabled={!state.noteDraft.trim()}
              onClick={() => dispatch({ type: 'note-commit' })}
              sx={{ textTransform: 'none' }}
            >
              Attach
            </Button>
          </Box>
        </Paper>
      )}

      <Paper
        elevation={0}
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        sx={{
          p: 1,
          borderRadius: `${radius.lg}px`,
          backgroundColor: surface.raised,
          border: `1px solid ${surface.border}`,
          boxShadow: elevation.raised,
          transition: transition(['border-color', 'box-shadow']),
          '&:hover': { borderColor: surface.borderStrong },
          '&:focus-within': {
            borderColor: accent.violetBorder,
            boxShadow: elevation.focusRing,
          },
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={6}
          variant="standard"
          placeholder={placeholder}
          value={state.value}
          inputRef={inputRef}
          onChange={(event) => rawDispatch({ type: 'change', value: event.target.value })}
          onKeyDown={(event) =>
            dispatch({ type: 'key', key: event.key, shiftKey: event.shiftKey }, event)
          }
          InputProps={{
            disableUnderline: true,
            sx: {
              px: 0.5,
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              color: ink.primary,
              // Slash input is an identifier being typed, so it renders in the
              // monospace face. Prose stays humanist. The switch is a legible
              // signal that the composer is in command mode.
              fontFamily: state.value.startsWith('/') ? typography.mono : typography.sans,
              transition: transition(['font-family']),
              '& textarea::placeholder': { color: ink.muted, opacity: 1 },
            },
            inputProps: {
              'aria-label': 'Message PaneTera',
              role: 'combobox',
              'aria-expanded': menuOpen,
              'aria-controls': menuOpen ? LIST_ID : undefined,
              'aria-activedescendant': menuOpen ? optionId(activeIndex) : undefined,
              'aria-autocomplete': 'list',
            },
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5, pt: 0.5 }}>
          <Tooltip title="Add context">
            <IconButton
              ref={attachButtonRef}
              size="small"
              aria-label="Add context"
              aria-haspopup="menu"
              onClick={(event) => {
                // Only one command surface should be active. Preserve the
                // typed slash token, but dismiss its menu before opening `+`.
                rawDispatch({ type: 'dismiss-menu' });
                setAttachAnchor(event.currentTarget);
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Typography
            variant="caption"
            sx={{ color: ink.muted, transition: transition(['color']) }}
          >
            {headroomLabel(tray.length, included.length, measurement)}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/*
            The send control carries the accent only when there is something to
            send. An always-filled button implies readiness that an empty
            composer does not have, and disabling it silently is worse than
            showing plainly that nothing is queued.
          */}
          <Tooltip title={canSend ? 'Send' : 'Nothing to send yet'}>
            <span>
              <IconButton
                size="small"
                aria-label="Send message"
                onClick={submit}
                disabled={!canSend}
                sx={{
                  backgroundColor: canSend ? accent.violet : 'transparent',
                  color: canSend ? ink.onAccent : ink.disabled,
                  transition: transition(['background-color', 'color']),
                  '&:hover': {
                    backgroundColor: canSend ? accent.violet : surface.sunken,
                    color: canSend ? ink.onAccent : ink.secondary,
                    filter: canSend ? 'brightness(1.08)' : 'none',
                  },
                  '&.Mui-disabled': { color: ink.disabled },
                }}
              >
                <SendIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      {state.notice && (
        <Typography
          role="status"
          variant="caption"
          sx={{ color: ink.secondary, mt: 0.75, display: 'block', ...enterStyles() }}
        >
          {state.notice}
        </Typography>
      )}

      <AttachmentMenu
        anchorEl={attachAnchor}
        open={Boolean(attachAnchor)}
        onClose={() => setAttachAnchor(null)}
        onDismiss={() => attachButtonRef.current?.focus()}
        onChoose={handleAttach}
        availability={menuAvailability}
      />
    </Box>
  );
};

function rejectionMessage(reason: string): string {
  switch (reason) {
    case 'outside-registered-workspace':
      return 'Only files and folders inside a registered workspace can be attached yet.';
    case 'duplicate':
      return 'That is already attached.';
    case 'empty-locator':
      return 'Nothing was selected.';
    case 'unsupported-kind':
      return 'That kind of context is not supported yet.';
    case 'invalid-web-address':
      return 'That web address could not be attached.';
    case 'missing-material':
      return 'That note had no content.';
    default:
      return 'That could not be attached.';
  }
}

/**
 * Headroom label.
 *
 * Reports item count always, and a size only when honestly measured. No
 * percentage, no token total, because neither the tokenizer nor the model
 * window is known in this slice.
 */
export function headroomLabel(
  totalCount: number,
  includedCount: number,
  measurement: ReturnType<typeof trayMeasurement>,
): string {
  if (totalCount === 0) return 'No context attached';
  const totalNoun = totalCount === 1 ? 'item' : 'items';
  if (includedCount === 0) {
    return `${totalCount} ${totalNoun} attached · excluded from next message`;
  }
  const prefix = includedCount === totalCount
    ? `${includedCount} ${includedCount === 1 ? 'item' : 'items'}`
    : `${includedCount} of ${totalCount} included`;
  if (measurement.unit === 'bytes' && measurement.value > 0) {
    return `${prefix} · ${measurement.value} bytes inline`;
  }
  if (measurement.unit === 'not-measured') {
    return `${prefix} · size not measured`;
  }
  return `${prefix} · references only`;
}
