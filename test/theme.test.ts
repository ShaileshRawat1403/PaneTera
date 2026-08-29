// test/theme.test.ts
// Keeps the design language honest.
//
// The contract states cool graphite surfaces, near-neutral text, restrained
// violet, brass attention, green only for meaningful success, WCAG AA
// contrast, and reduced motion support. Each of those is checkable, so each is
// checked. Design intentions stated only in prose drift; these assertions are
// what stop the palette sliding somewhere nobody decided on.
//
// This file used to assert the opposite axis -- red >= blue on every surface --
// because the palette was warm graphite. The direction was inverted on purpose:
// PaneTera's canvas carries colour-critical work, and a warm chrome casts over
// every photograph and render placed on it. The assertions below were rewritten
// to pin the new intent rather than deleted, because an unasserted palette is
// exactly how the old one drifted.

process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import {
  accent,
  ink,
  lightAccent,
  lightInk,
  lightStatus,
  lightSurface,
  status,
  surface,
  typography,
} from '../src/theme/tokens';
import { accent as cssAccent, status as cssStatus } from '../src/theme/cssTokens';
import { chipEnterStyles, duration, easing, enterStyles, scrollBehavior, transition } from '../src/theme/motion';
import { paneteraTheme, paneteraThemes } from '../src/theme/paneteraTheme';
import { statusColour as liveAppStatusColour } from '../src/components/workbench/localAppStatus';
import { riskColours } from '../src/components/ProposedActionCard';
import { toolColour } from '../src/components/transcript/TranscriptTurn';
import { workflowStatusColour, workflowStatusLabel } from '../src/components/ContentWorkflowCard';

/** Every .tsx under src/components, recursively. */
function listComponentFiles(dir: URL): URL[] {
  const out: URL[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...listComponentFiles(new URL(`${entry.name}/`, dir)));
    else if (entry.name.endsWith('.tsx')) out.push(new URL(entry.name, dir));
  }
  return out;
}

// --- WCAG relative luminance and contrast -----------------------------------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('surfaces are cool graphite, not blue', () => {
  // Two halves, and the second is the one that actually needs guarding.
  //
  //   Direction: blue >= red, so the ground never casts warm over the work
  //              sitting on the canvas.
  //   Bound:     the margin stays small, so "cool graphite" cannot drift into
  //              slate or navy. Graphite is the noun; cool is the adjective.
  //
  // Asserting only the direction would let the palette wander arbitrarily far
  // blue while still passing, which is how a neutral becomes a hue by degrees.
  const MAX_COOL_MARGIN_DARK = 12;
  const MAX_COOL_MARGIN_LIGHT = 8;

  const surfaces = Object.entries(surface).filter(([, value]) => value.startsWith('#'));

  for (const [name, hex] of surfaces) {
    it(`${name} is cool`, () => {
      const [r, , b] = rgb(hex);
      assert.ok(b >= r, `${name} (${hex}) has more red than blue, which reads warm`);
    });

    it(`${name} is graphite, not blue`, () => {
      const [r, , b] = rgb(hex);
      assert.ok(
        b - r <= MAX_COOL_MARGIN_DARK,
        `${name} (${hex}) is ${b - r} points bluer than red; above ${MAX_COOL_MARGIN_DARK} it stops reading as a neutral`,
      );
    });
  }

  const lightSurfaces = Object.entries(lightSurface).filter(([, value]) => value.startsWith('#'));

  for (const [name, hex] of lightSurfaces) {
    it(`light ${name} is cool but still neutral`, () => {
      const [r, , b] = rgb(hex);
      assert.ok(b >= r, `light ${name} (${hex}) reads warm`);
      // Tighter near white: a cast is far more visible against paper than
      // against graphite, where the same margin disappears into the dark.
      assert.ok(
        b - r <= MAX_COOL_MARGIN_LIGHT,
        `light ${name} (${hex}) is ${b - r} points blue; near white that reads as a tint`,
      );
    });
  }

  it('primary text is near-neutral rather than parchment', () => {
    const [r, , b] = rgb(ink.primary);
    assert.ok(b >= r, 'primary ink must not be warmer than its surfaces');
    assert.ok(b - r <= 8, `primary ink (${ink.primary}) must stay close to neutral white`);
  });

  it('derives the modal scrim from the base surface rather than a stray colour', () => {
    // The scrim is the base surface at opacity. Stating it as an independent
    // literal is how a palette ends up with a warm veil over a cool ground.
    const [r, g, b] = rgb(surface.base);
    assert.ok(surface.backdrop.startsWith(`rgba(${r}, ${g}, ${b},`), surface.backdrop);
    assert.ok(lightSurface.backdrop.startsWith(`rgba(${r}, ${g}, ${b},`), lightSurface.backdrop);
  });

  it('keeps warmth for the signals, where it carries meaning', () => {
    // Brass is the warmest thing in the interface on purpose: an approval
    // waiting on a person should be the warmest thing on the screen. Against
    // a cool ground that reads as heat.
    const [br, , bb] = rgb(status.brass);
    assert.ok(br > bb, `brass (${status.brass}) must be warm to stand against a cool ground`);

    const [dr, , db] = rgb(status.danger);
    assert.ok(dr > db, `danger (${status.danger}) must be warm`);

    // And the neutral must not be: healthy-and-unremarkable is the absence of
    // a signal, so it belongs with the surfaces, not with the warm marks.
    const [nr, , nb] = rgb(status.neutral);
    assert.ok(nb >= nr, `neutral (${status.neutral}) must stay cool, or "fine" starts looking like "attention"`);
  });

  it('rejects the palettes it has already moved away from', () => {
    // Left as a tripwire in both directions. Tailwind slate is too blue to be
    // graphite; the old parchment ground is the warm cast this palette exists
    // to remove.
    for (const tooBlue of ['#171d27', '#a0aec0', '#e2e8f0']) {
      const [r, , b] = rgb(tooBlue);
      assert.ok(b - r > MAX_COOL_MARGIN_DARK, `${tooBlue} is slate, not graphite`);
    }
    for (const tooWarm of ['#181614', '#F2EDE4', '#211E1B']) {
      const [r, , b] = rgb(tooWarm);
      assert.ok(r > b, `${tooWarm} was warm, which is why it was replaced`);
    }
  });
});

