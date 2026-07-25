process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrowserTelemetryCanvas } from '../src/components/workbench/BrowserTelemetryCanvas';

describe('BrowserTelemetryCanvas unit tests', () => {
  it('renders visual observation telemetry canvas with viewport resolution and FPS stability', () => {
    const html = renderToStaticMarkup(
      <BrowserTelemetryCanvas
        telemetry={{
          url: 'http://localhost:4000/app',
          viewportWidth: 1440,
          viewportHeight: 900,
          fps: 60,
          domElementsCount: 250,
          layoutStabilityScore: 0.99,
        }}
      />
    );

    assert.ok(html.includes('Browser Visual Observation &amp; Telemetry'));
    assert.ok(html.includes('1440 × 900 px'));
    assert.ok(html.includes('60 FPS'));
    assert.ok(html.includes('250 active elements'));
  });
});
