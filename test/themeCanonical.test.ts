// test/themeCanonical.test.ts
// One theme, mounted once.
//
// App previously defined `paneteraStudioTheme` with its own ThemeProvider and
// CssBaseline, which overrode the root theme entirely. The contract's warm
// tokens existed but never reached the screen: the app rendered a cool palette
// with different fonts, and the token file was effectively dead code.
//
// A duplicate provider is invisible in review and invisible at runtime until
// someone wonders why a colour will not change, so it is asserted structurally.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/**
 * Files permitted to do the thing being guarded against.
 *
 * Deliberately narrow, and deliberately per-symbol rather than a blanket
 * exemption: `paneteraTheme.ts` is the only module that may call `createTheme`,
 * and `main.tsx` is the only one that may mount a provider. Neither is excused
 * from the other's rule.
 */
const CREATE_THEME_ALLOWED = ['theme/paneteraTheme.ts'];
const PROVIDER_ALLOWED = ['main.tsx'];

function sourceFiles(dir: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

function read(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

/** Strip comments so prose mentioning a symbol does not read as a use of it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function offenders(pattern: RegExp, allowed: string[]): string[] {
  return sourceFiles()
    .map((file) => ({ file, relative: path.relative(SRC, file) }))
    .filter(({ relative }) => !allowed.includes(relative.split(path.sep).join('/')))
    .filter(({ file }) => pattern.test(code(readFileSync(file, 'utf8'))))
    .map(({ relative }) => relative);
}

describe('exactly one theme exists', () => {
  // Scanned across every .ts and .tsx under src, not a hand-listed pair. The
  // competing theme lived in App.tsx, but the next one will not, and a guard
  // that only looks where the last mistake happened is not a guard.
  it('has source files to scan', () => {
    assert.ok(sourceFiles().length > 20, 'the scan must actually be finding files');
  });

  it('calls createTheme only in the canonical theme module', () => {
    assert.deepStrictEqual(
      offenders(/\bcreateTheme\b/, CREATE_THEME_ALLOWED),
      [],
      'createTheme belongs in src/theme/paneteraTheme.ts alone',
    );
  });

  it('mounts ThemeProvider only at the root', () => {
    assert.deepStrictEqual(
      offenders(/\bThemeProvider\b/, PROVIDER_ALLOWED),
      [],
      'a nested ThemeProvider silently overrides the canonical theme',
    );
  });

  it('renders CssBaseline only at the root', () => {
    assert.deepStrictEqual(offenders(/\bCssBaseline\b/, PROVIDER_ALLOWED), []);
  });

  it('does not exempt the theme module from the provider rule', () => {
    // The exclusions are per-symbol on purpose. If paneteraTheme.ts ever mounts
    // a provider, that is still a second mount point.
    assert.ok(!PROVIDER_ALLOWED.includes('theme/paneteraTheme.ts'));
    assert.ok(!CREATE_THEME_ALLOWED.includes('main.tsx'));
  });

  it('renders exactly one CssBaseline at the root', () => {
    const occurrences = read('src/main.tsx').match(/<CssBaseline/g) ?? [];
    assert.strictEqual(occurrences.length, 1);
  });

  it('mounts the canonical theme by name', () => {
    const main = read('src/main.tsx');
    assert.ok(main.includes('paneteraTheme'));
    assert.ok(main.includes("from './theme/paneteraTheme'"));
  });
});

describe('global stylesheet defers to the theme', () => {
  const raw = read('src/index.css');
  // Comments are stripped before scanning: the file documents which values were
  // removed and why, and naming a colour in prose is not using it.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

  it('makes no third-party font request', () => {
    // A local-first product should not block first paint on a network fetch,
    // and the imported faces disagreed with the token stack anyway. Checked
    // against the raw file, since an @import inside a comment is still inert
    // but an @import anywhere else is not.
    assert.ok(!/@import\s+url\(/.test(raw), 'no remote stylesheet imports');
    assert.ok(!css.includes('fonts.googleapis.com'), 'remove the Google Fonts import');
  });

  it('takes colour from CSS variables rather than literals', () => {
    // Fallbacks after a var() are permitted; bare literals are not.
    const withoutVars = css.replace(/var\([^)]*\)/g, '');
    const literals = withoutVars.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    assert.deepStrictEqual(literals, [], `unexpected colour literals: ${literals.join(', ')}`);
  });

  it('runs no looping animation', () => {
    // Continuous motion with no state change behind it is decoration that never
    // stops asking for attention.
    assert.ok(!/animation:[^;]*infinite/.test(css), 'no infinite animations');
    assert.ok(!css.includes('pulseGlow'), 'the pulsing glow was decorative');
    assert.ok(!/@keyframes\s+blink/.test(css), 'the blinking caret looped forever');
  });

  it('carries the same reduced-motion policy as the theme', () => {
    assert.ok(css.includes('prefers-reduced-motion'));
    assert.ok(/animation:\s*none\s*!important/.test(css), 'cancel motion, do not shorten it');
  });

  it('drops the cool ground and ambient glows', () => {
    assert.ok(!css.includes('08090b'), 'the old cool ground is gone');
    assert.ok(!css.includes('radial-gradient'), 'ambient glows fought the warm surfaces');
  });
});
