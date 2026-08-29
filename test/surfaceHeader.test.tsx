// test/surfaceHeader.test.tsx
//
// The 3-zone SurfaceHeader.
//
// These assert the frozen contract rather than the markup:
//   1. Zone 2 is elastic; an empty toolset is a legitimate result.
//   2. Presence is a word in neutral ink, never a colour.
//   3. Only verified integrity earns green, and presence never tints.
//   4. A governed action is marked as governed before it is clicked.
//   5. The header is not an execution authority: actions leave as metadata.
//   6. It is a pure function of its descriptor -- no state, no reaching out.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SurfaceHeader,
  describePresence,
  presenceInk,
  actionIsGoverned,
} from '../src/components/surfaces/SurfaceHeader';
import type { SurfaceAction, SurfaceDescriptor, SurfacePresence } from '../src/surfaces/types';
import { ink, status } from '../src/theme/cssTokens';

// ─── Fixtures ─────────────────────────────────────────────────────

function makeDescriptor(overrides?: Partial<SurfaceDescriptor>): SurfaceDescriptor {
  return {
    id: 'surface-1',
    kind: 'mcp',
    identity: { title: 'REAPER', subtitle: 'reaper-smoke.rpp', icon: 'wave' },
    state: { presence: 'live' },
    actions: [],
    view: { mode: '100%', canSplit: true, canClose: true },
    renderer: { type: 'rig-structured-view', payload: {} },
    ...overrides,
  };
}

const observeAction: SurfaceAction = {
  id: 'snapshot',
  label: 'Refresh snapshot',
  behavior: 'observe',
};

const proposeAction: SurfaceAction = {
  id: 'create-track',
  label: 'Create track',
  behavior: 'propose',
  capabilityRef: { connectionId: 'reaper', capabilityId: 'create_track' },
};

const localUiAction: SurfaceAction = {
  id: 'copy',
  label: 'Copy',
  behavior: 'local-ui',
};

function render(descriptor: SurfaceDescriptor, handlers: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    <SurfaceHeader
      descriptor={descriptor}
      onSplit={() => {}}
      onClose={() => {}}
      {...handlers}
    />,
  );
}

// ─── Zone 1: Identity & Context ───────────────────────────────────

describe('SurfaceHeader — Zone 1, identity and context', () => {
  it('states identity and context', () => {
    const html = render(makeDescriptor());
    assert.ok(html.includes('REAPER'), 'the title is shown');
    assert.ok(html.includes('reaper-smoke.rpp'), 'the subtitle is shown');
  });

  it('renders presence as a word, for every value', () => {
    const values: SurfacePresence[] = ['live', 'snapshot', 'disconnected', 'unavailable'];
    const labels = values.map(describePresence);

    assert.deepStrictEqual(labels, ['Live', 'Snapshot', 'Disconnected', 'Unavailable']);
    assert.strictEqual(new Set(labels).size, 4, 'no two presences share a label');

    for (const presence of values) {
      const html = render(makeDescriptor({ state: { presence } }));
      assert.ok(
        html.includes(describePresence(presence)),
        `${presence} is stated in words`,
      );
    }
  });

  it('never renders internal presence tokens on screen', () => {
    // 'unavailable' is an internal word. The workbench toolbar already
    // established that raw status identifiers do not reach a person.
    const html = render(makeDescriptor({ state: { presence: 'unavailable' } }));
    assert.ok(!/>unavailable</.test(html), 'the raw token is not shown');
    assert.ok(html.includes('Unavailable'), 'the plain-language label is');
  });

  it('sets every presence in neutral ink, never a status colour', () => {
    // The rule this component exists to hold: a dot has one channel and has to
    // overload colour to carry four states, which is how "connected" became
    // green across the workbench. A word does not need to.
    // Widened to string[] deliberately. The tokens are literal types, so TS
    // already proves these sets are disjoint -- but the assertion stays, since
    // it is the runtime statement of the rule and survives the tokens becoming
    // plain strings.
    const statusColours: string[] = [status.success, status.brass, status.danger];

    for (const presence of ['live', 'snapshot', 'disconnected', 'unavailable'] as SurfacePresence[]) {
      const colour = presenceInk(presence);
      assert.ok(
        colour === ink.secondary || colour === ink.muted,
        `${presence} must use the neutral ink ramp, got ${colour}`,
      );
      assert.ok(
        !statusColours.includes(colour),
        `${presence} must not be painted with a status colour`,
      );
    }
  });

  it('does not put a status colour anywhere in an unverified header', () => {
    // A live, unverified surface is the common case, and it should carry no
    // colour at all.
    const html = render(makeDescriptor({ state: { presence: 'live' } }));
    for (const colour of [status.success, status.successMuted, status.brass, status.danger]) {
      assert.ok(!html.includes(colour), `an unverified header must not contain ${colour}`);
    }
  });
});

