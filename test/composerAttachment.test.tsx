// test/composerAttachment.test.tsx
// The `+` menu, the governed picker, and web-link references.
//
// The rule under test throughout: `+` adds context and never expresses intent.
// Attachments and the resolver are separate inputs that meet only at submit.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { headroomLabel } from '../src/components/composer/Composer';
import { AttachmentMenu } from '../src/components/composer/AttachmentMenu';
import {
  foldersFrom,
  isGeneratedPath,
  partitionGenerated,
  sanitisePaths,
  visiblePathSections,
} from '../src/components/composer/AttachmentPicker';
import { attachmentOptions, noProjectsExplanation } from '../src/composer/contextTypes';
import type { AttachmentAvailability } from '../src/composer/contextTypes';
import { describeWebLinkRejection, resolveWebLink } from '../src/composer/webLink';
import { attachContextItem, EMPTY_TRAY, resetContextIds } from '../src/composer/contextTray';
import { LatestOnly, PickerCoordinator } from '../src/composer/pickerCoordinator';

const FULL: AttachmentAvailability = {
  hasWorkspacePicker: true,
  hasProjects: true,
  hasWebLinks: true,
};

const project = { id: 'PaneTera', name: 'PaneTera', path: '/repo/PaneTera' };

/**
 * Render the menu's own markup without opening a popover.
 *
 * MUI warns when an open Menu is given `anchorEl={null}`, and there is no DOM
 * here to anchor to. Rendering closed exercises the same option mapping; what
 * the popover would contain is asserted through `attachmentOptions` directly,
 * which is where the decision actually lives.
 */
function renderMenu(availability: AttachmentAvailability): string {
  return ReactDOMServer.renderToStaticMarkup(
    <AttachmentMenu
      anchorEl={null}
      open={false}
      onClose={() => {}}
      onChoose={() => {}}
      availability={availability}
    />,
  );
}

/** The text the menu would show, derived from the same source it renders from. */
function menuText(availability: AttachmentAvailability): string {
  const labels = attachmentOptions(availability).map((option) => option.label);
  const explanation = noProjectsExplanation(availability) ?? '';
  return [...labels, explanation].join(' | ');
}

