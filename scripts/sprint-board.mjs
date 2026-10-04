#!/usr/bin/env node
// Génère un tableau de bord lisible (Markdown) à partir de sprint-status.yaml.
//
//   node scripts/sprint-board.mjs            → écrit _bmad-output/implementation-artifacts/sprint-board.md
//   node scripts/sprint-board.mjs --stdout   → affiche le tableau dans le terminal
//
// Sans dépendance : le parseur ne couvre que la forme produite par les workflows BMAD
// (clés de premier niveau, table development_status, liste action_items).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = join(root, '_bmad-output/implementation-artifacts');
const statusPath = join(artifactsDir, 'sprint-status.yaml');
const epicsPath = join(root, '_bmad-output/planning-artifacts/epics.md');
const boardPath = join(artifactsDir, 'sprint-board.md');

const STORY_ORDER = ['backlog', 'ready-for-dev', 'in-progress', 'review', 'done'];
const ICONS = {
  backlog: '⚪', 'ready-for-dev': '🔵', 'in-progress': '🟡', review: '🟣', done: '✅',
  optional: '➖', open: '🔴',
};

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
  }
  return v;
}

function parseStatus(text) {
  const result = { meta: {}, development_status: {}, action_items: [] };
  let section = null;
  let item = null;
  let lastKey = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      section = value ? null : key;
      if (value) result.meta[key] = unquote(value);
      continue;
    }
    if (section === 'development_status') {
      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) result.development_status[m[1].trim()] = unquote(m[2]);
    } else if (section === 'action_items') {
      const start = line.match(/^-\s+([\w-]+):\s*(.*)$/);
      const field = line.match(/^([\w-]+):\s*(.*)$/);
      if (start) {
        item = { [start[1]]: start[2] };
        lastKey = start[1];
        result.action_items.push(item);
      } else if (field && item && indent <= 4) {
        item[field[1]] = field[2];
        lastKey = field[1];
      } else if (item && lastKey) {
        item[lastKey] += ' ' + line; // suite d'une valeur repliée sur plusieurs lignes
      }
    }
  }
  for (const it of result.action_items) for (const k of Object.keys(it)) it[k] = unquote(it[k]);
  return result;
}