// ─── Integrity ────────────────────────────────────────────────────

describe('SurfaceHeader — integrity is its own axis', () => {
  it('marks verified provenance, and only that, in green', () => {
    const html = render(makeDescriptor({ state: { presence: 'live', integrity: 'verified' } }));
    assert.ok(html.includes('data-testid="surface-verified"'), 'the verified mark is shown');
    assert.ok(html.includes(status.success), 'the mark uses the success colour');
  });

  it('shows no mark when integrity is unverified or absent', () => {
    for (const state of [
      { presence: 'live' as const },
      { presence: 'live' as const, integrity: 'unverified' as const },
    ]) {
      const html = render(makeDescriptor({ state }));
      assert.ok(
        !html.includes('data-testid="surface-verified"'),
        'unverified surfaces claim nothing',
      );
    }
  });

  it('keeps presence and integrity independent', () => {
    // Both combinations must remain sayable: a live surface nobody verified,
    // and a disconnected snapshot that was. Collapsing them into one dot is
    // what loses the distinction the descriptor exists to state.
    const liveUnverified = render(makeDescriptor({ state: { presence: 'live' } }));
    assert.ok(liveUnverified.includes('Live'));
    assert.ok(!liveUnverified.includes('data-testid="surface-verified"'));

    const snapshotVerified = render(
      makeDescriptor({ state: { presence: 'snapshot', integrity: 'verified' } }),
    );
    assert.ok(snapshotVerified.includes('Snapshot'));
    assert.ok(snapshotVerified.includes('data-testid="surface-verified"'));
  });

  it('never claims verified just because a surface is live', () => {
    // Connectivity is not proof. This is the invariant the whole colour
    // contract rests on.
    const html = render(makeDescriptor({ state: { presence: 'live' } }));
    assert.ok(!html.includes('Verified'), 'a live surface does not claim verification');
  });
});

// ─── Zone 2: Surface Tools ────────────────────────────────────────

describe('SurfaceHeader — Zone 2, elastic surface tools', () => {
  it('renders nothing when a surface offers no tools', () => {
    // Zone 2 is elastic. A surface owes it nothing, and an empty zone is a
    // quiet, legitimate result rather than a gap to fill.
    const html = render(makeDescriptor({ actions: [] }));
    assert.ok(!html.includes('data-testid="surface-action-'), 'no action controls');
    assert.ok(html.includes('REAPER'), 'the rest of the header is unaffected');
  });

  it('renders each declared action', () => {
    const html = render(makeDescriptor({ actions: [observeAction, proposeAction, localUiAction] }));
    for (const action of [observeAction, proposeAction, localUiAction]) {
      assert.ok(
        html.includes(`data-testid="surface-action-${action.id}"`),
        `${action.id} is offered`,
      );
      assert.ok(html.includes(action.label), `${action.id} is labelled`);
    }
  });

  it('marks a governed action as governed before it is clicked', () => {
    // A person should be able to see which controls will cost them a decision
    // without having to press one to find out.
    assert.strictEqual(actionIsGoverned('propose'), true);
    assert.strictEqual(actionIsGoverned('observe'), false);
    assert.strictEqual(actionIsGoverned('local-ui'), false);

    const html = render(makeDescriptor({ actions: [observeAction, proposeAction] }));
    assert.ok(html.includes(status.brass), 'the governed action carries the attention colour');
    assert.ok(
      html.includes('needs your approval'),
      'and says so, rather than relying on colour alone',
    );
  });

  it('leaves observe and local-ui equally quiet', () => {
    // Reading a page and copying a value are both free, so neither is dressed
    // up as consequential.
    const observeOnly = render(makeDescriptor({ actions: [observeAction] }));
    const localOnly = render(makeDescriptor({ actions: [localUiAction] }));
    for (const html of [observeOnly, localOnly]) {
      assert.ok(!html.includes(status.brass), 'an ungoverned action is not brass');
      assert.ok(!html.includes('needs your approval'));
    }
  });

  it('exposes the behavior class on each control', () => {
    const html = render(makeDescriptor({ actions: [observeAction, proposeAction, localUiAction] }));
    for (const behavior of ['observe', 'propose', 'local-ui']) {
      assert.ok(html.includes(`data-behavior="${behavior}"`), `${behavior} is stated`);
    }
  });
});

