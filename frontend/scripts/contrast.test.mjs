// UX-DR2 : contrastes WCAG 2.2 AA des couples de jetons, dans les deux thèmes (valeurs lues dans tokens.css).
// Texte : au moins 4,5:1. Éléments graphiques (contours, soulignement, pastilles, carte choisie) : au moins 3:1.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)),
  'utf8',
);
const colors = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `bloc ${selector} absent`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+): (#[0-9A-Fa-f]{6});/g)].map(([, name, hex]) => [name, hex]),
  );
};
const light = colors(':root');
const themes = {
  clair: light,
  sombre: { ...light, ...colors(':root[data-theme="dark"]') },
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** [premier plan, fond] */
const TEXT = [
  ['foreground', 'background'],
  ['foreground', 'surface'],
  // Couple sur lequel repose le lien « Je veux voter » (.link-button de cards.css, sur la main surface-muted).
  ['foreground', 'surface-muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'surface'],
  ['muted-foreground', 'surface-muted'],
  ['foreground', 'primary-soft'],
  ['primary-foreground', 'primary'],
  ['card-ink', 'card-face'],
  ['success', 'success-soft'],
  ['warning', 'warning-soft'],
  ['danger', 'background'],
  ['danger', 'surface'],
];
const GRAPHIC = [
  ['primary', 'surface'],
  ['primary', 'surface-muted'],
  ['primary', 'primary-soft'],
  ['card-ink', 'card-face'],
  ['presence-online', 'surface'],
  ['presence-offline', 'surface'],
];

const failures = (pairs, palette, min) =>
  pairs
    .map(([fg, bg]) => [fg, bg, ratio(palette[fg], palette[bg])])
    .filter(([, , r]) => r < min)
    .map(([fg, bg, r]) => `${fg} sur ${bg} : ${r.toFixed(2)}:1`);

test('le calcul de contraste suit WCAG', () => {
  assert.equal(ratio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(ratio('#FFFFFF', '#FFFFFF'), 1);
});

test('le thème sombre redéfinit toutes les couleurs comparées', () => {
  const dark = colors(':root[data-theme="dark"]');
  const used = new Set([...TEXT, ...GRAPHIC].flat());
  assert.deepEqual(
    [...used].filter((name) => !dark[name] || !light[name]),
    [],
  );
});

for (const [name, palette] of Object.entries(themes)) {
  test(`thème ${name} : texte au moins 4,5:1`, () => {
    assert.deepEqual(failures(TEXT, palette, 4.5), []);
  });

  test(`thème ${name} : éléments graphiques au moins 3:1`, () => {
    assert.deepEqual(failures(GRAPHIC, palette, 3), []);
  });
}
