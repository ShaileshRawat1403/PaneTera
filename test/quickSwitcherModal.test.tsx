process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickSwitcherModal } from '../src/components/workbench/QuickSwitcherModal';

describe('QuickSwitcherModal unit tests', () => {
  it('renders overlay modal with command search bar and list items', () => {
    const html = renderToStaticMarkup(
      <QuickSwitcherModal
        open={true}
        onClose={() => {}}
        items={[
          { id: 'card-1', label: 'Soothsayer Workbench Card', category: 'Workbench Card', action: () => {} },
        ]}
      />
    );

    assert.ok(html.includes('Type a command or search workbench cards... (Cmd+K)'));
    assert.ok(html.includes('Soothsayer Workbench Card'));
    assert.ok(html.includes('Workbench Card'));
  });
});