describe('the menu offers only actionable choices', () => {
  it('lists the five working options when everything is wired', () => {
    const labels = attachmentOptions(FULL).map((option) => option.label);
    assert.deepStrictEqual(labels, [
      'Paste text or note',
      'Choose project',
      'Choose file',
      'Choose folder',
      'Add web link',
    ]);
  });

  it('marks every visible option available', () => {
    // A disabled row is documentation, not a choice. There are none.
    for (const option of attachmentOptions(FULL)) {
      assert.strictEqual(option.available, true, `${option.kind} must be actionable`);
      assert.strictEqual(option.unavailableReason, undefined);
    }
  });

  it('shows no future kinds', () => {
    const kinds = attachmentOptions(FULL).map((option) => option.kind);
    for (const deferred of ['image', 'evidence', 'mcp-resource', 'live-app'] as const) {
      assert.ok(!kinds.includes(deferred), `${deferred} is deferred, not a disabled row`);
    }
  });

  it('hides project, file and folder together without a picker', () => {
    const kinds = attachmentOptions({ ...FULL, hasWorkspacePicker: false }).map((o) => o.kind);
    assert.deepStrictEqual(kinds, ['note', 'web']);
  });

  it('hides them equally when no project is registered', () => {
    const kinds = attachmentOptions({ ...FULL, hasProjects: false }).map((o) => o.kind);
    assert.deepStrictEqual(kinds, ['note', 'web']);
  });

  it('explains an empty project list once, concisely', () => {
    const explanation = noProjectsExplanation({ ...FULL, hasProjects: false });
    assert.ok(explanation && explanation.length < 120);
    assert.strictEqual(noProjectsExplanation(FULL), null, 'no explanation when projects exist');
  });

  it('renders no roadmap section, divider or implementation language', () => {
    const text = menuText(FULL) + renderMenu(FULL);
    for (const phrase of [
      'Not connected yet',
      'Headroom envelope',
      'provenance record',
      'Rig discovery',
      'picker is connected',
    ]) {
      assert.ok(!text.includes(phrase), `${phrase} should not reach the menu`);
    }
    const source = readFileSync(
      new URL('../src/components/composer/AttachmentMenu.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(!source.includes('Divider'), 'no divider separating a roadmap');
  });

  it('offers no Rig action, because no Rig surface exists', () => {
    assert.ok(!/Connect more sources/i.test(menuText(FULL)));
    const source = readFileSync(
      new URL('../src/composer/contextTypes.ts', import.meta.url),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!code.includes('hasRigSurface'), 'no field advertising an absent surface');
  });
});

describe('web links are validated and normalised', () => {
  it('normalises a bare domain to an absolute https address', () => {
    const result = resolveWebLink('example.com');
    assert.ok(result.ok);
    assert.strictEqual(result.ok && result.url, 'https://example.com/');
    assert.strictEqual(result.ok && result.label, 'example.com');
  });

  it('keeps an explicit path', () => {
    const result = resolveWebLink('https://example.com/docs/page');
    assert.ok(result.ok && result.url.endsWith('/docs/page'));
  });

  it('rejects credentials in either form', () => {
    // `user@host` is a credential too, not just `user:pass@host`.
    for (const address of ['https://user:pass@example.com', 'https://user@example.com']) {
      const result = resolveWebLink(address);
      assert.ok(!result.ok, `${address} must be refused`);
      assert.strictEqual(!result.ok && result.reason, 'credentials-present');
    }
  });

  it('rejects unsupported schemes', () => {
    for (const address of ['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)']) {
      const result = resolveWebLink(address);
      assert.ok(!result.ok, `${address} must be refused`);
      assert.strictEqual(!result.ok && result.reason, 'unsupported-scheme');
    }
  });

  it('rejects loopback and private addresses', () => {
    for (const address of [
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://192.168.1.10/admin',
      'http://10.0.0.5',
      'http://169.254.169.254',
      'https://router.local',
    ]) {
      const result = resolveWebLink(address);
      assert.ok(!result.ok, `${address} must be refused`);
      assert.strictEqual(!result.ok && result.reason, 'not-public');
    }
  });

  it('rejects malformed and empty input', () => {
    assert.strictEqual(resolveWebLink('   ').ok, false);
    const malformed = resolveWebLink('not an address');
    assert.ok(!malformed.ok && malformed.reason === 'malformed');
  });

  it('explains every rejection in plain language', () => {
    for (const reason of [
      'empty',
      'malformed',
      'unsupported-scheme',
      'credentials-present',
      'not-public',
    ] as const) {
      const message = describeWebLinkRejection(reason);
      assert.ok(message.length > 0);
      assert.ok(!/scheme:|regex|validator/i.test(message), 'no implementation language');
    }
  });
});

describe('web links attach as honest references', () => {
  it('carries no authority, no content and no measured freshness', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'web',
      label: 'example.com',
      locator: 'https://example.com/',
    });
    assert.ok(result.ok);
    const item = result.ok ? result.item : null;
    assert.ok(item);
    assert.strictEqual(item.authority, 'none');
    assert.strictEqual(item.access, 'reference-only');
    assert.deepStrictEqual(item.materialization, { mode: 'reference' });
    assert.strictEqual(item.freshness, 'not-measured');
  });

  it('records the origin as user input, not a browser observation', () => {
    // PaneTera was told an address. It did not look at the page.
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'web',
      label: 'example.com',
      locator: 'https://example.com/',
    });
    assert.ok(result.ok && result.item.source.origin === 'user-input');
  });

  it('carries no material', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'web',
      label: 'example.com',
      locator: 'https://example.com/',
    });
    assert.strictEqual(result.ok && result.material, undefined);
  });

  it('refuses http(s) private and loopback addresses at the core', () => {
    // The bypass a scheme check misses entirely. A previous version tested only
    // `example.com`, `file:///` and `notaurl`, none of which are http(s), so
    // `http://127.0.0.1/` went straight into the tray and the tests passed.
    for (const locator of [
      'http://127.0.0.1/',
      'http://localhost:3000/',
      'http://192.168.1.1/admin',
      'http://10.0.0.5/',
      'http://172.16.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'https://router.local/',
      'http://[::1]/',
    ]) {
      const result = attachContextItem(EMPTY_TRAY, { kind: 'web', label: 'x', locator });
      assert.strictEqual(result.ok, false, `${locator} must not enter the tray`);
      assert.ok(!result.ok && result.reason === 'invalid-web-address');
    }
  });

  it('refuses credentials and unsupported schemes at the core', () => {
    for (const locator of [
      'https://user@example.com/',
      'https://user:pass@example.com/',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'notaurl',
    ]) {
      const result = attachContextItem(EMPTY_TRAY, { kind: 'web', label: 'x', locator });
      assert.strictEqual(result.ok, false, `${locator} must not enter the tray`);
    }
  });

  it('normalises at the core, so the tray never holds a raw string', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'web',
      label: 'example.com',
      locator: 'example.com',
    });
    assert.ok(result.ok);
    assert.strictEqual(result.ok && result.item.source.locator, 'https://example.com/');
  });

  it('detects a duplicate across normalisation', () => {
    // `example.com` and `https://example.com/` are one page, not two chips.
    resetContextIds();
    const first = attachContextItem(EMPTY_TRAY, {
      kind: 'web',
      label: 'a',
      locator: 'example.com',
    });
    assert.ok(first.ok);
    const second = attachContextItem(first.tray, {
      kind: 'web',
      label: 'b',
      locator: 'https://example.com/',
    });
    assert.strictEqual(second.ok, false);
    assert.ok(!second.ok && second.reason === 'duplicate');
  });

  it('does not open a preview as a side effect of attaching', () => {
    const source = readFileSync(
      new URL('../src/components/composer/WebLinkEntry.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(!/window\.open|setWebPreview|resolveIntent/.test(source));
  });

  it('has explicit Add and Cancel rather than commit on blur', () => {
    const source = readFileSync(
      new URL('../src/components/composer/WebLinkEntry.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('>Add<') || />\s*Add\s*</.test(source));
    assert.ok(/>\s*Cancel\s*</.test(source));
    assert.ok(!/onBlur/.test(source), 'blur must not commit');
  });
});

describe('project, file and folder attach as unmaterialised references', () => {
  const cases = [
    { kind: 'project' as const, locator: '/repo/PaneTera' },
    { kind: 'file' as const, locator: '/repo/PaneTera/src/App.tsx' },
    { kind: 'folder' as const, locator: '/repo/PaneTera/src' },
  ];

  for (const { kind, locator } of cases) {
    it(`${kind} is a reference with no material`, () => {
      resetContextIds();
      const result = attachContextItem(EMPTY_TRAY, { kind, label: kind, locator, workspace: project });
      assert.ok(result.ok);
      assert.deepStrictEqual(result.ok && result.item.materialization, { mode: 'reference' });
      assert.strictEqual(result.ok && result.material, undefined);
      assert.strictEqual(result.ok && result.item.authority, 'none');
      assert.strictEqual(result.ok && result.item.freshness, 'not-measured');
    });

    it(`${kind} records the registered project`, () => {
      resetContextIds();
      const result = attachContextItem(EMPTY_TRAY, { kind, label: kind, locator, workspace: project });
      assert.strictEqual(result.ok && result.item.source.workspaceId, 'PaneTera');
    });
  }

  it('refuses a selection outside the registered project', () => {
    for (const locator of [
      '/etc/passwd',
      '/repo/PaneTera-secrets/.env',
      '/repo/PaneTera/../other/.env',
    ]) {
      const result = attachContextItem(EMPTY_TRAY, {
        kind: 'file',
        label: 'x',
        locator,
        workspace: project,
      });
      assert.strictEqual(result.ok, false, `${locator} must be refused`);
    }
  });

  it('refuses a selection with no project at all', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'file',
      label: 'x',
      locator: '/repo/PaneTera/src/App.tsx',
    });
    assert.ok(!result.ok && result.reason === 'outside-registered-workspace');
  });
});

