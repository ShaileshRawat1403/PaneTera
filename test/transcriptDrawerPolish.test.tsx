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

  it('renders TranscriptTurn with actor attribution chip and font size floors', () => {
    const userMessage: TranscriptMessage = {
      role: 'user',
      content: 'Inspect my commit history',
    };

    const userHtml = renderToStaticMarkup(
      <TranscriptTurn message={userMessage} onSelectFile={() => {}} onSuggestedAction={() => {}} />
    );

    assert.ok(userHtml.includes('👤 You'), 'Should render user actor attribution chip');

    const assistantMessage: TranscriptMessage = {
      role: 'assistant',
      content: 'Here are the commit details',
      citations: [{ path: '/src/index.ts', label: 'index.ts' }],
      suggestedActions: [{ label: 'Check status', message: 'git status' }],
    };

    const assistantHtml = renderToStaticMarkup(
      <TranscriptTurn message={assistantMessage} onSelectFile={() => {}} onSuggestedAction={() => {}} />
    );

    assert.ok(assistantHtml.includes('⚡ PaneTera'), 'Should render assistant actor attribution chip');
    assert.ok(assistantHtml.includes('📄 index.ts'), 'Should render citation chip with icon');
    assert.ok(assistantHtml.includes('→ Check status'), 'Should render suggested action chip with arrow icon');
    // Ensure font size floor of 0.75rem / 12px
    assert.ok(!assistantHtml.includes('font-size:10px'), 'Should not contain font-size:10px');
    assert.ok(!assistantHtml.includes('font-size:11px'), 'Should not contain font-size:11px');
  });
});
