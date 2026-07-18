import { expect, test } from 'vitest';
import { localAppRegistry } from '../server/workbench/localAppRegistry';

test('validates valid loopback URLs', () => {
  expect(localAppRegistry.isValidLoopbackUrl('http://127.0.0.1:4173')).toBe(true);
  expect(localAppRegistry.isValidLoopbackUrl('http://localhost:3000')).toBe(true);
  expect(localAppRegistry.isValidLoopbackUrl('https://127.0.0.1:8080/foo/bar')).toBe(true);
});

test('rejects non-loopback or invalid URLs', () => {
  expect(localAppRegistry.isValidLoopbackUrl('http://example.com:8080')).toBe(false);
  expect(localAppRegistry.isValidLoopbackUrl('http://192.168.1.1:3000')).toBe(false);
  expect(localAppRegistry.isValidLoopbackUrl('http://localhost')).toBe(false); // missing port
  expect(localAppRegistry.isValidLoopbackUrl('http://user:pass@127.0.0.1:4173')).toBe(false); // embedded credentials
  expect(localAppRegistry.isValidLoopbackUrl('file:///etc/passwd')).toBe(false);
});
