// test/composerMachine.test.ts
// Interaction behaviour: menu dismissal, arrow navigation, Escape ordering,
// note cancellation, and submit gating.
//
// Tested against the pure reducer rather than a rendered DOM. The component is
// a thin binding over this machine, so the behaviour under test is the same
// behaviour a user gets, without adding a browser environment to the project.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  INITIAL_COMPOSER_STATE,
  boundedIndex,
  composerReducer,
  isMenuOpen,
  visibleCommands,
} from '../src/composer/composerMachine';
import type { ComposerEvent, ComposerState } from '../src/composer/composerMachine';

function run(state: ComposerState, events: ComposerEvent[]): ComposerState {
  return events.reduce((current, event) => composerReducer(current, event).state, state);
}

function typed(value: string): ComposerState {
  return run(INITIAL_COMPOSER_STATE, [{ type: 'change', value }]);
}

describe('slash menu visibility', () => {
  it('opens on a bare slash', () => {
    assert.strictEqual(isMenuOpen(typed('/')), true);
  });

  it('stays open while the command token is being typed', () => {
    assert.strictEqual(isMenuOpen(typed('/op')), true);
  });

  it('closes once a space settles the token', () => {
    assert.strictEqual(isMenuOpen(typed('/open ')), false);
  });

  it('stays closed for ordinary text', () => {
    assert.strictEqual(isMenuOpen(typed('open example.com')), false);
  });

  it('shows the whole vocabulary for a bare slash', () => {
    assert.ok(visibleCommands(typed('/')).length > 5);
  });

  it('filters as the token narrows', () => {
    const commands = visibleCommands(typed('/op'));
    assert.ok(commands.every((command) => command.name.includes('op') || command.summary.toLowerCase().includes('op')));
  });
});

describe('Escape does not edit the input', () => {
  it('allows another composer surface to dismiss the menu without editing the input', () => {
    const before = { ...typed('/'), activeIndex: 2 };
    const after = composerReducer(before, { type: 'dismiss-menu' });

    assert.strictEqual(after.state.value, '/');
    assert.strictEqual(after.state.menuDismissed, true);
    assert.deepStrictEqual(after.effects, []);
  });

  it('closes the menu and preserves what was typed', () => {
    const before = typed('/ope');
    const after = composerReducer(before, { type: 'key', key: 'Escape' }).state;

    assert.strictEqual(after.value, '/ope', 'Escape must not strip the leading slash');
    assert.strictEqual(isMenuOpen(after), false);
  });

  it('keeps the menu dismissed while the same token is edited', () => {
    let state = typed('/ope');
    state = composerReducer(state, { type: 'key', key: 'Escape' }).state;
    state = composerReducer(state, { type: 'change', value: '/ope' }).state;
    assert.strictEqual(isMenuOpen(state), false);
  });

  it('reopens the menu when a different command token is typed', () => {
    let state = typed('/ope');
    state = composerReducer(state, { type: 'key', key: 'Escape' }).state;
    state = composerReducer(state, { type: 'change', value: '/run' }).state;
    assert.strictEqual(isMenuOpen(state), true);
  });

  it('dismisses the menu from the main input without touching an open note', () => {
    let state = typed('/ope');
    state = composerReducer(state, { type: 'note-start' }).state;

    const after = composerReducer(state, { type: 'key', key: 'Escape' }).state;
    assert.strictEqual(isMenuOpen(after), false, 'menu closes');
    assert.strictEqual(after.noteDraft, '', 'note is untouched by the main input');
  });

  it('closes the note from the note editor without touching the menu', () => {
    let state = typed('/ope');
    state = composerReducer(state, { type: 'note-start' }).state;

    const after = composerReducer(state, { type: 'note-key', key: 'Escape' }).state;
    assert.strictEqual(after.noteDraft, null, 'note closes');
    assert.strictEqual(isMenuOpen(after), true, 'menu untouched by the note editor');
  });

  it('does nothing when there is nothing to dismiss', () => {
    const state = typed('hello');
    const after = composerReducer(state, { type: 'key', key: 'Escape' });
    assert.deepStrictEqual(after.state, state);
    assert.deepStrictEqual(after.effects, []);
  });
});

