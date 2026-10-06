// UX-DR1 : chaque jeton de DESIGN.md existe en propriété CSS globale, avec la même valeur,
// et chaque jeton -dark redéfinit la propriété claire correspondante.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const design = parse(
  read('../../_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/DESIGN.md').split(/^---$/m)[1],
);
const css = read('../src/styles/tokens.css');
const block = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `bloc ${selector} absent`);
  return css.slice(start, css.indexOf('}', start));
};
const declares = (cssBlock, name, value) => cssBlock.includes(`--${name}: ${value};`);
const kebab = (key) => key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

test('les couleurs claires, la typographie, les arrondis et les espacements sont tous déclarés', () => {
  const root = block(':root');
  const expected = [
    ...Object.entries(design.colors).filter(([k]) => !k.endsWith('-dark')),
    ...Object.entries(design.typography).flatMap(([name, props]) =>
      Object.entries(props).map(([p, v]) => [`typography-${name}-${kebab(p)}`, v])),
    ...Object.entries(design.rounded).map(([k, v]) => [`rounded-${k}`, v]),
    ...Object.entries(design.spacing).map(([k, v]) => [`spacing-${k}`, v]),
  ];
  const missing = expected.filter(([name, value]) => !declares(root, name, value));
  assert.deepEqual(missing, []);
});

test('le thème sombre redéfinit les mêmes propriétés, automatiquement et sur choix forcé', () => {
  const dark = Object.entries(design.colors).filter(([k]) => k.endsWith('-dark')).map(([k, v]) => [k.slice(0, -5), v]);
  assert.ok(dark.length > 0);
  for (const selector of [':root:not([data-theme="light"])', ':root[data-theme="dark"]']) {
    const missing = dark.filter(([name, value]) => !declares(block(selector), name, value));
    assert.deepEqual(missing, [], selector);
  }
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(css, /--[a-z-]+-dark:/, 'aucune propriété --*-dark (AD-10)');
});

test('elevation.css : le sombre automatique et le sombre forcé déclarent exactement la même chose', () => {
  const elevation = read('../src/styles/elevation.css').replaceAll("'", '"');
  const declarations = (selector) => {
    const start = elevation.indexOf(`${selector} {`);
    assert.ok(start >= 0, `bloc ${selector} absent de elevation.css`);
    return elevation
      .slice(start, elevation.indexOf('}', start))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('--'))
      .sort();
  };
  const auto = declarations(':root:not([data-theme="light"])');
  assert.ok(auto.length > 0);
  assert.deepEqual(declarations(':root[data-theme="dark"]'), auto);
});
