import { expect, test, describe } from 'vitest';
import { resolveSandboxProfile } from '../src/components/workbench/LiveWorkbenchSurface';

describe('LiveWorkbenchSurface Sandbox Policy', () => {
  const diffOrigin = 'http://127.0.0.1:4000';
  const sameOrigin = 'http://127.0.0.1:4173';

  test('strict profile includes scripts and forms but not popups', () => {
    const { sandbox } = resolveSandboxProfile('http://127.0.0.1:4173/app', 'strict', diffOrigin);
    
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-forms');
    expect(sandbox).not.toContain('allow-popups');
    expect(sandbox).not.toContain('allow-same-origin');
    expect(sandbox).not.toContain('allow-top-navigation');
  });

  test('authenticated-local profile includes same-origin but not popups', () => {
    const { sandbox } = resolveSandboxProfile('http://127.0.0.1:4173/app', 'authenticated-local', diffOrigin);
    
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-forms');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toContain('allow-popups');
    expect(sandbox).not.toContain('allow-top-navigation');
  });

  test('explicitly downgrades to strict if complete origins match', () => {
    const { sandbox, downgraded } = resolveSandboxProfile('http://127.0.0.1:4173/app', 'authenticated-local', sameOrigin);
    
    // It should downgrade to strict (no same-origin)
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-forms');
    expect(sandbox).not.toContain('allow-same-origin');
    expect(sandbox).not.toContain('allow-popups');
    
    expect(downgraded).toBe(true);
  });
});