describe('arrow navigation', () => {
  it('moves down and wraps', () => {
    const state = typed('/');
    const count = visibleCommands(state).length;

    let current = state;
    for (let index = 0; index < count; index += 1) {
      current = composerReducer(current, { type: 'key', key: 'ArrowDown' }).state;
    }
    assert.strictEqual(boundedIndex(current), 0, 'wraps to the first entry');
  });

  it('moves up from the first entry to the last', () => {
    const state = typed('/');
    const count = visibleCommands(state).length;
    const after = composerReducer(state, { type: 'key', key: 'ArrowUp' }).state;
    assert.strictEqual(boundedIndex(after), count - 1);
  });

  it('does not navigate when the menu is closed', () => {
    const state = typed('hello');
    const after = composerReducer(state, { type: 'key', key: 'ArrowDown' });
    assert.deepStrictEqual(after.state, state);
  });

  it('stays in range when filtering shrinks the list', () => {
    let state = typed('/');
    state = composerReducer(state, { type: 'key', key: 'ArrowDown' }).state;
    state = composerReducer(state, { type: 'key', key: 'ArrowDown' }).state;
    state = composerReducer(state, { type: 'change', value: '/open' }).state;
    const commands = visibleCommands(state);
    assert.ok(boundedIndex(state) < Math.max(commands.length, 1));
  });
});

describe('command selection', () => {
  it('appends a trailing space for commands taking arguments', () => {
    const state = typed('/op');
    const commands = visibleCommands(state);
    const open = commands.find((command) => command.name === 'open');
    assert.ok(open);
    const after = composerReducer(state, { type: 'select-command', command: open }).state;
    assert.strictEqual(after.value, '/open ');
  });

  it('omits the trailing space for commands taking none', () => {
    const state = typed('/rig');
    const rig = visibleCommands(state).find((command) => command.name === 'rig');
    assert.ok(rig);
    const after = composerReducer(state, { type: 'select-command', command: rig }).state;
    assert.strictEqual(after.value, '/rig');
  });

  it('returns focus to the input', () => {
    const state = typed('/rig');
    const rig = visibleCommands(state).find((command) => command.name === 'rig');
    assert.ok(rig);
    const { effects } = composerReducer(state, { type: 'select-command', command: rig });
    assert.ok(effects.some((effect) => effect.type === 'focus-input'));
  });

  it('selects with Enter while the menu is open, rather than submitting', () => {
    const state = typed('/op');
    const { state: after, effects } = composerReducer(state, { type: 'key', key: 'Enter' });
    assert.ok(after.value.startsWith('/open'));
    assert.ok(!effects.some((effect) => effect.type === 'submit'), 'Enter must not submit while choosing');
  });

  it('submits with Enter once the menu is closed', () => {
    const state = typed('/open example.com');
    const { effects } = composerReducer(state, { type: 'key', key: 'Enter' });
    assert.ok(effects.some((effect) => effect.type === 'submit'));
  });

  it('does not submit on Shift+Enter', () => {
    const state = typed('a line');
    const { effects } = composerReducer(state, { type: 'key', key: 'Enter', shiftKey: true });
    assert.ok(!effects.some((effect) => effect.type === 'submit'));
  });
});

describe('note drafting', () => {
  it('commits a non-empty draft', () => {
    let state = composerReducer(INITIAL_COMPOSER_STATE, { type: 'note-start' }).state;
    state = composerReducer(state, { type: 'note-change', value: '  hello  ' }).state;
    const { state: after, effects } = composerReducer(state, { type: 'note-commit' });

    assert.strictEqual(after.noteDraft, null);
    const commit = effects.find((effect) => effect.type === 'commit-note');
    assert.ok(commit && commit.type === 'commit-note' && commit.body === 'hello');
  });

  it('cancels an empty draft without attaching', () => {
    let state = composerReducer(INITIAL_COMPOSER_STATE, { type: 'note-start' }).state;
    state = composerReducer(state, { type: 'note-change', value: '   ' }).state;
    const { state: after, effects } = composerReducer(state, { type: 'note-commit' });

    assert.strictEqual(after.noteDraft, null);
    assert.ok(!effects.some((effect) => effect.type === 'commit-note'));
  });

  it('discards the draft on Escape without committing', () => {
    let state = composerReducer(INITIAL_COMPOSER_STATE, { type: 'note-start' }).state;
    state = composerReducer(state, { type: 'note-change', value: 'unwanted' }).state;
    const { state: after, effects } = composerReducer(state, { type: 'note-key', key: 'Escape' });

    assert.strictEqual(after.noteDraft, null);
    assert.ok(!effects.some((effect) => effect.type === 'commit-note'));
  });
});

