// test/transcript.test.tsx
// The conversation transcript surface.
//
// This file previously tested `ChatMessage`, which App imported but never
// rendered. Every assertion passed against a component the product did not use,
// which is the failure mode a green suite is worst at catching: the tests were
// correct and the coverage was imaginary.
//
// It now tests `TranscriptTurn`, which App actually renders, and asserts that
// linkage structurally so the two cannot drift apart again.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import TranscriptTurn from '../src/components/transcript/TranscriptTurn';
import type { TranscriptMessage } from '../src/components/transcript/TranscriptTurn';
import { accent, status, surface } from '../src/theme/cssTokens';
import { singleFire } from '../src/components/singleFire';

function render(message: TranscriptMessage): string {
  return ReactDOMServer.renderToStaticMarkup(
    <TranscriptTurn message={message} onSelectFile={() => {}} onSuggestedAction={() => {}} />,
  );
}

const assistant: TranscriptMessage = { role: 'assistant', content: 'One two three' };
const user: TranscriptMessage = { role: 'user', content: 'A question' };

describe('the tested component is the rendered component', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('App renders TranscriptTurn', () => {
    assert.ok(app.includes('<TranscriptTurn'), 'the transcript must use the tested component');
    assert.ok(app.includes("from './components/transcript/TranscriptTurn'"));
  });

  it('App does not read per-message presentation fields', () => {
    // Rewritten from a proximity regex that matched `messages.map(` followed by
    // `<Paper` within 200 characters. That was the same over-specific shape as
    // the old gradient assertion: re-inlining the transcript starting with a
    // <Box>, or a few lines further from the map call, would have passed.
    //
    // This checks the semantic precondition instead. Any inline transcript has
    // to read the message's presentation fields, so their absence outside
    // TranscriptTurn is the property worth asserting. `message={msg}` passes
    // the whole object and reads nothing.
    const presentationFields = [
      'content',
      'role',
      'citations',
      'toolsUsed',
      'filesInspected',
      'warnings',
      'suggestedActions',
    ];

    const offenders = presentationFields.filter((field) =>
      new RegExp(`\\bmsg\\.${field}\\b`).test(app),
    );

    assert.deepStrictEqual(
      offenders,
      [],
      `App reads ${offenders.join(', ')} directly; transcript presentation belongs in TranscriptTurn`,
    );
  });

  it('passes the whole message rather than destructuring it', () => {
    assert.ok(/message=\{msg\}/.test(app), 'App should hand the turn to the component intact');
  });

  it('the retired ChatMessage component is gone', () => {
    let exists = true;
    try {
      readFileSync(new URL('../src/components/ChatMessage.tsx', import.meta.url));
    } catch {
      exists = false;
    }
    assert.strictEqual(exists, false, 'a second transcript component invites the same drift');
  });
});

describe('transcript turns', () => {
  it('labels the assistant as PaneTera, not the retired product name', () => {
    const html = render(assistant);
    assert.ok(html.includes('PaneTera'));
    assert.ok(!html.includes('PORTAL'));
  });

  it('labels the user turn', () => {
    assert.ok(render(user).includes('You'));
  });

  it('distinguishes roles by treatment, not by two loud colours', () => {
    assert.ok(render(user).includes(accent.violet), 'user turn carries the interaction accent');
    assert.ok(render(assistant).includes(surface.raised), 'assistant turn sits on a plain surface');
  });

  it('marks turns up as list items for assistive technology', () => {
    // Emotion prepends a <style> block in SSR output, so the element check
    // looks past it rather than at the start of the string.
    const withoutStyles = render(assistant).replace(/<style[\s\S]*?<\/style>/g, '');
    assert.ok(/^<li[\s>]/.test(withoutStyles), 'a transcript is a list of turns');
  });
});

