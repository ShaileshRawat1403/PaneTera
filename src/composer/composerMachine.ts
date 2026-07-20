// src/composer/composerMachine.ts
// Pure interaction state machine for the composer.
//
// Extracted from the component so that keyboard behaviour, menu dismissal, and
// note cancellation are testable without a DOM. The React component is a thin
// binding over this: it renders state and forwards events.
//
// The earlier implementation dismissed the slash menu by stripping the leading
// `/` from the input, which silently edited what the user typed. Menu
// visibility is now its own state, so Escape closes the menu and changes
// nothing else.

import { filterSlashCommands, parseSlashInput } from './slashCommands';
import type { SlashCommand } from './slashCommands';

export interface ComposerState {
  value: string;
  activeIndex: number;
  /** Set when the user dismisses the menu for the current slash token. */
  menuDismissed: boolean;
  /** null when no note is being drafted; '' is an empty draft in progress. */
  noteDraft: string | null;
  notice: string | null;
}

export const INITIAL_COMPOSER_STATE: ComposerState = {
  value: '',
  activeIndex: 0,
  menuDismissed: false,
  noteDraft: null,
  notice: null,
};

export type ComposerEvent =
  | { type: 'change'; value: string }
  | { type: 'key'; key: string; shiftKey?: boolean }
  | { type: 'select-command'; command: SlashCommand }
  | { type: 'point-command'; index: number }
  | { type: 'dismiss-menu' }
  | { type: 'note-change'; value: string }
  | { type: 'note-start' }
  | { type: 'note-commit' }
  | { type: 'note-cancel' }
  /** Keys pressed inside the note editor. Kept separate from 'key' so the note
   *  field can never emit the main submit effect. */
  | { type: 'note-key'; key: string; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }
  | { type: 'notice'; message: string | null }
  | { type: 'clear-value' };

export type ComposerEffect =
  | { type: 'submit' }
  | { type: 'focus-input' }
  | { type: 'commit-note'; body: string }
  | { type: 'preventDefault' };

export interface Transition {
  state: ComposerState;
  effects: ComposerEffect[];
}

/** Commands matching the current slash token, or [] when the menu is closed. */
export function visibleCommands(state: ComposerState): SlashCommand[] {
  if (!isMenuOpen(state)) return [];
  const parsed = parseSlashInput(state.value);
  return filterSlashCommands(parsed?.name ?? '');
}

/**
 * The menu is open when the input holds an unsettled slash token that the user
 * has not dismissed. Once a space follows the command the user has moved on to
 * arguments, so the menu closes on its own.
 */
export function isMenuOpen(state: ComposerState): boolean {
  if (state.menuDismissed) return false;
  const parsed = parseSlashInput(state.value);
  return parsed !== null && !parsed.complete;
}

export function boundedIndex(state: ComposerState): number {
  const commands = visibleCommands(state);
  if (commands.length === 0) return 0;
  return Math.min(Math.max(state.activeIndex, 0), commands.length - 1);
}

function slashTokenOf(value: string): string | null {
  const parsed = parseSlashInput(value);
  return parsed ? parsed.name : null;
}

