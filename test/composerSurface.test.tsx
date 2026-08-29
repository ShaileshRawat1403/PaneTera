// test/composerSurface.test.tsx
// Rendered-surface checks: ARIA wiring for the combobox pattern, chip
// disclosure, and truthful attachment availability.
//
// Rendered via ReactDOMServer, matching the existing workstationShell test.
// Behaviour that needs a live DOM is covered by composerMachine.test.ts instead.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Composer } from '../src/components/composer/Composer';
import { ContextChips } from '../src/components/composer/ContextChips';
import { SlashMenu } from '../src/components/composer/SlashMenu';
import { attachmentOptions, SUPPORTED_CONTEXT_KINDS } from '../src/composer/contextTypes';
import type { ContextItem } from '../src/composer/contextTypes';
import { SLASH_COMMANDS } from '../src/composer/slashCommands';

function render(node: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(node);
}

/** Visible text only: style and script contents stripped, then tags removed. */
function renderedText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

describe('composer input accessibility', () => {
  it('exposes the combobox pattern', () => {
    const html = render(<Composer onSubmit={() => {}} />);
    assert.ok(html.includes('role="combobox"'));
    assert.ok(html.includes('aria-autocomplete="list"'));
    assert.ok(html.includes('aria-label="Message PaneTera"'));
  });

  it('labels the attachment and send controls', () => {
    const html = render(<Composer onSubmit={() => {}} />);
    assert.ok(html.includes('aria-label="Add context"'));
    assert.ok(html.includes('aria-label="Send message"'));
  });

  it('reports the menu as collapsed when nothing is typed', () => {
    const html = render(<Composer onSubmit={() => {}} />);
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(!html.includes('aria-activedescendant'));
  });

  it('states honestly that no context is attached', () => {
    const html = render(<Composer onSubmit={() => {}} />);
    assert.ok(html.includes('No context attached'));
  });

  it('shows no token count or capacity percentage', () => {
    // Scoped to rendered text, not the whole document: MUI injects a style
    // block containing declarations like width:100%, which a naive percentage
    // scan would match.
    const text = renderedText(render(<Composer onSubmit={() => {}} />));
    assert.ok(!/\d+\s*tokens/i.test(text), 'no token count without a tokenizer');
    assert.ok(!/%\s*(of|full|used)/i.test(text), 'no capacity percentage');
    assert.ok(!/\d+\s*%/.test(text), 'no bare percentage figure');
  });
});

describe('slash menu as a listbox', () => {
  it('marks options and the active descendant', () => {
    const html = render(
      <SlashMenu
        commands={[...SLASH_COMMANDS]}
        activeIndex={1}
        onSelect={() => {}}
        onPointIndex={() => {}}
        listId="menu"
        optionId={(index) => `menu-option-${index}`}
      />,
    );
    assert.ok(html.includes('role="listbox"'));
    assert.ok(html.includes('role="option"'));
    assert.ok(html.includes('id="menu-option-1"'));
    assert.ok(html.includes('aria-selected="true"'));
  });

  it('renders an empty state rather than nothing', () => {
    const html = render(
      <SlashMenu
        commands={[]}
        activeIndex={0}
        onSelect={() => {}}
        onPointIndex={() => {}}
        listId="menu"
        optionId={(index) => `menu-option-${index}`}
      />,
    );
    assert.ok(html.includes('No matching actions'));
  });
});

describe('attachment availability is truthful', () => {
  // Availability now decides whether a row exists at all, so the detailed
  // behaviour lives in composerAttachment.test.tsx. What matters here is that
  // the composer renders the menu from computed availability rather than a
  // fixed list.
  const FULL = {
    hasProjectPicker: true,
    hasLocalFilePicker: true,
    hasLocalFolderPicker: true,
    hasProjects: true,
    hasWebLinks: true,
    hasMcpResources: false,
  };

  it('offers only options that can be acted on', () => {
    for (const option of attachmentOptions(FULL)) {
      assert.strictEqual(option.available, true);
    }
  });

  it('never offers a kind the core API would reject', () => {
    for (const option of attachmentOptions(FULL)) {
      assert.ok(
        SUPPORTED_CONTEXT_KINDS.includes(option.kind),
        `${option.kind} is offered but unsupported by the core API`,
      );
    }
  });

  it('keeps notes available with no host capability at all', () => {
    const bare = attachmentOptions({
      hasProjectPicker: false,
      hasLocalFilePicker: false,
      hasLocalFolderPicker: false,
      hasProjects: false,
      hasWebLinks: false,
      hasMcpResources: false,
    });
    assert.deepStrictEqual(bare.map((option) => option.kind), ['note']);
  });
});