describe('contrast meets WCAG AA', () => {
  const backgrounds = [surface.base, surface.raised, surface.overlay, surface.sunken];

  for (const background of backgrounds) {
    it(`primary text is AA on ${background}`, () => {
      const ratio = contrast(ink.primary, background);
      assert.ok(ratio >= 4.5, `ratio ${ratio.toFixed(2)} is below 4.5:1`);
    });

    it(`secondary text is AA on ${background}`, () => {
      const ratio = contrast(ink.secondary, background);
      assert.ok(ratio >= 4.5, `ratio ${ratio.toFixed(2)} is below 4.5:1`);
    });
  }

  for (const background of backgrounds) {
    it(`muted text is AA on ${background}`, () => {
      // Held to full AA, not 3:1. Every real use of this token is 10 to 12.5px
      // helper text, so "large text only" was a rule the code did not follow.
      const ratio = contrast(ink.muted, background);
      assert.ok(ratio >= 4.5, `ratio ${ratio.toFixed(2)} is below 4.5:1`);
    });
  }

  it('keeps a separate disabled token that is not used for readable text', () => {
    // WCAG exempts disabled elements from contrast minimums, which is what
    // makes a dimmer value legitimate here and nowhere else.
    assert.notStrictEqual(ink.disabled, ink.muted);
    assert.ok(contrast(ink.muted, surface.overlay) > contrast(ink.disabled, surface.overlay));
  });

  it('accent and status colours are legible on raised surfaces', () => {
    for (const [name, colour] of [
      ['violet', accent.violet],
      ['brass', status.brass],
      ['success', status.success],
      ['danger', status.danger],
    ] as const) {
      const ratio = contrast(colour, surface.raised);
      assert.ok(ratio >= 3, `${name} ratio ${ratio.toFixed(2)} is below 3:1`);
    }
  });

  it('text on accent fills is legible', () => {
    assert.ok(contrast(ink.onAccent, accent.violet) >= 4.5);
    assert.ok(contrast(ink.onAccent, status.brass) >= 4.5);
  });
});