describe('supporting disclosures survive the migration', () => {
  // These were the reason App could not simply adopt the old component.
  const rich: TranscriptMessage = {
    role: 'assistant',
    content: 'Checked the repository.',
    filesInspected: [{ path: 'src/App.tsx', purpose: 'entry point' }],
    toolsUsed: [{ tool: 'workspace.read', status: 'success' }],
    citations: [{ path: 'src/App.tsx', label: 'App.tsx' }],
    warnings: ['Policy denied a path outside the workspace.'],
    suggestedActions: [{ label: 'Show the diff', message: 'show the diff' }],
  };

  it('renders inspected files', () => {
    assert.ok(render(rich).includes('src/App.tsx'));
    assert.ok(render(rich).includes('entry point'));
  });

  it('renders tools used', () => {
    assert.ok(render(rich).includes('workspace.read'));
  });

  it('renders citations', () => {
    assert.ok(render(rich).includes('App.tsx'));
  });

  it('renders warnings as an alert', () => {
    const html = render(rich);
    assert.ok(html.includes('Policy denied'));
    assert.ok(html.includes('role="alert"'), 'a policy warning should be announced');
  });

  it('renders suggested actions', () => {
    assert.ok(render(rich).includes('Show the diff'));
  });

  it('uses the status vocabulary for tool outcomes', () => {
    const denied = render({
      role: 'assistant',
      content: 'x',
      toolsUsed: [{ tool: 'shell.exec', status: 'denied', reason: 'not allowlisted' }],
    });
    assert.ok(denied.includes(status.danger), 'a denied tool reads as a refusal');

    const failed = render({
      role: 'assistant',
      content: 'x',
      toolsUsed: [{ tool: 'net.fetch', status: 'failed' }],
    });
    assert.ok(failed.includes(status.brass), 'a failure is attention, not refusal');
  });

  it('omits disclosures that have no content', () => {
    const html = render(assistant);
    assert.ok(!html.includes('Citations'));
    assert.ok(!html.includes('What I inspected'));
  });
});

describe('migrated surfaces use tokens', () => {
  // Grows as Phase 3 proceeds. Surfaces absent from this list are not yet
  // migrated, which the list makes visible rather than implying completeness.
  const migrated = ['src/components/transcript/TranscriptTurn.tsx'];

  for (const file of migrated) {
    it(`${file} contains no raw colour literals`, () => {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const literals = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
      assert.deepStrictEqual(literals, [], `found: ${literals.join(', ')}`);
    });
  }

  it('uses secondary ink for supporting text rather than the disabled token', () => {
    const source = readFileSync(
      new URL('../src/components/transcript/TranscriptTurn.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('ink.secondary'));
    assert.ok(!source.includes('ink.disabled'), 'disabled ink is for disabled controls only');
  });
});

describe('the unlock surface is a real modal', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('uses Dialog rather than a positioned overlay', () => {
    // A fixed Box with a scrim let focus tab out to the workstation behind it,
    // did nothing on Escape, and did not restore focus on close. Dialog
    // provides the focus trap, aria wiring and focus restoration.
    assert.ok(/<Dialog\s[\s\S]{0,400}unlock-title/.test(app), 'unlock must be a Dialog');
  });

  it('is labelled and described for assistive technology', () => {
    assert.ok(app.includes('aria-labelledby="unlock-title"'));
    assert.ok(app.includes('aria-describedby="unlock-description"'));
  });

  it('cannot be dismissed while the app is locked', () => {
    // There is nothing usable behind it, so closing would strand the person.
    assert.ok(app.includes('disableEscapeKeyDown'));
  });

  it('masks the token and announces errors', () => {
    assert.ok(/type="password"/.test(app));
    assert.ok(/role="alert"/.test(app));
  });

  it('does not hand-roll a backdrop behind the dialog', () => {
    assert.ok(!/filter:\s*showTokenPrompt/.test(app), 'Dialog owns the backdrop');
    assert.ok(!/opacity:\s*showTokenPrompt/.test(app));
    assert.ok(!/transition:\s*'filter/.test(app), 'no unmanaged transition');
  });
});

describe('list semantics are complete', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('wraps the turns in a labelled list', () => {
    // An orphaned <li> is invalid markup and carries no list position, so the
    // component-level list item was only half the change.
    assert.ok(/component="ol"/.test(app), 'transcript turns need a list parent');
    assert.ok(/aria-label="Conversation transcript"/.test(app));
  });

  it('keeps non-turns outside the list', () => {
    // The loading indicator and the scroll sentinel are not transcript entries.
    const listOpen = app.indexOf('component="ol"');
    const listClose = app.indexOf('</Box>', app.indexOf('</TranscriptTurn>') > -1 ? app.indexOf('</TranscriptTurn>') : app.indexOf('/>', listOpen));
    const listRegion = app.slice(listOpen, listClose > listOpen ? listClose : listOpen + 900);

    assert.ok(!listRegion.includes('CircularProgress'), 'the loading indicator is not a turn');
    assert.ok(!listRegion.includes('messagesEndRef'), 'the scroll sentinel is not a turn');
  });

  it('announces the loading state politely', () => {
    assert.ok(/role="status"/.test(app));
    assert.ok(/aria-live="polite"/.test(app));
  });
});

describe('auto-scroll honours reduced motion', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('does not hardcode smooth scrolling', () => {
    // Auto-scroll fires on every reply, making it the most repeated motion in
    // the product and the most disruptive to anyone sensitive to it.
    assert.ok(!/behavior:\s*'smooth'/.test(app), 'smooth must not be unconditional');
    assert.ok(/behavior:\s*scrollBehavior\(\)/.test(app));
  });
});

