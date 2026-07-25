process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { expandUriTemplate } from '../server/rig/routes';

describe('Resource template parsing and expansion unit tests', () => {
  it('expands single and multiple template placeholders correctly', () => {
    const template = 'browser://captures/{captureId}';
    const expanded = expandUriTemplate(template, { captureId: 'cap-101' });
    assert.strictEqual(expanded, 'browser://captures/cap-101');

    const multiTemplate = 'api://orgs/{orgId}/repos/{repoId}';
    const multiExpanded = expandUriTemplate(multiTemplate, { orgId: 'acme', repoId: 'panetera' });
    assert.strictEqual(multiExpanded, 'api://orgs/acme/repos/panetera');
  });

  it('leaves missing placeholders unexpanded when parameters are incomplete', () => {
    const template = 'browser://captures/{captureId}';
    const expanded = expandUriTemplate(template, {});
    assert.strictEqual(expanded, 'browser://captures/{captureId}');
  });
});