describe('light mode keeps the same contrast contract', () => {
  const backgrounds = [lightSurface.base, lightSurface.raised, lightSurface.overlay, lightSurface.sunken];

  for (const background of backgrounds) {
    it(`primary, secondary, and muted text are AA on ${background}`, () => {
      for (const colour of [lightInk.primary, lightInk.secondary, lightInk.muted]) {
        assert.ok(contrast(colour, background) >= 4.5);
      }
    });
  }

  it('keeps interaction and status colours legible on raised surfaces', () => {
    for (const colour of [lightAccent.violet, lightStatus.brass, lightStatus.success, lightStatus.danger]) {
      assert.ok(contrast(colour, lightSurface.raised) >= 3);
    }
  });

  it('uses a light palette without creating a second theme boundary', () => {
    assert.strictEqual(paneteraThemes.light.palette.mode, 'light');
    assert.strictEqual(paneteraThemes.light.palette.background.default, lightSurface.base);
    assert.strictEqual(paneteraThemes.dark, paneteraTheme);
  });

  it('publishes the light palette through the same component CSS variables', () => {
    const baseline = JSON.stringify(paneteraThemes.light.components?.MuiCssBaseline?.styleOverrides);
    for (const value of [lightSurface.base, lightSurface.canvas, lightInk.primary, lightAccent.violet]) {
      assert.ok(baseline.includes(value), `light theme must publish ${value}`);
    }
  });
});