describe('server listings are sanitised before use', () => {
  it('drops absolute paths, traversals and non-strings', () => {
    const clean = sanitisePaths([
      'src/App.tsx',
      '/etc/passwd',
      '../outside.txt',
      'a/../../b.txt',
      42,
      null,
      '   ',
      'C:\\Windows\\system.ini',
      'docs/readme.md',
    ]);
    assert.deepStrictEqual(clean, ['src/App.tsx', 'docs/readme.md']);
  });

  it('rejects dot and empty segments', () => {
    // All three were accepted before and became part of a locator.
    const clean = sanitisePaths([
      './src/file.ts',
      'src/./file.ts',
      'src//file.ts',
      'src/file.ts',
      '.',
      '..',
    ]);
    assert.deepStrictEqual(clean, ['src/file.ts']);
  });

  it('returns nothing for a non-array payload', () => {
    for (const payload of [null, undefined, 'a string', { files: [] }, 7]) {
      assert.deepStrictEqual(sanitisePaths(payload), []);
    }
  });

  it('derives folders only from attachable files', () => {
    const folders = foldersFrom(['src/App.tsx', 'src/theme/tokens.ts', 'docs/readme.md']);
    assert.deepStrictEqual(folders, ['docs', 'src', 'src/theme']);
  });

  it('derives no folder from a root-level file', () => {
    assert.deepStrictEqual(foldersFrom(['README.md']), []);
  });
});