describe('composer surfaces use theme tokens, not literals', () => {
  // Hardcoded colours are how a design language drifts. These files were the
  // origin of the cool-grey palette the theme replaced.
  // Expands with each migrated surface. A file joins this list when it is
  // migrated, so the scan tracks progress rather than asserting a finished
  // state that does not exist yet.
  const componentFiles = [
    'src/components/composer/Composer.tsx',
    'src/components/composer/SlashMenu.tsx',
    'src/components/composer/AttachmentMenu.tsx',
    'src/components/composer/ContextChips.tsx',
    'src/components/workstation/WorkstationShell.tsx',
    'src/components/workbench/WorkbenchFailureState.tsx',
    'src/components/workbench/WorkbenchEmptyState.tsx',
    'src/components/workbench/WorkspaceNavigator.tsx',
    'src/components/workbench/AuditLogsView.tsx',
    'src/components/ProposedActionCard.tsx',
    'src/components/PreviewPanel.tsx',
    'src/components/composer/AttachmentPicker.tsx',
    'src/components/composer/WebLinkEntry.tsx',
    'src/components/ContentWorkflowCard.tsx',
  ];

  // WebPreviewSurface is migrated but keeps two deliberate literals: the
  // iframe's white ground is the previewed site's own canvas, not PaneTera's,
  // and tinting it would misrepresent someone else's page as part of this
  // product. Asserted narrowly rather than exempting the file.
  it('WebPreviewSurface keeps only the previewed site\'s own ground', () => {
    const source = readFileSync(
      new URL('../src/components/workbench/WebPreviewSurface.tsx', import.meta.url),
      'utf8',
    );
    const literals = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    assert.deepStrictEqual(literals, ['#ffffff', '#ffffff'], `found: ${literals.join(', ')}`);
  });

  it('InteractiveComponent keeps only the embedded application ground', () => {
    const source = readFileSync(
      new URL('../src/components/InteractiveComponent.tsx', import.meta.url),
      'utf8',
    );
    const literals = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    assert.deepStrictEqual(literals, ['#fff'], `found: ${literals.join(', ')}`);
    assert.match(source, /<iframe[\s\S]*background: '#fff'/, 'white belongs only to embedded content');
  });

  for (const file of componentFiles) {
    it(`${file} contains no raw colour literals`, () => {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const literals = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
      // Filter out CSS variable references like rgba(var(--panetera-...), ...)
      const rawLiterals = literals.filter((l) => !l.includes('var(--panetera-'));
      assert.deepStrictEqual(
        rawLiterals,
        [],
        `${file} should read colours from src/theme/tokens.ts, found: ${rawLiterals.join(', ')}`,
      );
    });
  }
});

describe('context chips disclose provenance', () => {
  const item: ContextItem = {
    id: 'ctx-1',
    kind: 'folder',
    label: 'src',
    source: { origin: 'workspace-mcp', locator: '/repo/src', workspaceId: 'w1' },
    access: 'read-scoped',
    authority: 'none',
    materialization: { mode: 'reference' },
    freshness: 'not-measured',
    included: true,
  };

  it('states inclusion in the accessible name', () => {
    const html = render(
      <ContextChips items={[item]} onRemove={() => {}} onToggleIncluded={() => {}} />,
    );
    assert.ok(html.includes('included'));
    assert.ok(html.includes('src'));
  });

  it('marks an excluded chip as excluded', () => {
    const html = render(
      <ContextChips
        items={[{ ...item, included: false }]}
        onRemove={() => {}}
        onToggleIncluded={() => {}}
      />,
    );
    assert.ok(html.includes('excluded'));
  });

  it('renders a labelled list', () => {
    const html = render(
      <ContextChips items={[item]} onRemove={() => {}} onToggleIncluded={() => {}} />,
    );
    assert.ok(html.includes('aria-label="Attached context"'));
  });

  it('renders nothing when the tray is empty', () => {
    const html = render(<ContextChips items={[]} onRemove={() => {}} onToggleIncluded={() => {}} />);
    assert.strictEqual(html, '');
  });
});
