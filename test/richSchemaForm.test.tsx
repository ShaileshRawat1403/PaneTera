process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { RichSchemaFormView } from '../src/components/nativeWorkbench/RichSchemaFormView';

describe('RichSchemaFormView unit tests', () => {
  it('renders interactive execution inputs header and fields', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RichSchemaFormView, {
        inputSchema: {
          fields: [
            { name: 'enableFeature', label: 'Enable Feature', type: 'boolean' },
            { name: 'maxCount', label: 'Max Count', type: 'number' },
            { name: 'tags', label: 'Tags', type: 'array' },
            { name: 'customCode', label: 'Custom Code', type: 'code' },
          ],
        },
        actions: [
          {
            id: 'run-action',
            label: 'Propose Run',
            kind: 'proposal',
            risk: 'safe',
            requiresApproval: true,
          },
        ],
      })
    );

    assert.match(html, /Interactive Execution Inputs/);
    assert.match(html, /Enable Feature/);
    assert.match(html, /Max Count/);
    assert.match(html, /Tags/);
    assert.match(html, /Custom Code/);
    assert.match(html, /Propose Run/);
  });

  it('renders dry run button when onDryRun prop is provided', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(RichSchemaFormView, {
        inputSchema: {
          fields: [{ name: 'name', label: 'Name', type: 'text' }],
        },
        actions: [
          {
            id: 'run-action',
            label: 'Propose Run',
            kind: 'proposal',
            risk: 'safe',
            requiresApproval: true,
          },
        ],
        onDryRun: () => {},
      })
    );

    assert.match(html, /Dry Run/);
  });
});