describe('green means meaningful success only', () => {
  it('provides a neutral that is not green', () => {
    // Healthy-and-unremarkable must have somewhere to go that is not the
    // success colour, or green becomes ambient decoration.
    assert.notStrictEqual(status.neutral, status.success);
    const [r, g, b] = rgb(status.neutral);
    assert.ok(!(g > r && g > b), 'the neutral status colour must not read as green');
  });

  it('keeps success distinct from attention and failure', () => {
    assert.notStrictEqual(status.success, status.brass);
    assert.notStrictEqual(status.success, status.danger);
  });

  it('never paints a connection green', () => {
    // The rule that is easy to state and easy to break: connected, reachable,
    // online, available and running are all "fine", and fine is neutral. Green
    // is reserved for something that was actually verified or completed, so
    // that when a person sees green it means a thing was proven rather than
    // merely plugged in.
    //
    // This scans source rather than rendered output because the violation is a
    // conditional -- `reachable ? success : danger` -- and reaches the screen
    // only when that branch happens to be taken. A card nobody mounted during
    // review is exactly where the last nine of these were hiding.
    const componentFiles = listComponentFiles(new URL('../src/components/', import.meta.url));

    // Words that describe a connection or a liveness state, never an outcome.
    const connectionWord = /reachable|connected|online|available|=== 'Running'|toolCount > 0/;
    const greenToken = /status(?:Token)?\.success(?:Muted)?/;

    const offenders: string[] = [];
    for (const file of componentFiles) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        if (connectionWord.test(line) && greenToken.test(line)) {
          offenders.push(`${file.pathname.split('/src/')[1]}:${index + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }

    assert.deepStrictEqual(
      offenders,
      [],
      `these paint a connection green; use status.neutral for healthy-and-unremarkable:\n${offenders.join('\n')}`,
    );
  });

  it('keeps persistent chrome opaque', () => {
    // A backdrop-filter over an opaque fill blurs nothing and still costs a
    // compositing layer; over the canvas it tints the work the canvas exists to
    // show. A modal scrim is the one place the blur is the point, so the rule
    // is scoped to blur radius rather than banning the property.
    const componentFiles = listComponentFiles(new URL('../src/components/', import.meta.url));

    const offenders: string[] = [];
    for (const file of componentFiles) {
      const name = file.pathname.split('/src/')[1];
      if (name.endsWith('QuickSwitcherModal.tsx')) continue; // modal scrim
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        if (/backdropFilter/.test(line)) offenders.push(`${name}:${index + 1}  ${line.trim()}`);
      });
    }

    assert.deepStrictEqual(
      offenders,
      [],
      `persistent chrome must not blur:\n${offenders.join('\n')}`,
    );
  });
});

describe('typography', () => {
  it('leads with a system humanist sans stack', () => {
    assert.ok(/ui-sans-serif|system-ui/i.test(typography.sans));
    assert.ok(!/ui-monospace|Menlo|Consolas/i.test(typography.sans));
  });

  it('names no font PaneTera does not ship', () => {
    // The tokens once named Inter and JetBrains Mono while index.css loaded
    // Plus Jakarta Sans and Fira Code from Google Fonts, so the declared
    // typeface was never the rendered one. Local-first means system-resident.
    for (const stack of [typography.sans, typography.mono]) {
      for (const webFont of ['Inter', 'JetBrains', 'Jakarta', 'Fira']) {
        assert.ok(!stack.includes(webFont), `${webFont} is not shipped with the app`);
      }
    }
  });

  it('keeps monospace separate rather than a variant', () => {
    assert.ok(/mono|Menlo|Cascadia/i.test(typography.mono));
    assert.notStrictEqual(typography.sans, typography.mono);
  });

  it('does not shout: no weight above 700', () => {
    const weights = Object.values(paneteraTheme.typography as Record<string, any>)
      .filter((entry) => entry && typeof entry === 'object' && 'fontWeight' in entry)
      .map((entry) => Number(entry.fontWeight))
      .filter((weight) => Number.isFinite(weight));
    for (const weight of weights) {
      assert.ok(weight <= 700, `font weight ${weight} exceeds 700`);
    }
  });

  it('does not uppercase button labels', () => {
    assert.strictEqual((paneteraTheme.typography as any).button.textTransform, 'none');
  });
});

describe('spacing follows the 8px system', () => {
  it('uses 8 as the base unit', () => {
    assert.strictEqual(paneteraTheme.spacing(1), '8px');
    assert.strictEqual(paneteraTheme.spacing(2), '16px');
  });
});

describe('reduced motion is honoured', () => {
  it('returns no transition at all, not a shorter one', () => {
    // A 40ms version of the same movement is still movement. The request is to
    // not move.
    assert.strictEqual(transition(['opacity'], duration.quick, easing.standard, true), 'none');
  });

  it('still animates when motion is not reduced', () => {
    const value = transition(['opacity'], duration.quick, easing.standard, false);
    assert.ok(value.includes('opacity'));
    assert.ok(value.includes(`${duration.quick}ms`));
  });

  it('applies no animation at all when reduced', () => {
    // One policy, stated in three places that must agree: this helper, the
    // theme's CssBaseline override, and index.css. An earlier version kept a
    // 90ms fade here while both stylesheets cancelled it, so the tests
    // documented an intention the app never performed.
    assert.deepStrictEqual(enterStyles(true), {});
    assert.deepStrictEqual(chipEnterStyles(true), {});
    assert.ok(JSON.stringify(enterStyles(false)).includes('translateY'));
  });

  it('defaults to reduced when no matchMedia exists', () => {
    // Server rendering has no matchMedia. Guessing "full motion" would flash
    // movement at exactly the people who asked for none.
    const value = transition(['opacity']);
    assert.strictEqual(value, 'none');
  });

  it('carries a global reduced-motion override in the baseline', () => {
    const baseline = JSON.stringify(paneteraTheme.components?.MuiCssBaseline?.styleOverrides);
    assert.ok(baseline.includes('prefers-reduced-motion'));
    assert.ok(baseline.includes('none !important'), 'the override must cancel, not shorten');
  });

  it('publishes tokens as CSS variables for plain stylesheets', () => {
    const baseline = JSON.stringify(paneteraTheme.components?.MuiCssBaseline?.styleOverrides);
    for (const variable of ['--panetera-surface-base', '--panetera-font-sans']) {
      assert.ok(baseline.includes(variable), `${variable} must be published`);
    }
  });

  it('keeps durations short enough to feel like feedback, not animation', () => {
    for (const value of Object.values(duration)) {
      assert.ok(value <= 200, `${value}ms is long for a working surface`);
    }
  });
});

describe('theme palette matches the tokens', () => {
  it('uses violet as the interaction colour', () => {
    assert.strictEqual(paneteraTheme.palette.primary.main, accent.violet);
  });

  it('maps attention to brass rather than a second brand colour', () => {
    assert.strictEqual(paneteraTheme.palette.warning.main, status.brass);
  });

  it('sets warm graphite as the default background', () => {
    assert.strictEqual(paneteraTheme.palette.background.default, surface.base);
  });
});

describe('scroll behaviour honours reduced motion', () => {
  it('jumps when motion is reduced', () => {
    assert.strictEqual(scrollBehavior(true), 'auto');
  });

  it('glides when motion is not reduced', () => {
    assert.strictEqual(scrollBehavior(false), 'smooth');
  });

  it('defaults to jumping when no preference can be read', () => {
    // Server rendering has no matchMedia. Auto-scroll repeats on every reply,
    // so guessing "smooth" would animate at exactly the people who opted out.
    assert.strictEqual(scrollBehavior(), 'auto');
  });
});

describe('status colour is decided by outcome, not by file', () => {
  // Replaces a file-scoped check that asserted four named files contained no
  // `status.success`. That was the wrong shape twice over: a fifth surface
  // could colour a routine state green and pass, and a legitimate completed
  // outcome inside those four would have failed for the wrong reason.
  //
  // These call the real decision functions instead, so the rule travels with
  // the behaviour rather than with a list of paths.

  it('a connected gateway is neutral, never success', () => {
    // WorkstationShell renders this inline, so the property is asserted
    // through its rendered output in workstationShell.test.tsx. Here we pin
    // the token relationship it depends on.
    assert.notStrictEqual(status.neutral, status.success);
  });

  it('a reachable live application is neutral', () => {
    assert.strictEqual(liveAppStatusColour('reachable'), cssStatus.neutral);
    assert.notStrictEqual(liveAppStatusColour('reachable'), cssStatus.success);
  });

  it('a live application needing attention is brass, not danger', () => {
    assert.strictEqual(liveAppStatusColour('framing-likely-blocked'), cssStatus.brass);
    assert.strictEqual(liveAppStatusColour('invalid-configuration'), cssStatus.brass);
  });

  it('an unreachable live application is a failure', () => {
    assert.strictEqual(liveAppStatusColour('unavailable'), cssStatus.danger);
  });

  it('a low-risk classification is neutral, not success', () => {
    // "Safe" describes what a command is, not that anything succeeded.
    assert.strictEqual(riskColours('safe').colour, cssStatus.neutral);
  });

  it('a risky classification escalates through brass to danger', () => {
    assert.strictEqual(riskColours('review').colour, cssStatus.brass);
    assert.strictEqual(riskColours('dangerous').colour, cssStatus.danger);
  });

  it('a completed tool call does resolve to success', () => {
    // The rule is that green is reserved, not unusable. A tool that actually
    // finished is the case it exists for.
    assert.strictEqual(toolColour('success'), cssStatus.success);
    assert.strictEqual(toolColour('denied'), cssStatus.danger);
    assert.strictEqual(toolColour('failed'), cssStatus.brass);
  });

  it('workflow colour follows outcome and attention semantics', () => {
    assert.strictEqual(workflowStatusColour('completed'), cssStatus.success);
    assert.strictEqual(workflowStatusColour('rejected'), cssStatus.danger);
    assert.strictEqual(workflowStatusColour('awaiting_review'), cssStatus.brass);
    assert.strictEqual(workflowStatusColour('running'), cssAccent.violet);
    assert.strictEqual(workflowStatusColour('draft'), cssAccent.violet);
  });

  it('workflow statuses are translated into plain language', () => {
    assert.strictEqual(workflowStatusLabel('awaiting_review'), 'Waiting for your review');
    assert.strictEqual(workflowStatusLabel('unknown_internal_state'), 'Run status unavailable');
    assert.ok(!workflowStatusLabel('awaiting_review').includes('_'));
  });

  it('no routine state resolves to success anywhere', () => {
    const routine = [
      liveAppStatusColour('reachable'),
      liveAppStatusColour('checking'),
      riskColours('safe').colour,
    ];
    for (const colour of routine) {
      assert.notStrictEqual(colour, cssStatus.success, 'routine states must stay quiet');
    }
  });
});