describe('note editor keyboard is separate from the composer', () => {
  function draftWith(body: string) {
    let state = composerReducer(INITIAL_COMPOSER_STATE, { type: 'change', value: 'unrelated text' }).state;
    state = composerReducer(state, { type: 'note-start' }).state;
    return composerReducer(state, { type: 'note-change', value: body }).state;
  }

  it('never emits submit from the note editor', () => {
    const state = draftWith('a note');
    for (const key of ['Enter', 'Tab', 'ArrowDown', 'Escape', 'a']) {
      const { effects } = composerReducer(state, { type: 'note-key', key });
      assert.ok(
        !effects.some((effect) => effect.type === 'submit'),
        `${key} in the note editor must not submit the composer`,
      );
    }
  });

  it('treats plain Enter as a newline, not a commit', () => {
    const state = draftWith('line one');
    const { state: after, effects } = composerReducer(state, { type: 'note-key', key: 'Enter' });
    assert.strictEqual(after.noteDraft, 'line one', 'draft is unchanged');
    assert.ok(!effects.some((effect) => effect.type === 'commit-note'));
  });

  it('commits on Cmd+Enter', () => {
    const state = draftWith('a note');
    const { effects } = composerReducer(state, { type: 'note-key', key: 'Enter', metaKey: true });
    assert.ok(effects.some((effect) => effect.type === 'commit-note'));
  });

  it('commits on Ctrl+Enter', () => {
    const state = draftWith('a note');
    const { effects } = composerReducer(state, { type: 'note-key', key: 'Enter', ctrlKey: true });
    assert.ok(effects.some((effect) => effect.type === 'commit-note'));
  });

  it('blocks main submit while a note is open', () => {
    const state = draftWith('a note');
    const { effects } = composerReducer(state, { type: 'key', key: 'Enter' });
    assert.ok(
      !effects.some((effect) => effect.type === 'submit'),
      'an unattached note must not be dropped by submitting',
    );
  });

  it('allows submit once the note is resolved', () => {
    let state = draftWith('a note');
    state = composerReducer(state, { type: 'note-cancel' }).state;
    const { effects } = composerReducer(state, { type: 'key', key: 'Enter' });
    assert.ok(effects.some((effect) => effect.type === 'submit'));
  });
});

describe('opening the menu does not move the selection', () => {
  it('keeps index 0 when the menu appears', () => {
    // Observed in Chrome: typing `/` with the cursor resting over the third row
    // selected `/run`, because the menu mounted beneath a stationary pointer and
    // mouseenter fired without anyone moving.
    const state = run(INITIAL_COMPOSER_STATE, [{ type: 'change', value: '/' }]);
    assert.strictEqual(boundedIndex(state), 0, 'a freshly opened menu starts at the first entry');
    assert.ok(visibleCommands(state).length > 1, 'there are other rows it could have jumped to');
  });

  it('keeps index 0 after filtering to a new set', () => {
    const state = run(INITIAL_COMPOSER_STATE, [
      { type: 'change', value: '/' },
      { type: 'change', value: '/r' },
    ]);
    assert.strictEqual(boundedIndex(state), 0);
  });

  it('still lets deliberate pointer movement select', () => {
    // The fix must not disable pointer navigation, only stop it firing on mount.
    const state = run(INITIAL_COMPOSER_STATE, [
      { type: 'change', value: '/' },
      { type: 'point-command', index: 2 },
    ]);
    assert.strictEqual(boundedIndex(state), 2);
  });

  it('lets the keyboard override a pointer selection', () => {
    const state = run(INITIAL_COMPOSER_STATE, [
      { type: 'change', value: '/' },
      { type: 'point-command', index: 3 },
      { type: 'key', key: 'ArrowUp' },
    ]);
    assert.strictEqual(boundedIndex(state), 2);
  });
});
