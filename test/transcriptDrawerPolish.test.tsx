process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DrawerShell } from '../src/components/workstation/DrawerShell';
import { TranscriptTurn, TranscriptMessage } from '../src/components/transcript/TranscriptTurn';

describe('DrawerShell & TranscriptTurn Polish unit tests', () => {
  it('renders DrawerShell with aria-busy and token buttons during refresh', () => {
    const html = renderToStaticMarkup(
      <DrawerShell
        titleId="rig-title"
        title="Rig Connections"
        description="Active MCP server connections"
        onClose={() => {}}
        closeLabel="Close Rig"
        onRefresh={() => {}}
        refreshing={true}
      >
        <div>Drawer content</div>
      </DrawerShell>
    );

    assert.ok(html.includes('aria-busy="true"'), 'Drawer header should have aria-busy="true" when refreshing');
    assert.ok(html.includes('Refreshing…'), 'Should contain Refreshing… label');
    assert.ok(html.includes('aria-label="Close Rig"'), 'Should contain close button label');
  });

  it('attributes every turn to its speaker and holds the font-size floor', () => {
    const userMessage: TranscriptMessage = {
      role: 'user',
      content: 'Inspect my commit history',
    };

    const userHtml = renderToStaticMarkup(
      <TranscriptTurn message={userMessage} onSelectFile={() => {}} onSuggestedAction={() => {}} />
    );

    // Asserts attribution, not decoration. The previous version required the
    // literal '👤 You'; the chips were since rebuilt as plain labelled text,
    // in line with the shell's no-emoji rule, so the test was failing on
    // ornament that had been deliberately removed. What matters is that a
    // reader can always tell who said a turn.
    assert.ok(userHtml.includes('data-testid="actor-chip"'), 'user turn carries an actor chip');
    assert.ok(userHtml.includes('You'), 'user turn is attributed to the person');
    assert.ok(!userHtml.includes('PaneTera'), 'a user turn is never attributed to the assistant');

    const assistantMessage: TranscriptMessage = {
      role: 'assistant',
      content: 'Here are the commit details',
      citations: [{ path: '/src/index.ts', label: 'index.ts' }],
      suggestedActions: [{ label: 'Check status', message: 'git status' }],
    };

    const assistantHtml = renderToStaticMarkup(
      <TranscriptTurn message={assistantMessage} onSelectFile={() => {}} onSuggestedAction={() => {}} />
    );

    assert.ok(assistantHtml.includes('data-testid="actor-chip"'), 'assistant turn carries an actor chip');
    assert.ok(assistantHtml.includes('PaneTera'), 'assistant turn is attributed to PaneTera');
    assert.ok(assistantHtml.includes('index.ts'), 'a citation is rendered by its label');
    assert.ok(assistantHtml.includes('aria-label="Open /src/index.ts"'), 'the citation is an addressable control');
    assert.ok(assistantHtml.includes('Check status'), 'a suggested action is offered');
    // Ensure font size floor of 0.75rem / 12px
    assert.ok(!assistantHtml.includes('font-size:10px'), 'Should not contain font-size:10px');
    assert.ok(!assistantHtml.includes('font-size:11px'), 'Should not contain font-size:11px');
  });
});