describe('the transcript type excludes canvas-owned content', () => {
  const source = readFileSync(
    new URL('../src/components/transcript/TranscriptTurn.tsx', import.meta.url),
    'utf8',
  );
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  /** Strip comments: documenting an omission by name is not declaring it. */
  const strip = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it("App's Message type is the component's type, not a restatement", () => {
    // Removing the field from the component's own type was only half the fix:
    // the pipeline that builds messages still declared and populated it, so the
    // dead data was still being created and merely had nowhere to go.
    //
    // Aliasing is a stronger guarantee than checking a duplicate declaration
    // for the field, because it makes every future field agree too. If the
    // alias is ever replaced by a local interface, the fallback below still
    // enforces the original rule rather than silently passing.
    const code = strip(app);
    const alias = /type Message\s*=\s*TranscriptMessage\s*;/.test(code);

    if (alias) {
      assert.ok(true);
      return;
    }

    const declared = code.match(/interface Message \{[\s\S]*?\n\}/)?.[0] ?? '';
    assert.ok(declared.length > 0, 'Message should be aliased to TranscriptMessage or declared');
    assert.ok(!declared.includes('uiComponent'), 'a turn carries no canvas content');
  });

  it('App does not attach a component to a message', () => {
    // `uiComponent: data.uiComponent` inside an addMessage call was the write
    // that made the field dead rather than merely unused.
    assert.ok(
      !/uiComponent:\s*data\.uiComponent/.test(strip(app)),
      'a returned component belongs to the canvas, not the transcript',
    );
  });

  it('App still routes returned components to the canvas', () => {
    // The complement of the rule above. Removing the dead write must not remove
    // the live one.
    assert.ok(/setActiveComponent\(data\.uiComponent\)/.test(app));
    assert.ok(/uiComponent=\{activeComponent\}/.test(app));
  });

  it('has no uiComponent field', () => {
    // The canvas is authoritative, so interactive cards live there. The field
    // previously sat on the type with nothing rendering it, which meant a
    // proposal card could be attached to a message and silently vanish.
    //
    // Comments are stripped first: the file documents the omission by name, and
    // explaining why something is absent is not the same as declaring it.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!code.includes('uiComponent'), 'dead data should be a type error');
  });
});