export function composerReducer(state: ComposerState, event: ComposerEvent): Transition {
  switch (event.type) {
    case 'change': {
      // Dismissal applies to the slash token that was dismissed. Typing a
      // different token is a new request for the menu, so the flag clears;
      // continuing to edit the same token leaves it dismissed.
      const previousToken = slashTokenOf(state.value);
      const nextToken = slashTokenOf(event.value);
      const stillSameToken = previousToken !== null && previousToken === nextToken;
      return {
        state: {
          ...state,
          value: event.value,
          activeIndex: 0,
          menuDismissed: state.menuDismissed && stillSameToken,
        },
        effects: [],
      };
    }

    case 'point-command':
      // Only genuine pointer movement selects.
      //
      // The menu mounts under wherever the pointer already is, so `mouseenter`
      // fires without anyone moving: typing `/` with the cursor resting over
      // the third row selected `/run` before a single keystroke. Deliberate
      // pointer navigation should still update the selection; merely appearing
      // beneath a stationary pointer must not.
      return { state: { ...state, activeIndex: event.index }, effects: [] };

    case 'dismiss-menu':
      return { state: { ...state, menuDismissed: true }, effects: [] };

    case 'select-command': {
      const next = event.command.argHint ? `/${event.command.name} ` : `/${event.command.name}`;
      return {
        state: { ...state, value: next, activeIndex: 0, menuDismissed: false },
        effects: [{ type: 'focus-input' }],
      };
    }

    case 'note-start':
      return { state: { ...state, noteDraft: '' }, effects: [] };

    case 'note-change':
      return { state: { ...state, noteDraft: event.value }, effects: [] };

    case 'note-commit': {
      const body = (state.noteDraft ?? '').trim();
      // An empty draft cancels rather than attaching an empty note.
      if (!body) return { state: { ...state, noteDraft: null }, effects: [] };
      return {
        state: { ...state, noteDraft: null },
        effects: [{ type: 'commit-note', body }, { type: 'focus-input' }],
      };
    }

    case 'note-cancel':
      return { state: { ...state, noteDraft: null }, effects: [{ type: 'focus-input' }] };

    case 'note-key':
      return handleNoteKey(state, event);

    case 'notice':
      return { state: { ...state, notice: event.message }, effects: [] };

    case 'clear-value':
      return { state: { ...state, value: '', activeIndex: 0, menuDismissed: false }, effects: [] };

    case 'key':
      return handleKey(state, event.key, event.shiftKey ?? false);

    default:
      return { state, effects: [] };
  }
}

/**
 * Keyboard handling inside the note editor.
 *
 * Deliberately does not share handleKey. The note field is a multiline editor,
 * so plain Enter inserts a newline and must never submit the main composer,
 * which previously happened and could send unrelated text while a note was
 * still open.
 *
 * Commit is an explicit gesture: Cmd+Enter or Ctrl+Enter. Escape cancels and
 * discards. Blur does nothing, so leaving the field cannot attach implicitly.
 */
function handleNoteKey(
  state: ComposerState,
  event: { key: string; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean },
): Transition {
  if (state.noteDraft === null) return { state, effects: [] };

  if (event.key === 'Escape') {
    return {
      state: { ...state, noteDraft: null },
      effects: [{ type: 'preventDefault' }, { type: 'focus-input' }],
    };
  }

  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    const committed = composerReducer(state, { type: 'note-commit' });
    return { state: committed.state, effects: [{ type: 'preventDefault' }, ...committed.effects] };
  }

  // Everything else, including plain Enter and Shift+Enter, is ordinary text
  // entry. No submit effect is reachable from here.
  return { state, effects: [] };
}

function handleKey(state: ComposerState, key: string, shiftKey: boolean): Transition {
  const commands = visibleCommands(state);
  const menuOpen = commands.length > 0;

  if (menuOpen) {
    if (key === 'ArrowDown') {
      return {
        state: { ...state, activeIndex: (boundedIndex(state) + 1) % commands.length },
        effects: [{ type: 'preventDefault' }],
      };
    }
    if (key === 'ArrowUp') {
      return {
        state: {
          ...state,
          activeIndex: (boundedIndex(state) - 1 + commands.length) % commands.length,
        },
        effects: [{ type: 'preventDefault' }],
      };
    }
    if (key === 'Tab' || (key === 'Enter' && !shiftKey)) {
      const command = commands[boundedIndex(state)];
      if (command) {
        const applied = composerReducer(state, { type: 'select-command', command });
        return { state: applied.state, effects: [{ type: 'preventDefault' }, ...applied.effects] };
      }
    }
  }

  if (key === 'Escape') {
    // The note editor has its own Escape via handleNoteKey. From the main
    // input, Escape dismisses the menu and never edits the composer value.
    if (menuOpen) {
      return {
        state: { ...state, menuDismissed: true },
        effects: [{ type: 'preventDefault' }],
      };
    }
    return { state, effects: [] };
  }

  if (key === 'Enter' && !shiftKey) {
    // An open note draft blocks submission. Sending while a note is unattached
    // would drop it and leave the composer in a state the user did not intend.
    if (state.noteDraft !== null) {
      return { state, effects: [{ type: 'preventDefault' }] };
    }
    return { state, effects: [{ type: 'preventDefault' }, { type: 'submit' }] };
  }

  return { state, effects: [] };
}
