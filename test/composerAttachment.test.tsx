process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  attachmentOptions,
  noProjectsExplanation,
  type AttachmentAvailability,
} from '../src/composer/contextTypes';
import { attachContextItem, EMPTY_TRAY, resetContextIds } from '../src/composer/contextTray';
import { resolveWebLink } from '../src/composer/webLink';
import { PickerCoordinator } from '../src/composer/pickerCoordinator';

const FULL: AttachmentAvailability = {
  hasProjectPicker: true,
  hasLocalFilePicker: true,
  hasLocalFolderPicker: true,
  hasProjects: true,
  hasWebLinks: true,
  hasMcpResources: false,
};

const project = { id: 'PaneTera', name: 'PaneTera', path: '/repo/PaneTera' };
const grant = (kind: 'file' | 'folder') => ({
  id: `grant-${kind}`,
  kind,
  selectedAt: '2026-07-20T12:00:00.000Z',
});

describe('attachment choices have distinct semantics', () => {
  it('offers project and native local selections as different actions', () => {
    assert.deepStrictEqual(
      attachmentOptions(FULL).map(({ label }) => label),
      [
        'Paste text or note',
        'Choose project',
        'Choose local file…',
        'Choose local folder…',
        'Add web link',
      ],
    );
  });

  it('keeps local file and folder selection without registered projects', () => {
    assert.deepStrictEqual(
      attachmentOptions({ ...FULL, hasProjects: false }).map(({ kind }) => kind),
      ['note', 'file', 'folder', 'web'],
    );
    assert.ok(noProjectsExplanation({ ...FULL, hasProjects: false }));
  });

  it('hides each unavailable native capability independently', () => {
    const kinds = attachmentOptions({ ...FULL, hasLocalFilePicker: false }).map(({ kind }) => kind);
    assert.ok(!kinds.includes('file'));
    assert.ok(kinds.includes('folder'));
  });

  it('does not advertise MCP resources when none are enabled', () => {
    assert.ok(!attachmentOptions(FULL).some(({ kind }) => kind === 'mcp-resource'));
  });
});

describe('native selections become reference-only context grants', () => {
  it('accepts an explicitly selected local file from outside a project', () => {
    resetContextIds();
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'file',
      label: 'notes.txt',
      locator: '/Users/example/Desktop/notes.txt',
      selectionGrant: grant('file'),
    });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.strictEqual(result.item.source.origin, 'local-fs');
    assert.strictEqual(result.item.source.selectionGrantId, 'grant-file');
    assert.strictEqual(result.item.access, 'reference-only');
    assert.deepStrictEqual(result.item.materialization, { mode: 'reference' });
    assert.strictEqual(result.material, undefined);
  });

  it('accepts an explicitly selected local folder without enumerating it', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'folder',
      label: 'Research',
      locator: '/Users/example/Documents/Research',
      selectionGrant: grant('folder'),
    });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.strictEqual(result.item.access, 'reference-only');
    assert.deepStrictEqual(result.item.materialization, { mode: 'reference' });
  });

  it('rejects a file or folder with no native selection grant', () => {
    for (const kind of ['file', 'folder'] as const) {
      const result = attachContextItem(EMPTY_TRAY, {
        kind,
        label: kind,
        locator: `/tmp/${kind}`,
      });
      assert.ok(!result.ok);
    }
  });

  it('rejects a grant for the wrong kind', () => {
    const result = attachContextItem(EMPTY_TRAY, {
      kind: 'file',
      label: 'wrong',
      locator: '/tmp/wrong',
      selectionGrant: grant('folder'),
    });
    assert.ok(!result.ok);
  });

  it('keeps projects confined to the registered root', () => {
    const accepted = attachContextItem(EMPTY_TRAY, {
      kind: 'project',
      label: project.name,
      locator: project.path,
      workspace: project,
    });
    assert.ok(accepted.ok);

    const refused = attachContextItem(EMPTY_TRAY, {
      kind: 'project',
      label: 'Other',
      locator: '/repo/Other',
      workspace: project,
    });
    assert.ok(!refused.ok);
  });
});

describe('native picker wiring', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const picker = readFileSync(
    new URL('../src/components/composer/AttachmentPicker.tsx', import.meta.url),
    'utf8',
  );
  const server = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

  it('the React dialog can express only durable project selection', () => {
    assert.ok(picker.includes("export type PickerKind = 'project'"));
    assert.ok(!picker.includes("'file' | 'folder'"));
    assert.ok(!picker.includes('listPaths'));
  });

  it('file and folder call the authenticated native-selection endpoint', () => {
    assert.ok(app.includes("fetch('/api/local-selection'"));
    assert.ok(app.includes('Authorization: `Bearer ${token}`'));
    assert.ok(app.includes("kind === 'file' || kind === 'folder'"));
  });

  it('validates the complete server selection record before attaching', () => {
    for (const field of ['path', 'label', 'grantId', 'selectedAt']) {
      assert.ok(app.includes(`payload?.${field}`), `${field} must be validated`);
    }
  });

  it('the server obtains paths from osascript without invoking a shell', () => {
    const route = server.slice(
      server.indexOf("app.post('/api/local-selection'"),
      server.indexOf("app.post('/api/workspaces/browse'"),
    );
    assert.ok(route.includes('openNativePathPicker'));
    assert.ok(server.includes("execFile('osascript'"));
    assert.ok(!route.includes('exec('));
  });

  it('the server validates type, resolves symlinks, records a grant and audits it', () => {
    for (const proof of [
      "kind !== 'file' && kind !== 'folder'",
      'fs.promises.realpath(selected)',
      'info.isFile()',
      'info.isDirectory()',
      'randomUUID()',
      "event: 'local_context_selected'",
      'correlation: { grantId: grant.id }',
      'scopeFingerprint: fingerprint(grant.path)',
    ]) {
      assert.ok(server.includes(proof), `missing ${proof}`);
    }
  });
});

describe('web references remain strict', () => {
  it('normalises a public address', () => {
    const result = resolveWebLink('example.com');
    assert.ok(result.ok);
    if (result.ok) assert.strictEqual(result.url, 'https://example.com/');
  });

  it('rejects local, private and credential-bearing addresses', () => {
    for (const value of [
      'http://127.0.0.1',
      'http://192.168.1.1',
      'https://user@example.com',
    ]) {
      assert.ok(!resolveWebLink(value).ok, value);
    }
  });
});

describe('picker promises settle', () => {
  it('settles choose and cancel', async () => {
    const coordinator = new PickerCoordinator<string>();
    const chosen = coordinator.request();
    coordinator.settle('chosen');
    assert.strictEqual(await chosen, 'chosen');

    const cancelled = coordinator.request();
    coordinator.settle(null);
    assert.strictEqual(await cancelled, null);
  });

  it('settles a superseded request as null', async () => {
    const coordinator = new PickerCoordinator<string>();
    const first = coordinator.request();
    const second = coordinator.request();
    assert.strictEqual(await first, null);
    coordinator.settle('second');
    assert.strictEqual(await second, 'second');
  });
});