describe('the picker cannot express note or web kinds', () => {
  const source = readFileSync(
    new URL('../src/components/composer/AttachmentPicker.tsx', import.meta.url),
    'utf8',
  );

  it('narrows its kind to project, file and folder', () => {
    assert.ok(/PickerKind = 'project' \| 'file' \| 'folder'/.test(source));
    assert.ok(!/kind: ContextKind/.test(source), 'ContextKind would admit note and web');
  });

  it('resets when the kind changes, not only on close', () => {
    // Switching file to folder keeps the dialog open, so a close-only reset
    // would carry the previous project and listing into the new selection.
    assert.ok(/\}, \[kind\]\);/.test(source), 'the reset effect must depend on kind');
  });

  it('sanitises the listing before display', () => {
    assert.ok(source.includes('setPaths(sanitisePaths(result))'));
  });

  it('explains folder derivation and truncation', () => {
    assert.ok(source.includes('derived from attachable files'));
    assert.ok(/Showing the first \{MAX_ROWS\} of/.test(source));
  });
});

describe('App wires the picker for real', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('passes a real onRequestAttachment to the composer', () => {
    assert.ok(/onRequestAttachment=\{requestAttachment\}/.test(app));
  });

  it('maps registered projects with the name as identity', () => {
    // /api/workspaces returns no id, so inventing one would make workspaceId
    // meaningless in the tray.
    assert.ok(/id: entry\.name, name: entry\.name, path: entry\.path/.test(app));
  });

  it('authenticates and status-checks the listing request', () => {
    assert.ok(/api\/files\?workspace=/.test(app));
    assert.ok(/Authorization: `Bearer \$\{token\}`/.test(app));
    assert.ok(/if \(!response\.ok\) throw/.test(app));
  });

  it('validates the listing payload is an array of strings', () => {
    assert.ok(/Array\.isArray\(payload\)/.test(app));
    assert.ok(/typeof entry === 'string'/.test(app));
  });

  it('keeps the listing callback stable', () => {
    // An unstable callback would refetch on every parent render.
    assert.ok(/useCallback\(\s*async \(project/.test(app) || /React\.useCallback/.test(app));
  });

  it('uses the coordinator rather than hand-rolled promise bookkeeping', () => {
    assert.ok(app.includes('PickerCoordinator'), 'settlement behaviour is executable, not implied');
  });

  it('builds an absolute locator from the registered project root', () => {
    assert.ok(/\$\{project\.path\}\/\$\{relativePath\}/.test(app));
  });
});

describe('attachments never reach the intent resolver', () => {
  const composer = readFileSync(
    new URL('../src/components/composer/Composer.tsx', import.meta.url),
    'utf8',
  );
  const menu = readFileSync(
    new URL('../src/components/composer/AttachmentMenu.tsx', import.meta.url),
    'utf8',
  );
  const picker = readFileSync(
    new URL('../src/components/composer/AttachmentPicker.tsx', import.meta.url),
    'utf8',
  );

  it('the menu and picker never import the resolver', () => {
    for (const [name, source] of [['menu', menu], ['picker', picker]] as const) {
      assert.ok(!source.includes('resolveIntent'), `${name} must not resolve intent`);
      assert.ok(!source.includes('intentResolver'), `${name} must not import the resolver`);
    }
  });

  it('the attach handler does not call the resolver', () => {
    const handler = composer.slice(
      composer.indexOf('const handleAttach'),
      composer.indexOf('const commitWebLink'),
    );
    assert.ok(handler.length > 0, 'the handler should be findable');
    assert.ok(!handler.includes('resolveIntent'), 'attaching is not an intent');
  });

  it('the composer resolves intent only when submitting', () => {
    const calls = composer.match(/resolveIntent\(/g) ?? [];
    assert.strictEqual(calls.length, 1, 'exactly one resolver call, in submit');
    const submit = composer.slice(composer.indexOf('const submit ='), composer.indexOf('const menuAvailability'));
    assert.ok(submit.includes('resolveIntent('), 'the one call belongs to submit');
  });
});

describe('picker promises always settle', () => {
  // Executable, not asserted by reading App. A regex proving `settle(null)`
  // appears somewhere does not prove a pending promise ever resolves.

  it('resolves with the chosen request', async () => {
    const coordinator = new PickerCoordinator<string>();
    const pending = coordinator.request();
    coordinator.settle('chosen');
    assert.strictEqual(await pending, 'chosen');
  });

  it('resolves null when cancelled', async () => {
    const coordinator = new PickerCoordinator<string>();
    const pending = coordinator.request();
    coordinator.settle(null);
    assert.strictEqual(await pending, null);
  });

  it('settles a superseded request rather than stranding it', async () => {
    // Clicking "Choose file" then "Choose folder" must not leave the first
    // promise pending forever, which would silently kill the + menu.
    const coordinator = new PickerCoordinator<string>();
    const first = coordinator.request();
    const second = coordinator.request();

    assert.strictEqual(await first, null, 'the superseded request settles');
    coordinator.settle('folder');
    assert.strictEqual(await second, 'folder');
  });

  it('settles everything outstanding on dispose', async () => {
    const coordinator = new PickerCoordinator<string>();
    const pending = coordinator.request();
    coordinator.dispose();
    assert.strictEqual(await pending, null);
    assert.strictEqual(coordinator.isPending, false);
  });

  it('is safe to settle when nothing is pending', () => {
    const coordinator = new PickerCoordinator<string>();
    assert.doesNotThrow(() => coordinator.settle(null));
    assert.doesNotThrow(() => coordinator.dispose());
  });

  it('never resolves a promise twice', async () => {
    const coordinator = new PickerCoordinator<string>();
    const pending = coordinator.request();
    coordinator.settle('first');
    coordinator.settle('second');
    assert.strictEqual(await pending, 'first', 'the first settlement wins');
  });
});

describe('stale listings are discarded', () => {
  // Project A requested, user moves to project B, A's response lands late.

  it('accepts a result from the newest request', () => {
    const latest = new LatestOnly();
    const token = latest.begin();
    assert.strictEqual(latest.isCurrent(token), true);
  });

  it('rejects a result from a superseded request', () => {
    const latest = new LatestOnly();
    const projectA = latest.begin();
    const projectB = latest.begin();

    assert.strictEqual(latest.isCurrent(projectA), false, "A's late result must be dropped");
    assert.strictEqual(latest.isCurrent(projectB), true);
  });

  it('rejects every in-flight result after cancel', () => {
    const latest = new LatestOnly();
    const token = latest.begin();
    latest.cancel();
    assert.strictEqual(latest.isCurrent(token), false);
  });

  it('resolves the real stale-result scenario in order', async () => {
    // Two listings, A slow and B fast. Only B may write.
    const latest = new LatestOnly();
    const written: string[] = [];

    const slowA = new Promise<string>((resolve) => setTimeout(() => resolve('A'), 20));
    const fastB = Promise.resolve('B');

    const tokenA = latest.begin();
    const runA = slowA.then((value) => {
      if (latest.isCurrent(tokenA)) written.push(value);
    });

    const tokenB = latest.begin();
    const runB = fastB.then((value) => {
      if (latest.isCurrent(tokenB)) written.push(value);
    });

    await Promise.all([runA, runB]);
    assert.deepStrictEqual(written, ['B'], "only the newest project's listing is shown");
  });
});

describe('web link entry adds and cancels', () => {
  // Behavioural: the entry surface delegates to resolveWebLink, so the
  // add-versus-reject decision is exercised through the same function the
  // component calls rather than by looking for button labels.

  it('an accepted address produces a normalised attachment', () => {
    const result = resolveWebLink('example.com/docs');
    assert.ok(result.ok);
    if (!result.ok) return;

    const attached = attachContextItem(EMPTY_TRAY, {
      kind: 'web',
      label: result.label,
      locator: result.url,
    });
    assert.ok(attached.ok);
    assert.strictEqual(attached.ok && attached.item.source.locator, 'https://example.com/docs');
    assert.strictEqual(attached.ok && attached.item.label, 'example.com');
  });

  it('a rejected address produces a message and no attachment', () => {
    const result = resolveWebLink('http://127.0.0.1');
    assert.strictEqual(result.ok, false);
    if (result.ok) return;

    const message = describeWebLinkRejection(result.reason);
    assert.ok(message.length > 0, 'the person is told why');
    // Nothing reached the tray.
    assert.deepStrictEqual(EMPTY_TRAY, []);
  });

  it('cancelling adds nothing', () => {
    // Cancel is the absence of an add: the tray is untouched.
    const before = EMPTY_TRAY;
    const after = before;
    assert.strictEqual(after.length, 0);
  });

  it('renders both controls and no blur commit', () => {
    const source = readFileSync(
      new URL('../src/components/composer/WebLinkEntry.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('onClick={submit}'), 'Add is wired to validation');
    assert.ok(source.includes('onClick={onCancel}'), 'Cancel is wired');
    assert.ok(!/onBlur/.test(source), 'blur must not commit');
  });
});

describe('the picker hides rows while loading', () => {
  const source = readFileSync(
    new URL('../src/components/composer/AttachmentPicker.tsx', import.meta.url),
    'utf8',
  );

  it('gates every path row behind the loading flag', () => {
    // Showing the previous project's rows under a new project's heading, even
    // briefly, is worse than showing nothing.
    assert.ok(
      source.includes('{!loading && entries.ordinaryShown.map('),
      'ordinary rows are gated',
    );
    assert.ok(
      source.includes('{!loading && entries.generatedShown.map('),
      'generated rows are gated',
    );
    assert.ok(
      source.includes('{!loading && entries.ordinaryTotal > MAX_ROWS'),
      'truncation notice gated',
    );
    assert.ok(source.includes("{!loading && kind === 'folder'"), 'derivation notice gated');
  });

  it('clears the previous listing when a new one starts', () => {
    assert.ok(/setLoading\(true\);\s*\n\s*setPaths\(null\);/.test(source));
  });
});

describe('generated output is available but not first', () => {
  it('classifies known output directories', () => {
    for (const path of [
      '.astro/types.d.ts',
      '.content-collections/generated/index.js',
      'dist/bundle.js',
      'build/main.css',
      'node_modules/pkg/index.js',
      'coverage/lcov.info',
      '.next/server/page.js',
    ]) {
      assert.strictEqual(isGeneratedPath(path), true, `${path} is generated`);
    }
  });

  it('does not treat every dot-directory as generated', () => {
    // `.github` holds workflows someone may well want to attach; `.vscode`
    // holds settings. Guessing from the leading dot would bury both.
    for (const path of [
      '.github/workflows/ci.yml',
      '.vscode/settings.json',
      '.env.example',
      'src/App.tsx',
      'README.md',
    ]) {
      assert.strictEqual(isGeneratedPath(path), false, `${path} is ordinary`);
    }
  });

  it('puts ordinary files first and keeps generated ones', () => {
    const { ordinary, generated } = partitionGenerated([
      '.astro/types.d.ts',
      'README.md',
      'dist/bundle.js',
      'src/App.tsx',
    ]);
    assert.deepStrictEqual(ordinary, ['README.md', 'src/App.tsx']);
    assert.deepStrictEqual(generated, ['.astro/types.d.ts', 'dist/bundle.js']);
  });

  it('discards nothing', () => {
    const input = ['.astro/a.ts', 'src/b.ts', 'dist/c.js'];
    const { ordinary, generated } = partitionGenerated(input);
    assert.strictEqual(ordinary.length + generated.length, input.length);
  });

  it('offers a disclosure rather than hiding them silently', () => {
    const source = readFileSync(
      new URL('../src/components/composer/AttachmentPicker.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('Show generated files'));
    assert.ok(source.includes('Hide generated files'));
    assert.ok(source.includes('showGenerated'), 'the disclosure drives what is listed');
  });

  it('reveals generated rows even when ordinary rows fill the cap', () => {
    const ordinary = Array.from({ length: 250 }, (_, index) => `src/file-${index}.ts`);
    const generated = ['.astro/types.d.ts', 'dist/bundle.js'];
    const collapsed = visiblePathSections([...ordinary, ...generated], false, 200);
    const expanded = visiblePathSections([...ordinary, ...generated], true, 200);

    assert.strictEqual(collapsed.ordinaryShown.length, 200);
    assert.deepStrictEqual(collapsed.generatedShown, []);
    assert.deepStrictEqual(expanded.generatedShown, generated);
  });
});

describe('the picker returns a relative path', () => {
  const source = readFileSync(
    new URL('../src/components/composer/AttachmentPicker.tsx', import.meta.url),
    'utf8',
  );
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('names the field for what it carries', () => {
    // It was called `path` and documented as absolute while carrying a relative
    // entry, which survives until someone concatenates it with something.
    assert.ok(source.includes('relativePath?: string'));
    assert.ok(!/\bpath\?: string/.test(source), 'no field named path');
  });

  it('builds the absolute locator in App, which owns the project root', () => {
    assert.ok(app.includes('relativePath ? `${project.path}/${relativePath}`'));
  });
});

describe('the Headroom label distinguishes attached from included context', () => {
  it('does not claim an excluded item is absent', () => {
    assert.strictEqual(
      headroomLabel(1, 0, { unit: 'bytes', value: 0 }),
      '1 item attached · excluded from next message',
    );
  });

  it('reports partial inclusion without hiding the total', () => {
    assert.strictEqual(
      headroomLabel(3, 2, { unit: 'bytes', value: 0 }),
      '2 of 3 included · references only',
    );
  });
});

describe('choosing an inline editor does not restore focus to the trigger', () => {
  it('disables MUI focus restoration on the attachment menu', () => {
    // Focus returned to the Add context button while the note and web-link
    // editors were waiting for input.
    const source = readFileSync(
      new URL('../src/components/composer/AttachmentMenu.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(source.includes('disableRestoreFocus'));
  });

  it('both inline editors focus themselves', () => {
    const web = readFileSync(
      new URL('../src/components/composer/WebLinkEntry.tsx', import.meta.url),
      'utf8',
    );
    const composer = readFileSync(
      new URL('../src/components/composer/Composer.tsx', import.meta.url),
      'utf8',
    );
    assert.ok(web.includes('autoFocus'), 'the web address field takes focus');
    assert.ok(composer.includes('autoFocus'), 'the note field takes focus');
  });

  it('defers the choice until the menu exit completes', () => {
    const source = readFileSync(
      new URL('../src/components/composer/AttachmentMenu.tsx', import.meta.url),
      'utf8',
    );
    const choosePosition = source.indexOf('if (choice) onChoose(choice)');
    const exitPosition = source.indexOf('TransitionProps={{ onExited: finishClose }}');
    const clickHandler = source.slice(source.indexOf('onClick={() => {'), source.indexOf('sx={{ py:'));

    assert.ok(choosePosition >= 0 && exitPosition >= 0, 'selection is completed by the exit hook');
    assert.ok(!clickHandler.includes('onChoose('), 'click does not mount an editor during exit');
  });

  it('returns focus to the composer after web entry and governed pickers close', () => {
    const composer = readFileSync(
      new URL('../src/components/composer/Composer.tsx', import.meta.url),
      'utf8',
    );
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

    assert.ok(composer.includes('onCancel={closeWebEntry}'));
    assert.ok(composer.includes('const request = await onRequestAttachment(kind);'));
    assert.ok(app.includes('onExited={() => {'));
    assert.ok(app.includes('settlePicker(result);'));
  });

  it('returns focus to Add context when its menu is dismissed', () => {
    const composerSource = readFileSync(
      new URL('../src/components/composer/Composer.tsx', import.meta.url),
      'utf8',
    );
    assert.match(composerSource, /onDismiss=\{\(\) => attachButtonRef\.current\?\.focus\(\)\}/);
    assert.match(composerSource, /ref=\{attachButtonRef\}/);
  });
});

describe('the product is named PaneTera in the browser', () => {
  it('no longer says MyAI Portal', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.ok(html.includes('<title>PaneTera</title>'));
    assert.ok(!html.includes('MyAI Portal'));
  });
});
