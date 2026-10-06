// UX-DR10 : la révélation est le seul moment mis en scène. Aucune autre animation que celles prévues par DESIGN
// (mélange de l'écran d'état, retournement des cartes), ni son, ni vibration, ni modale, ni confettis.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
const all = files(src);

test('les seuls @keyframes sont shuffle-left, shuffle-right et seat-card-flip', () => {
  const names = all
    .filter((file) => file.endsWith('.css'))
    .flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
    );
  assert.deepEqual(names.sort(), ['seat-card-flip', 'shuffle-left', 'shuffle-right']);
});

test('ni son, ni vibration, ni modale, ni confettis, ni @angular/animations dans le front', () => {
  const forbidden = [
    'vibrate',
    'new Audio',
    'AudioContext',
    '<dialog',
    'role="dialog"',
    'showModal',
    '.animate(',
    'confetti',
    '@angular/animations',
  ];
  const found = all
    .filter((file) => /\.(ts|html|css)$/.test(file) && !file.endsWith('.spec.ts'))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return forbidden.filter((word) => text.includes(word)).map((word) => `${file}: ${word}`);
    });
  assert.deepEqual(found, []);
});
