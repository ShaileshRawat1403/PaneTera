process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NativeGrantStore } from '../server/native/picker';
import { NativePickerModal } from '../src/components/workstation/NativePickerModal';

describe('Native Grant Store & Picker unit tests', () => {
  const root = process.cwd();
  const store = new NativeGrantStore(root);

  it('creates an expiring 15-minute file grant with SHA-256 digest', () => {
    const testFilePath = path.join(root, 'package.json');
    const grant = store.createGrant({
      type: 'file',
      targetPath: testFilePath,
    });

    assert.strictEqual(grant.type, 'file');
    assert.strictEqual(grant.name, 'package.json');
    assert.ok(grant.token.startsWith('grant_file_'));
    assert.ok(grant.sha256.length === 64, 'SHA-256 should be a 64-char hex string');
    assert.ok(grant.expiresAt > Date.now());
    assert.ok(grant.expiresAt <= Date.now() + 15 * 60 * 1000 + 5000);

    const verified = store.verifyGrant(grant.token);
    assert.strictEqual(verified.token, grant.token);
  });

  it('creates a folder grant with directory digest', () => {
    const testFolderPath = path.join(root, 'src');
    const grant = store.createGrant({
      type: 'folder',
      targetPath: testFolderPath,
    });

    assert.strictEqual(grant.type, 'folder');
    assert.strictEqual(grant.name, 'src');
    assert.ok(grant.token.startsWith('grant_folder_'));
    assert.ok(grant.sha256.length === 64);
  });

  it('rejects path traversal attempts', () => {
    assert.throws(
      () => store.createGrant({ type: 'file', targetPath: '../../etc/passwd' }),
      /Security Violation|Target path does not exist/
    );
  });

  it('handles explicit grant revocation', () => {
    const testFilePath = path.join(root, 'package.json');
    const grant = store.createGrant({
      type: 'file',
      targetPath: testFilePath,
    });

    const revoked = store.revokeGrant(grant.token);
    assert.strictEqual(revoked, true);

    assert.throws(() => store.verifyGrant(grant.token), /revoked/);
  });

  it('renders NativePickerModal correctly', () => {
    const html = renderToStaticMarkup(
      <NativePickerModal
        open={true}
        type="file"
        onClose={() => {}}
        onGrantCreated={() => {}}
      />
    );

    assert.ok(html.includes('Grant Explicit File Access'));
    assert.ok(html.includes('15m Expiration'));
    assert.ok(html.includes('Revocable Grant'));
  });
});
