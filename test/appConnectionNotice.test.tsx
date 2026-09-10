// test/appConnectionNotice.test.tsx

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppConnectionNotice } from '../src/components/workbench/AppConnectionNotice';

describe('AppConnectionNotice', () => {
  it('reports a disconnected application with its error and setup hint', () => {
    const html = renderToStaticMarkup(
      <AppConnectionNotice
        appName="Blender"
        connection="disconnected"
        connectionError="Could not connect to Blender on 127.0.0.1:9871"
        setupHint="Run the PaneTera bridge in Blender."
      />,
    );
    assert.ok(html.includes('data-connection="disconnected"'));
    assert.ok(html.includes('Blender is not connected'));
    assert.ok(html.includes('Could not connect to Blender on 127.0.0.1:9871'));
    assert.ok(html.includes('Run the PaneTera bridge in Blender.'));
  });

  it('shows a neutral checking state while the first observation is pending', () => {
    const html = renderToStaticMarkup(
      <AppConnectionNotice appName="REAPER" connection="connecting" setupHint="Load the bridge." />,
    );
    assert.ok(html.includes('Checking for REAPER'));
    assert.ok(!html.includes('Load the bridge.'));
  });
});