// ─── Zone 3: View Controls ────────────────────────────────────────

describe('SurfaceHeader — Zone 3, view controls', () => {
  it('shows the view mode when the descriptor declares one', () => {
    const html = render(makeDescriptor({ view: { mode: 'Markdown' } }));
    assert.ok(html.includes('Markdown'));
  });

  it('offers split and close only when the descriptor allows them', () => {
    const both = render(makeDescriptor({ view: { canSplit: true, canClose: true } }));
    assert.ok(both.includes('aria-label="Open beside"'));
    assert.ok(both.includes('aria-label="Close surface"'));

    const neither = render(makeDescriptor({ view: { canSplit: false, canClose: false } }));
    assert.ok(!neither.includes('aria-label="Open beside"'));
    assert.ok(!neither.includes('aria-label="Close surface"'));
  });

  it('offers no control the host cannot handle', () => {
    // canSplit with no onSplit would render a control that does nothing.
    const html = renderToStaticMarkup(
      <SurfaceHeader descriptor={makeDescriptor({ view: { canSplit: true, canClose: true } })} />,
    );
    assert.ok(!html.includes('aria-label="Open beside"'));
    assert.ok(!html.includes('aria-label="Close surface"'));
  });

  it('survives a descriptor with no view block at all', () => {
    const html = render(makeDescriptor({ view: undefined }));
    assert.ok(html.includes('REAPER'), 'the header still renders');
    assert.ok(!html.includes('aria-label="Close surface"'));
  });
});

// ─── The invariant that matters most ──────────────────────────────

describe('SurfaceHeader — not a second execution authority', () => {
  it('reports the action rather than performing it', () => {
    // The contract is explicit that surface header actions must never become a
    // second execution authority. The header hands the host metadata and stops
    // there; the host routes a propose through proposal → approval →
    // invocation.
    const seen: SurfaceAction[] = [];
    renderToStaticMarkup(
      <SurfaceHeader
        descriptor={makeDescriptor({ actions: [proposeAction] })}
        onAction={(action) => seen.push(action)}
      />,
    );
    // Static render fires no handlers, which is itself the point: nothing
    // happens without the host.
    assert.deepStrictEqual(seen, [], 'rendering executes nothing');
  });

  it('holds no capability of its own', () => {
    // Enforced against source, because this is the kind of invariant that
    // erodes one convenient import at a time. If the header can fetch, reach a
    // store, or invoke Rig, it has become an execution authority regardless of
    // what its comments claim.
    const source = readFileSync(
      new URL('../src/components/surfaces/SurfaceHeader.tsx', import.meta.url),
      'utf8',
    );

    for (const forbidden of ['fetch(', 'useState', 'useEffect', 'useReducer', 'localStorage']) {
      assert.ok(
        !source.includes(forbidden),
        `SurfaceHeader must not use ${forbidden} — it is a pure projection`,
      );
    }

    // It may import types and presentation, and nothing else.
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    const allowed = /^(react|@mui\/|\.\.\/\.\.\/theme\/|\.\.\/\.\.\/surfaces\/types$)/;
    for (const specifier of imports) {
      assert.ok(
        allowed.test(specifier),
        `SurfaceHeader imports ${specifier}, which is not a type or presentation module`,
      );
    }
  });

  it('is a pure function of its descriptor', () => {
    // Same descriptor in, same markup out, and the input is never mutated.
    const descriptor = makeDescriptor({ actions: [observeAction, proposeAction] });
    const snapshot = JSON.stringify(descriptor);

    const first = render(descriptor);
    const second = render(descriptor);

    assert.strictEqual(first, second, 'rendering is deterministic');
    assert.strictEqual(JSON.stringify(descriptor), snapshot, 'the descriptor is not mutated');
  });

  it('renders every surface kind through the one contract', () => {
    // The point of a single header: a browser page, a local app, an MCP view
    // and an artifact all wear the same spatial contract.
    const kinds: SurfaceDescriptor['kind'][] = ['browser', 'local-app', 'mcp', 'artifact', 'workspace'];
    for (const kind of kinds) {
      const html = render(makeDescriptor({ kind }));
      assert.ok(html.includes('data-testid="surface-presence"'), `${kind} states presence`);
      assert.ok(html.includes('REAPER'), `${kind} states identity`);
    }
  });
});