function readTitles() {
  const titles = { epics: {}, stories: {} };
  if (!existsSync(epicsPath)) return titles;
  for (const line of readFileSync(epicsPath, 'utf8').split('\n')) {
    let m = line.match(/^## Epic (\d+)\s*:\s*(.+)$/);
    if (m) titles.epics[m[1]] = m[2].trim();
    m = line.match(/^### Story (\d+)\.(\d+)\s*:\s*(.+)$/);
    if (m) titles.stories[`${m[1]}-${m[2]}`] = m[3].trim();
  }
  return titles;
}

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function bar(done, total, width = 20) {
  const filled = total ? Math.round((done / total) * width) : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `\`${'█'.repeat(filled)}${'░'.repeat(width - filled)}\` ${done}/${total} (${pct} %)`;
}

const badge = (status) => `${ICONS[status] ?? '❔'} ${status}`;
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');

function buildBoard({ meta, development_status, action_items }) {
  const titles = readTitles();
  const epics = new Map();
  for (const [key, status] of Object.entries(development_status)) {
    let m = key.match(/^epic-(\d+)$/);
    if (m) { epics.set(m[1], { ...(epics.get(m[1]) ?? { stories: [] }), status }); continue; }
    m = key.match(/^epic-(\d+)-retrospective$/);
    if (m) { epics.get(m[1]).retro = status; continue; }
    m = key.match(/^(\d+)-(\d+)-(.+)$/);
    if (m) {
      const epic = epics.get(m[1]) ?? { stories: [] };
      epic.stories.push({ id: `${m[1]}.${m[2]}`, key, status,
        title: titles.stories[`${m[1]}-${m[2]}`] ?? m[3].replace(/-/g, ' ') });
      epics.set(m[1], epic);
    }
  }

  const allStories = [...epics.values()].flatMap((e) => e.stories);
  const storiesDone = allStories.filter((s) => s.status === 'done').length;
  const actionsDone = action_items.filter((a) => a.status === 'done').length;
  const current = allStories.filter((s) => !['done', 'backlog'].includes(s.status));
  const next = allStories.find((s) => s.status === 'backlog');

  const out = [];
  out.push(`# Avancement du sprint — ${meta.project ?? ''}`, '');
  out.push(`> Généré par \`node scripts/sprint-board.mjs\` depuis \`sprint-status.yaml\` (mis à jour le ${meta.last_updated ?? '?'}). Ne pas éditer à la main.`, '');
  out.push('## En un coup d\'œil', '');
  out.push('| | Avancement |', '| --- | --- |');
  out.push(`| **Stories** | ${bar(storiesDone, allStories.length)} |`);
  for (const [n, e] of epics) {
    const d = e.stories.filter((s) => s.status === 'done').length;
    out.push(`| Epic ${n} — ${cell(titles.epics[n] ?? '')} ${ICONS[e.status] ?? ''} | ${bar(d, e.stories.length)} |`);
  }
  out.push(`| **Actions de rétro** | ${bar(actionsDone, action_items.length)} |`, '');

  out.push(`**En cours :** ${current.length ? current.map((s) => `${s.id} ${s.title} (${badge(s.status)})`).join(' · ') : 'aucune story'}  `);
  out.push(`**Prochaine story :** ${next ? `${next.id} ${next.title}` : '—'}  `);
  out.push(`**Actions ouvertes :** ${action_items.filter((a) => a.status !== 'done').length}`, '');

  out.push('## Stories', '');
  for (const [n, e] of epics) {
    const d = e.stories.filter((s) => s.status === 'done').length;
    out.push(`### Epic ${n} — ${titles.epics[n] ?? ''}`, '');
    out.push(`${badge(e.status)} · ${d}/${e.stories.length} stories · rétrospective : ${badge(e.retro ?? '—')}`, '');
    out.push('| Story | Titre | Statut | Spec |', '| --- | --- | --- | --- |');
    for (const s of e.stories) {
      const spec = `spec-${stripAccents(s.key)}.md`;
      const link = existsSync(join(artifactsDir, spec)) ? `[spec](${spec})` : '—';
      out.push(`| ${s.id} | ${cell(s.title)} | ${badge(s.status)} | ${link} |`);
    }
    out.push('');
  }

  out.push('## Actions de rétrospective', '');
  const groups = [['open', 'À faire'], ['in-progress', 'En cours'], ['done', 'Faites']];
  for (const [status, label] of groups) {
    const items = action_items.filter((a) => a.status === status);
    if (!items.length) continue;
    out.push(`### ${ICONS[status]} ${label} (${items.length})`, '');
    out.push('| # | Action | Porteur | Epic | Source |', '| --- | --- | --- | --- | --- |');
    for (const a of items) {
      const num = a.id.match(/item-(\d+)/)?.[1] ?? '';
      const ref = a.ref ? `[rétro](${relative(artifactsDir, join(root, a.ref))})` : '';
      const action = cell(a.action) + (a.resolution ? `<br>↳ _${cell(a.resolution)}_` : '');
      out.push(`| ${num} | ${action} | ${cell(a.owner)} | ${a.epic} | ${ref} |`);
    }
    out.push('');
  }

  out.push('---', '', `Légende : ${STORY_ORDER.map(badge).join(' · ')} · ${badge('open')}`, '');
  return out.join('\n');
}

const board = buildBoard(parseStatus(readFileSync(statusPath, 'utf8')));
if (process.argv.includes('--stdout')) {
  process.stdout.write(board);
} else {
  writeFileSync(boardPath, board);
  console.log(`Tableau écrit dans ${relative(process.cwd(), boardPath)}`);
}