describe('approval fires once, immediately', () => {
  const source = readFileSync(
    new URL('../src/components/ProposedActionCard.tsx', import.meta.url),
    'utf8',
  );
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('has no countdown or timer', () => {
    // A timer-based pseudo-undo put the consequential moment on a clock rather
    // than on the click, and offered a weaker guarantee than it appeared to.
    assert.ok(!code.includes('setCountdown'), 'no countdown state');
    assert.ok(!/setTimeout/.test(code), 'no timer before execution');
    assert.ok(!code.includes('Undo'), 'no pseudo-undo control');
  });

  it('calls onApprove directly from the approve control', () => {
    assert.ok(/onClick=\{handleApprove\}/.test(code));
    assert.ok(/onApprove\(\)/.test(code));
  });

  it('guards against double submission synchronously', () => {
    // One explicit act means exactly one proposal, even on a double click.
    // A state flag alone is not enough: it does not apply until React commits,
    // so the latch is a ref. The disabled prop only drives the styling.
    assert.ok(/useRef\(false\)/.test(code), 'the latch must be a ref');
    assert.ok(/singleFire\(submittingRef/.test(code));
    assert.ok(/disabled=\{submitting\}/.test(code));
  });

  it('renders a server-supplied reason on a blocked proposal', () => {
    // Replacing it with fixed allowlist copy discarded the specific reason a
    // command was refused, which is the part worth reading.
    assert.ok(/\{reason \?\?/.test(code), 'server reason takes precedence');
    assert.ok(code.includes('allowlist'), 'fallback copy still available');
  });
});

describe('project vocabulary reaches the user', () => {
  const shell = readFileSync(
    new URL('../src/components/workstation/WorkstationShell.tsx', import.meta.url),
    'utf8',
  );
  const audit = readFileSync(
    new URL('../src/components/workbench/AuditLogsView.tsx', import.meta.url),
    'utf8',
  );

  it('the top bar offers a project, not a workspace', () => {
    assert.ok(shell.includes('Switch project'));
    assert.ok(shell.includes('Choose project'));
    assert.ok(!/title="Switch workspace"/.test(shell));
  });

  it('the audit log labels the project in full', () => {
    // `WS:` was an abbreviation of an internal noun, twice removed from what a
    // person is looking at.
    assert.ok(!audit.includes('WS:'), 'no abbreviated internal label');
    assert.ok(audit.includes('Project:'));
  });
});

describe('approval cannot double-fire', () => {
  it('runs the action once when called twice in the same tick', () => {
    // The real hazard: setSubmitting does not take effect until React commits,
    // so two clicks inside one tick both read the old state. A ref mutates
    // synchronously and closes that window.
    const latch = { current: false };
    let calls = 0;
    const approve = () => { calls += 1; };

    singleFire(latch, approve);
    singleFire(latch, approve);
    singleFire(latch, approve);

    assert.strictEqual(calls, 1, 'one explicit act must produce one approval');
  });

  it('closes the latch before running, so a throwing action cannot re-enter', () => {
    const latch = { current: false };
    let calls = 0;
    const throwing = () => { calls += 1; throw new Error('boom'); };

    assert.throws(() => singleFire(latch, throwing));
    singleFire(latch, throwing);

    assert.strictEqual(calls, 1);
  });

  it('is the guard the approval card actually uses', () => {
    const source = readFileSync(
      new URL('../src/components/ProposedActionCard.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('singleFire(submittingRef'), 'the card must use the tested guard');
    assert.ok(source.includes("from './singleFire'"));
  });
});

describe('Activity surface vocabulary and motion', () => {
  const activity = readFileSync(
    new URL('../src/components/PreviewPanel.tsx', import.meta.url),
    'utf8',
  );
  const navigator = readFileSync(
    new URL('../src/components/workbench/WorkspaceNavigator.tsx', import.meta.url),
    'utf8',
  );

  it('is called Activity, not an intelligence feed', () => {
    assert.ok(!activity.includes('INTELLIGENCE FEED'));
    assert.ok(/>\s*Activity\s*</.test(activity));
  });

  it('speaks about projects, not workspaces', () => {
    for (const phrase of [
      'RECENT WORKSPACE COMMITS',
      'ECOSYSTEM STATUS',
      'workspace context recalled',
      'explore workspaces',
      "'WORKSPACES'",
    ]) {
      assert.ok(!activity.includes(phrase), `${phrase} is internal vocabulary`);
    }
    assert.ok(activity.includes('RECENT PROJECT COMMITS'));
    assert.ok(activity.includes('project context recalled'));
  });

  it('the project selector headings use project vocabulary', () => {
    // The earlier vocabulary test checked only the top bar and Audit, which is
    // why these two headings passed unnoticed.
    assert.ok(navigator.includes('PROJECTS ({workspaces.length})'));
    assert.ok(navigator.includes('SUGGESTED PROJECTS ({suggestions.length})'));
    assert.ok(!/>\s*WORKSPACES \(/.test(navigator));
  });

  it('auto-scroll honours reduced motion', () => {
    assert.ok(!/behavior:\s*'smooth'/.test(activity), 'smooth must not be unconditional');
    assert.ok(/behavior:\s*scrollBehavior\(\)/.test(activity));
  });

  it('uses the canonical monospace token', () => {
    assert.ok(!activity.includes('Fira Code'), 'no font PaneTera does not ship');
    assert.ok(!/fontFamily: 'monospace'/.test(activity), 'no raw monospace declarations');
    assert.ok(activity.includes('typography.mono'));
  });

  it('carries no ornamental depth or ambient glow', () => {
    // Activity is an evidence surface. A 3D tilt on hover and violet blooms
    // made it a showcase dashboard.
    assert.ok(!activity.includes('perspective'), 'no 3D tilt');
    assert.ok(!/rotate[XY]\(/.test(activity), 'no rotation');
    assert.ok(!/gradient\(/.test(activity), 'no decorative gradients');
    assert.ok(!/boxShadow: `0 0 \d+px/.test(activity), 'no glow halos');
  });
});
