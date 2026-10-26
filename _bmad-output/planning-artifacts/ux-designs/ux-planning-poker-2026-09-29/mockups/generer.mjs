#!/usr/bin/env node
/*
 * Génère les maquettes à partir de l'état réel du front : `node generer.mjs` depuis ce dossier (ou d'ailleurs).
 *
 * - app.css : copie de frontend/src/styles.css et de ses @import, sans retouche. Les écrans ont donc exactement le
 *   rendu de l'application.
 * - ecrans/*.html : un fichier par écran, avec le balisage des composants Angular (mêmes éléments, mêmes classes,
 *   mêmes libellés). Chaque écran est affiché dans une planche par une iframe à la taille du cadre, pour que les
 *   paliers de mise en page (< 600 px, < 900 px, hauteur ≤ 800 px) jouent comme dans un vrai navigateur.
 * - index.html et les planches (rejoindre.html, etats.html, session-pc.html, session-telephone.html) : cadres,
 *   légendes, et liens de navigation. Dans un écran, un bouton porteur de `data-go` mène à l'écran que son clic
 *   produirait (ecrans/nav.js).
 *
 * Quand un écran change dans le front : mettre à jour les gabarits ci-dessous d'après les templates des composants,
 * puis relancer. En cas de conflit, EXPERIENCE.md et DESIGN.md font foi, puis le code ; pas ces maquettes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../../..');
const out = (name, text) => writeFileSync(join(here, name), text);

// ---------------------------------------------------------------------------------------------------------------
// app.css : la feuille de style du front, @import résolus.
// ---------------------------------------------------------------------------------------------------------------
function inlineCss(file) {
  return readFileSync(file, 'utf8').replace(/@import\s+'([^']+)';/g, (_, rel) => {
    const path = resolve(dirname(file), rel);
    return `/* ---- ${rel.replace('./', '')} ---- */\n${inlineCss(path)}`;
  });
}
out(
  'app.css',
  '/* Copie générée de frontend/src/styles.css (node generer.mjs) : ne pas modifier à la main. */\n' +
    inlineCss(join(repo, 'frontend/src/styles.css')),
);

// ---------------------------------------------------------------------------------------------------------------
// Données communes
// ---------------------------------------------------------------------------------------------------------------
const ORIGIN = 'https://planning-poker.example';
const SESSION = 'k7q2m9';
const LINK = `${ORIGIN}/s/${SESSION}`;
const FIBONACCI = ['0', '0.5', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'];
const TSHIRT = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const NUMERIC = (card) => card !== '?' && card !== 'coffee';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const go = (target) => (target ? ` data-go="${esc(target)}"` : '');

/** frontend/src/app/session/cards.ts */
function cardText(card) {
  return card === 'coffee' ? '☕︎' : card === '0.5' ? '0,5' : card;
}
function cardName(card) {
  if (card === '?') return 'Carte je ne sais pas';
  if (card === 'coffee') return 'Carte pause café';
  if (TSHIRT.includes(card)) return `Carte taille ${card}`;
  return `Carte ${cardText(card)}`;
}
function voteCounter({ voted, expected }) {
  if (expected === 0) return 'Aucun votant';
  return `${voted} ${voted > 1 ? 'votes' : 'vote'} sur ${expected}`;
}
/** Anatomie de face (CardFaceComponent) : classes à poser sur l'hôte, et son contenu. */
function face(card) {
  const t = esc(cardText(card));
  return {
    cls: `card-face${cardText(card).length > 2 ? ' card-face-long' : ''}`,
    html:
      `<span class="card-index card-index-top" aria-hidden="true">${t}</span>` +
      `<span class="card-value" aria-hidden="true">${t}</span>` +
      `<span class="card-index card-index-bottom" aria-hidden="true">${t}</span>`,
  };
}

const ICON_ERROR =
  '<svg class="state-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="8"></circle><path d="M10 5.5v5.5"></path><circle cx="10" cy="14.2" r=".6" fill="currentColor"></circle></svg>';
const ICON_LINK =
  '<svg class="copy-link-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2L10 5.8"></path><path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2L10 14.2"></path></svg>';
const ICON_QR =
  '<svg class="qr-code-button-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"></rect><rect x="12" y="3" width="5" height="5" rx="1"></rect><rect x="3" y="12" width="5" height="5" rx="1"></rect><path d="M12 12h2v2h-2zM15.5 15.5h1.5v1.5h-1.5zM12 16h1M16 12v1.5"></path></svg>';

/** QR code du lien de session, calculé comme dans share/qr-code.ts (qrcode-generator, correction M). */
async function qrSvg(url) {
  const { createRequire } = await import('node:module');
  const qrcode = createRequire(join(repo, 'frontend/package.json'))('qrcode-generator');
  const qr = qrcode(0, 'M');
  qr.addData(String.fromCharCode(...new TextEncoder().encode(url)), 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const parts = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.isDark(row, col)) continue;
      const start = col;
      while (col + 1 < n && qr.isDark(row, col + 1)) col++;
      const w = col - start + 1;
      parts.push(`M${start + 4} ${row + 4}h${w}v1h-${w}z`);
    }
  }
  const side = n + 8;
  return `<svg class="qr-code" role="img" aria-label="QR code du lien de la session" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><path d="${parts.join('')}"></path></svg>`;
}
const QR = await qrSvg(LINK);

// ---------------------------------------------------------------------------------------------------------------
// Gabarits des composants
// ---------------------------------------------------------------------------------------------------------------

/** Page d'écran autonome : app.css, thème forcé, nav.js. */
function page({ title, theme, body }) {
  return `<!doctype html>
<html lang="fr" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="../app.css">
<script src="nav.js" defer></script>
</head>
<body>
<!-- Maquette générée par ../generer.mjs : ne pas modifier à la main. -->
<app-root>${body}</app-root>
</body>
</html>
`;
}

/** Barre du haut (app.ts) : logo seul hors session ; en session, « Copier le lien », « QR code », menu du participant. */
function topBar(session) {
  const brand =
    '<div class="brand"><span class="brand-mark card-back" aria-hidden="true"></span><span class="brand-name">Planning Poker</span></div>';
  if (!session) return `<header class="top-bar">${brand}</header>`;
  const { pseudo, qrOpen = false, menuOpen = false, theme = 'auto', links = {} } = session;
  return `<header class="top-bar">${brand}<div class="top-actions">${copyLink('secondary', links.copy)}${qrButton(
    qrOpen,
    links.qr,
    links.qrClose,
  )}${participantMenu(pseudo, menuOpen, theme, links)}</div></header>`;
}

/** share/copy-link.ts */
function copyLink(variant, target) {
  return `<app-copy-link><button type="button" class="btn copy-link btn-${variant}"${go(target)}>${
    variant === 'secondary' ? ICON_LINK : ''
  }<span class="copy-link-label" aria-live="polite">Copier le lien</span></button></app-copy-link>`;
}

/** share/qr-code.ts */
function qrButton(open, target, closeTarget) {
  const panel = open
    ? `<div id="qr-panel" class="qr-panel" role="group" aria-labelledby="qr-panel-title"><p id="qr-panel-title" class="qr-panel-title">QR code de la session</p>${QR}<p class="qr-panel-url">${LINK}</p><button type="button" class="btn btn-secondary qr-panel-close"${go(
        closeTarget,
      )}>Fermer</button></div>`
    : '';
  return `<app-qr-code-button class="qr-code-host"><button type="button" class="btn btn-secondary qr-code-button" aria-expanded="${open}"${go(
    open ? closeTarget : target,
  )}>${ICON_QR}<span class="qr-code-button-label">QR code</span></button>${panel}</app-qr-code-button>`;
}

/** top-bar/participant-menu.component.ts */
function participantMenu(pseudo, open, theme, links) {
  const items = [
    ['auto', 'Automatique'],
    ['light', 'Clair'],
    ['dark', 'Sombre'],
  ]
    .map(
      ([value, label]) =>
        `<button type="button" class="participant-menu-item" role="menuitemradio" aria-checked="${
          theme === value
        }" tabindex="-1"${go(links.menuClose)}><span class="participant-menu-check" aria-hidden="true">${
          theme === value ? '✓' : ''
        }</span> ${label}</button>`,
    )
    .join('');
  const list = open
    ? `<div id="participant-menu-list" class="participant-menu-list" role="menu" aria-label="Menu du participant : ${esc(
        pseudo,
      )}"><div role="group" aria-label="Thème">${items}</div></div>`
    : '';
  return `<app-participant-menu class="participant-menu"><button type="button" class="btn btn-secondary participant-menu-trigger" aria-haspopup="menu" aria-expanded="${open}" aria-label="Menu du participant : ${esc(
    pseudo,
  )}"${go(open ? links.menuClose : links.menu)}><span class="participant-menu-pseudo">${esc(
    pseudo,
  )}</span><span class="chev" aria-hidden="true"></span></button>${list}</app-participant-menu>`;
}

/** entry-form/entry-form.component.ts, dans home.component.ts ou session-entry.component.ts. */
function entryForm({
  submitLabel,
  pseudo,
  role = 'VOTER',
  deck = null,
  notice = null,
  pseudoError = null,
  submitError = null,
  links = {},
}) {
  const errorIcon = ICON_ERROR.replace('state-icon', 'error-icon');
  const roles = [
    ['VOTER', 'Je vote'],
    ['OBSERVER', "J'observe"],
  ]
    .map(
      ([value, label]) =>
        `<button type="button" class="role" role="radio" aria-checked="${role === value}" tabindex="${
          role === value ? 0 : -1
        }"${go(links[value])}>${label}</button>`,
    )
    .join('');
  let deckGroup = '';
  if (deck) {
    const family = deck.type === 'FIBONACCI' ? FIBONACCI : TSHIRT;
    const types = [
      ['FIBONACCI', 'Fibonacci'],
      ['TSHIRT', 'Tailles de tee-shirt'],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" class="role" role="radio" aria-checked="${deck.type === value}" tabindex="${
            deck.type === value ? 0 : -1
          }"${go(links[value])}>${label}</button>`,
      )
      .join('');
    const dropped = deck.dropped ?? [];
    const chips = family
      .map(
        (card) =>
          `<button type="button" class="deck-chip" aria-pressed="${!dropped.includes(card)}" aria-label="${esc(
            cardName(card),
          )}">${esc(cardText(card))}</button>`,
      )
      .join('');
    const valid = family.length - dropped.length >= 2;
    deckGroup = `<div class="deck-group"><span class="field-label" id="entry-deck-label">Cartes de la session</span><div class="roles" role="radiogroup" aria-labelledby="entry-deck-label">${types}</div><div class="deck-cards" role="group" aria-label="Cartes retenues">${chips}</div><p class="deck-hint${
      valid ? '' : ' deck-hint-error'
    }"${valid ? '' : ' role="alert"'}>${
      valid ? "Retire les cartes dont tu n'as pas besoin. Ce choix est définitif pour la session." : 'Garde au moins 2 cartes.'
    }</p></div>`;
  }
  return `<main class="entry-screen"><app-entry-form><form class="entry-form" novalidate><div class="entry-form-mark card-back" aria-hidden="true"></div><h1>Planning Poker</h1>${
    notice ? `<p class="entry-notice" role="status">${esc(notice)}</p>` : ''
  }<div class="field${pseudoError ? ' field-error' : ''}"><label class="field-label" for="entry-pseudo">Ton pseudo</label><input id="entry-pseudo" class="input" type="text" name="pseudo" maxlength="20" autocomplete="nickname" spellcheck="false" value="${esc(
    pseudo,
  )}"${pseudoError ? ' aria-invalid="true" aria-describedby="entry-pseudo-error"' : ''}>${
    pseudoError ? `<p id="entry-pseudo-error" class="error-msg" role="alert">${errorIcon} ${esc(pseudoError)}</p>` : ''
  }</div><div class="role-group"><span class="field-label" id="entry-role-label">Ton rôle</span><div class="roles" role="radiogroup" aria-labelledby="entry-role-label">${roles}</div></div>${deckGroup}<button type="submit" class="btn btn-primary entry-form-submit"${go(
    links.submit,
  )}>${esc(submitLabel)}</button>${
    submitError ? `<p class="error-msg submit-error" role="alert">${errorIcon} ${esc(submitError)}</p>` : ''
  }</form></app-entry-form></main>`;
}

/** wake/wake-screen.component.ts et les états de session-entry.component.ts. */
function stateScreen({ host, title, lead = null, button = null, target = null, waking = false }) {
  const inner = waking
    ? `<main class="state-screen" role="status"><div class="deck" aria-hidden="true"><span class="card-back"></span><span class="card-back"></span><span class="card-back"></span></div><h1>${title}</h1>${
        lead ? `<p class="lead">${lead}</p>` : ''
      }</main>`
    : `<main class="state-screen" role="alert">${ICON_ERROR}<h1 class="state-error">${title}</h1>${
        lead ? `<p class="lead">${lead}</p>` : ''
      }${button ? `<button type="button" class="btn btn-primary"${go(target)}>${button}</button>` : ''}</main>`;
  return `<${host}>${inner}</${host}>`;
}

/**
 * Places de la table (session/participant-table.component.ts, seatsOf) : ordre du serveur (votants puis
 * observateurs, par arrivée), ma place remontée en tête de son groupe.
 */
function seats(participants, selfPseudo, hidden) {
  const list = participants.map((p) => {
    const self = p.pseudo === selfPseudo;
    const visible = p.vote != null && (!hidden || self);
    const card = visible ? { face: p.vote } : hidden && p.vote != null ? 'back' : 'empty';
    return { p, self, card, note: noteOf(p, self, hidden, card) };
  });
  const mine = list.findIndex((s) => s.self);
  if (mine >= 0) {
    const [me] = list.splice(mine, 1);
    list.splice(
      list.findIndex((s) => s.p.role === me.p.role),
      0,
      me,
    );
  }
  return list;
}
function noteOf(p, self, hidden, card) {
  const observesWithCard = p.role !== 'VOTER' && card !== 'empty';
  if (p.offline) return observesWithCard ? 'déconnecté · observe' : 'déconnecté';
  if (p.role !== 'VOTER') return observesWithCard ? 'observe' : null;
  if (p.lateComer) return 'votera au prochain tour';
  if (card === 'empty') return hidden ? null : "n'a pas voté";
  if (card !== 'back' && hidden && self) return 'visible par toi seul';
  return null;
}
function table(participants, selfPseudo, hidden) {
  const items = seats(participants, selfPseudo, hidden)
    .map(({ p, self, card, note }) => {
      let c;
      if (p.role !== 'VOTER' && card === 'empty') c = '<span class="seat-card seat-card-observer">observe</span>';
      else if (card === 'empty')
        c = hidden
          ? '<span class="seat-card seat-card-empty" role="img" aria-label="n\'a pas voté"></span>'
          : '<span class="seat-card seat-card-empty" aria-hidden="true"></span>';
      else if (card === 'back') c = '<span class="seat-card seat-card-back card-back" role="img" aria-label="a voté"></span>';
      else {
        const f = face(card.face);
        c = `<span class="seat-card seat-card-face ${f.cls}" role="img" aria-label="${esc(cardName(card.face))}">${f.html}</span>`;
      }
      return `<li class="seat${self ? ' seat-self' : ''}${p.offline ? ' offline' : ''}">${c}<span class="seat-who"><span class="presence-dot ${
        p.offline ? 'presence-offline' : 'presence-online'
      }" aria-hidden="true"></span><span class="seat-pseudo">${esc(p.pseudo)}</span>${
        self ? ' <span class="seat-me">(toi)</span>' : ''
      }</span>${note ? `<span class="seat-note">${esc(note)}</span>` : ''}</li>`;
    })
    .join('');
  return `<app-participant-table><ul class="seats" aria-label="Participants">${items}</ul></app-participant-table>`;
}

/** Synthèse d'un tour révélé, calculée comme le domaine (backend Summary) : votes numériques seulement. */
function summaryOf(participants) {
  const ranked = participants.map((p) => p.vote).filter((v) => v != null && NUMERIC(v));
  if (ranked.length === 0) return null;
  const order = FIBONACCI.concat(TSHIRT);
  const counts = new Map();
  ranked.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const top = Math.max(...counts.values());
  const tied = [...counts.keys()].filter((v) => counts.get(v) === top).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const sorted = [...ranked].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const numbers = ranked.filter((v) => !TSHIRT.includes(v)).map(Number);
  const average = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null;
  return {
    average: average === null ? null : new Intl.NumberFormat('fr', { maximumFractionDigits: 1 }).format(average),
    mostVoted: tied,
    count: top,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    consensus: ranked.length >= 2 && counts.size === 1,
  };
}
const joinValues = (values) => {
  const t = values.map(cardText);
  return t.length <= 1 ? t.join('') : `${t.slice(0, -1).join(', ')} et ${t[t.length - 1]}`;
};

/** session/result.ts : panneau du PC (dans la barre d'action) et ligne condensée du téléphone. */
function resultPanel(s) {
  if (!s) return '<app-result-panel><div class="result-panel" role="group" aria-label="Résultat"><p class="result-none">Pas de résultat chiffré</p></div></app-result-panel>';
  const count = `${s.count} ${s.count > 1 ? 'votes' : 'vote'}${s.mostVoted.length > 1 ? ' chacune' : ''}`;
  return `<app-result-panel><div class="result-panel" role="group" aria-label="Résultat">${
    s.average !== null
      ? `<div class="result-stat result-average"><span class="result-label">Moyenne</span> <span class="result-value">${s.average}</span></div>`
      : ''
  }${s.consensus ? '<span class="consensus-badge">Consensus !</span>' : ''}<div class="result-stat result-most-voted"><span class="result-label">Plus votée</span> <span class="result-value">${esc(
    joinValues(s.mostVoted),
  )} <span class="result-count">· ${count}</span></span></div><div class="result-stat result-min"><span class="result-label">Min</span> <span class="result-value">${esc(
    cardText(s.min),
  )}</span></div><div class="result-stat result-max"><span class="result-label">Max</span> <span class="result-value">${esc(
    cardText(s.max),
  )}</span></div></div></app-result-panel>`;
}
function resultLine(s) {
  if (!s) return '<app-result-line class="result-line-dock"><div class="result-line" role="group" aria-label="Résultat"><p class="result-none">Pas de résultat chiffré</p></div></app-result-line>';
  return `<app-result-line class="result-line-dock"><div class="result-line" role="group" aria-label="Résultat"><p class="result-line-items">${
    s.average !== null
      ? `<span class="result-line-item result-line-average">Moy. <span class="result-line-value">${s.average}</span></span>`
      : ''
  }${
    s.consensus ? '<span class="result-line-item result-line-badge"><span class="consensus-badge">Consensus !</span></span>' : ''
  }<span class="result-line-rest"><span class="result-line-item result-line-most-voted">Plus votée ${esc(
    joinValues(s.mostVoted),
  )} (${s.count})</span><span class="result-line-item result-line-min">Min ${esc(
    cardText(s.min),
  )}</span><span class="result-line-item result-line-max">Max ${esc(cardText(s.max))}</span></span></p></div></app-result-line>`;
}

/** session/action-bar.component.ts */
function actionBar({ revealed, progress, summary, inactive, links }) {
  const dis = inactive ? ' aria-disabled="true"' : '';
  return `<app-action-bar>${revealed ? resultLine(summary) : ''}<div class="action-bar${
    revealed ? ' action-bar-revealed' : ''
  }">${revealed ? resultPanel(summary) : `<span class="vote-counter">${voteCounter(progress)}</span>`}<div class="action-buttons"><button type="button" class="btn btn-secondary"${dis}${go(
    inactive ? null : revealed ? links.hide : links.clear,
  )}>${revealed ? 'Masquer' : 'Effacer les votes'}</button><button type="button" class="btn btn-primary"${dis}${go(
    inactive ? null : revealed ? links.newRound : links.reveal,
  )}>${revealed ? 'Nouveau tour' : 'Révéler les votes'}</button></div></div></app-action-bar>`;
}

/** session/hand.component.ts : main « Ta carte » et bascule « Je vote » / « J'observe ». */
function hand({ me, cards, open, connected, links }) {
  const vote = me.vote ?? null;
  const columns = cards.length <= 5 ? Math.max(cards.length, 1) : Math.ceil(cards.length / 2);
  const active = vote === null ? 0 : Math.max(cards.indexOf(vote), 0);
  const dis = open ? '' : ' aria-disabled="true"';
  const buttons = cards
    .map((card, i) => {
      const f = face(card);
      const target = open ? (card === vote ? links.unvote : typeof links.vote === 'function' ? links.vote(card) : links.vote) : null;
      return `<button type="button" class="poker-card${card === vote ? ' poker-card-selected' : ''} ${f.cls}" aria-label="${esc(
        cardName(card),
      )}" aria-pressed="${card === vote}" tabindex="${i === active ? 0 : -1}"${dis}${go(target)}>${f.html}</button>`;
    })
    .join('');
  const roles = [
    ['VOTER', 'Je vote'],
    ['OBSERVER', "J'observe"],
  ]
    .map(
      ([value, label]) =>
        `<button type="button" class="role" aria-pressed="${me.role === value}"${connected ? '' : ' aria-disabled="true"'}${go(
          connected && me.role !== value ? links[value] : null,
        )}>${label}</button>`,
    )
    .join('');
  return `<app-hand class="hand-dock" role="region" aria-label="Ta main"><div class="hand${open ? '' : ' hand-locked'}"><div class="hand-main">${
    open && vote === null ? '<p class="hand-hint">Choisis ta carte</p>' : ''
  }<div class="hand-cards" role="toolbar" aria-label="Ta carte" style="--hand-columns: ${columns}"${dis}>${buttons}</div></div><div class="hand-role" role="group" aria-label="Ton rôle">${roles}</div></div></app-hand>`;
}

/** session/session-page.component.ts, dans session-entry.component.ts, sous la barre du haut. */
function sessionScreen({
  me: selfPseudo,
  participants,
  revealed = false,
  reconnecting = false,
  cards = FIBONACCI,
  inviteQrOpen = false,
  topBarSession = {},
  links = {},
}) {
  const me = participants.find((p) => p.pseudo === selfPseudo);
  const alone = participants.length === 1;
  const voters = participants.filter((p) => p.role === 'VOTER' && !p.lateComer);
  const progress = { voted: voters.filter((p) => p.vote != null).length, expected: voters.length };
  const connected = !reconnecting;
  const open = connected && !revealed && me.role === 'VOTER' && !me.lateComer;
  const invite = alone
    ? `<div class="invite"><p class="invite-text">Partage le lien pour inviter ton équipe</p><p class="invite-url">${LINK}</p><div class="invite-actions">${copyLink(
        'primary',
        links.copy,
      )}${qrButton(inviteQrOpen, links.inviteQr, links.inviteQrClose)}</div></div>`
    : '';
  const body = `<app-session-page${revealed ? ' class="session-revealed"' : ''}><main class="session-page"><div class="status-region" role="status">${
    reconnecting ? '<div class="status-banner">Reconnexion…</div>' : ''
  }</div><div class="session-scroll"><section class="session-table" aria-label="Table des participants">${table(
    participants,
    selfPseudo,
    !revealed,
  )}${invite}</section></div>${
    alone
      ? ''
      : actionBar({ revealed, progress, summary: revealed ? summaryOf(participants) : null, inactive: !connected, links })
  }</main>${hand({ me, cards, open, connected, links })}</app-session-page>`;
  return (
    topBar({ pseudo: selfPseudo, links, ...topBarSession }) + `<app-session-entry>${body}</app-session-entry>`
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Participants des scénarios
// ---------------------------------------------------------------------------------------------------------------
const V = (pseudo, vote = null, extra = {}) => ({ pseudo, role: 'VOTER', vote, ...extra });
const O = (pseudo, extra = {}) => ({ pseudo, role: 'OBSERVER', vote: null, ...extra });

/** PC, 13 participants : 12 votants et Eric, observateur ; tour caché, 9 votes sur 12. */
const pcHidden = (sofia = '8') => [
  V('Sofia', sofia),
  V('Karim', '5'),
  V('Léa', '3'),
  V('Tom', '5'),
  V('Inès'),
  V('Hugo', '5'),
  V('Maëlle', '5', { offline: true }),
  V('Paul', '5'),
  V('Chloé', '8'),
  V('Yanis'),
  V('Nora', '5'),
  V('Lucas'),
  O('Eric'),
];
/** Le même tour révélé : Inès et Lucas ont voté entre-temps, Yanis n'a pas voté. */
const pcRevealed = [
  V('Sofia', '8'),
  V('Karim', '5'),
  V('Léa', '3'),
  V('Tom', '5'),
  V('Inès', '13'),
  V('Hugo', '5'),
  V('Maëlle', '5', { offline: true }),
  V('Paul', '5'),
  V('Chloé', '8'),
  V('Yanis'),
  V('Nora', '5'),
  V('Lucas', '?'),
  O('Eric'),
];
/** Téléphone, 8 participants : 7 votants et Eric ; tour caché, 5 votes sur 7. */
const phoneHidden = [
  V('Sofia', '8'),
  V('Karim', '5'),
  V('Léa', '5'),
  V('Tom', '5'),
  V('Inès'),
  V('Hugo'),
  V('Maëlle', '5', { offline: true }),
  O('Eric'),
];
const phoneRevealed = ['Sofia', 'Karim', 'Léa', 'Tom', 'Inès', 'Hugo', 'Maëlle'].map((p) => V(p, '5')).concat(O('Eric'));

// ---------------------------------------------------------------------------------------------------------------
// Écrans
// ---------------------------------------------------------------------------------------------------------------
const R = '../rejoindre.html';
const E = '../etats.html';
const P = '../session-pc.html';
const T = '../session-telephone.html';

/** Liens communs des écrans de session sur PC vus par Sofia. */
const sofiaPc = {
  qr: `${P}#qr`,
  qrClose: `${P}#votant`,
  menu: `${P}#menu`,
  menuClose: `${P}#votant`,
  reveal: `${P}#revele`,
  clear: `${P}#choisir`,
  hide: `${P}#votant`,
  newRound: `${P}#choisir`,
  vote: `${P}#votant`,
  unvote: `${P}#choisir`,
  OBSERVER: `${P}#observateur`,
};
const sofiaPhone = {
  reveal: `${T}#revele`,
  clear: `${T}#cache`,
  hide: `${T}#cache`,
  newRound: `${T}#cache`,
  vote: `${T}#cache`,
  unvote: `${T}#cache`,
  OBSERVER: `${T}#observateur`,
};

const screens = [
  // Accueil et Rejoindre
  {
    file: 'accueil.html',
    title: 'Accueil',
    theme: 'light',
    body:
      topBar() +
      `<app-home>${entryForm({
        submitLabel: 'Créer une session',
        pseudo: 'Eric',
        role: 'OBSERVER',
        deck: { type: 'FIBONACCI' },
        links: { submit: `${E}#session-vide`, TSHIRT: `${R}#accueil-tailles`, VOTER: `${R}#accueil-erreur` },
      })}</app-home>`,
  },
  {
    file: 'accueil-tailles.html',
    title: 'Accueil, tailles de tee-shirt',
    theme: 'light',
    body:
      topBar() +
      `<app-home>${entryForm({
        submitLabel: 'Créer une session',
        pseudo: 'Eric',
        role: 'OBSERVER',
        deck: { type: 'TSHIRT', dropped: ['XXS', 'XXL'] },
        links: { submit: `${E}#session-vide`, FIBONACCI: `${R}#accueil` },
      })}</app-home>`,
  },
  {
    file: 'accueil-erreur.html',
    title: 'Accueil, serveur injoignable',
    theme: 'light',
    body:
      topBar() +
      `<app-home>${entryForm({
        submitLabel: 'Créer une session',
        pseudo: 'Eric',
        role: 'VOTER',
        deck: { type: 'FIBONACCI', dropped: ['0.5', 'coffee'] },
        submitError: 'Impossible de joindre le serveur.',
        links: { submit: `${E}#session-vide`, OBSERVER: `${R}#accueil`, TSHIRT: `${R}#accueil-tailles` },
      })}</app-home>`,
  },
  {
    file: 'rejoindre.html',
    title: 'Rejoindre',
    theme: 'light',
    body:
      topBar() +
      `<app-session-entry>${entryForm({
        submitLabel: 'Rejoindre',
        pseudo: 'Sofia',
        links: { submit: `${R}#rejoindre-pseudo-pris` },
      })}</app-session-entry>`,
  },
  {
    file: 'rejoindre-pseudo-pris.html',
    title: 'Rejoindre, pseudo pris',
    theme: 'light',
    body:
      topBar() +
      `<app-session-entry>${entryForm({
        submitLabel: 'Rejoindre',
        pseudo: 'Sofia',
        pseudoError: 'Ce pseudo est déjà pris dans cette session.',
        links: { submit: `${T}#cache` },
      })}</app-session-entry>`,
  },
  {
    file: 'rejoindre-place-reprise.html',
    title: 'Rejoindre, place reprise',
    theme: 'light',
    body:
      topBar() +
      `<app-session-entry>${entryForm({
        submitLabel: 'Rejoindre',
        pseudo: 'Sofia',
        notice: 'Ta place a été reprise depuis un autre appareil.',
        links: { submit: `${T}#cache` },
      })}</app-session-entry>`,
  },
  // États
  {
    file: 'reveil.html',
    title: 'Réveil du serveur',
    theme: 'light',
    body:
      topBar() +
      stateScreen({ host: 'app-wake-screen', waking: true, title: 'Réveil du serveur…', lead: "Ça peut prendre jusqu'à 2 minutes." }),
  },
  {
    file: 'serveur-indisponible.html',
    title: 'Serveur indisponible',
    theme: 'light',
    body:
      topBar() +
      stateScreen({ host: 'app-wake-screen', title: 'Le serveur ne répond pas.', button: 'Réessayer', target: `${E}#reveil` }),
  },
  {
    file: 'session-introuvable.html',
    title: 'Session introuvable',
    theme: 'light',
    body:
      topBar() +
      stateScreen({
        host: 'app-session-entry',
        title: "Cette session n'existe plus.",
        lead: 'Elle a peut-être expiré, ou le serveur a redémarré.',
        button: 'Créer une session',
        target: `${R}#accueil`,
      }),
  },
  {
    file: 'session-injoignable.html',
    title: 'Session injoignable',
    theme: 'light',
    body:
      topBar() +
      stateScreen({
        host: 'app-session-entry',
        title: 'Impossible de joindre le serveur.',
        button: 'Réessayer',
        target: `${R}#rejoindre`,
      }),
  },
  {
    file: 'session-vide.html',
    title: 'Session vide',
    theme: 'light',
    body: sessionScreen({
      me: 'Eric',
      participants: [O('Eric')],
      links: {
        inviteQr: `${E}#session-vide-qr`,
        qr: `${E}#session-vide-qr`,
        menu: `${P}#menu`,
        VOTER: `${E}#session-vide-votant`,
      },
    }),
  },
  {
    file: 'session-vide-qr.html',
    title: 'Session vide, QR code',
    theme: 'light',
    body: sessionScreen({
      me: 'Eric',
      participants: [O('Eric')],
      inviteQrOpen: true,
      links: { inviteQrClose: `${E}#session-vide`, qr: `${E}#session-vide`, menu: `${P}#menu`, VOTER: `${E}#session-vide-votant` },
    }),
  },
  {
    file: 'session-vide-votant.html',
    title: 'Session vide, votant',
    theme: 'light',
    body: sessionScreen({
      me: 'Eric',
      participants: [V('Eric')],
      links: { inviteQr: `${E}#session-vide-qr`, qr: `${E}#session-vide-qr`, menu: `${P}#menu`, OBSERVER: `${E}#session-vide`, vote: `${E}#session-vide-votant`, unvote: `${E}#session-vide-votant` },
    }),
  },
  // Session sur PC
  {
    file: 'session-pc-observateur.html',
    title: 'Session PC, observateur',
    theme: 'light',
    body: sessionScreen({
      me: 'Eric',
      participants: pcHidden(),
      links: { qr: `${P}#qr`, menu: `${P}#menu`, reveal: `${P}#revele`, clear: `${P}#choisir` },
    }),
  },
  {
    file: 'session-pc-choisir.html',
    title: 'Session PC, choisir sa carte',
    theme: 'light',
    body: sessionScreen({ me: 'Sofia', participants: pcHidden(null), links: sofiaPc }),
  },
  {
    file: 'session-pc-votant.html',
    title: 'Session PC, votante',
    theme: 'light',
    body: sessionScreen({ me: 'Sofia', participants: pcHidden(), links: sofiaPc }),
  },
  {
    file: 'session-pc-revele.html',
    title: 'Session PC, tour révélé',
    theme: 'light',
    body: sessionScreen({ me: 'Sofia', participants: pcRevealed, revealed: true, links: sofiaPc }),
  },
  {
    file: 'session-pc-menu.html',
    title: 'Session PC, menu du participant',
    theme: 'light',
    body: sessionScreen({
      me: 'Sofia',
      participants: pcHidden(),
      topBarSession: { menuOpen: true, theme: 'auto' },
      links: { ...sofiaPc, menu: `${P}#votant` },
    }),
  },
  {
    file: 'session-pc-qr.html',
    title: 'Session PC, QR code',
    theme: 'light',
    body: sessionScreen({
      me: 'Sofia',
      participants: pcHidden(),
      topBarSession: { qrOpen: true },
      links: sofiaPc,
    }),
  },
  // Session sur téléphone
  {
    file: 'session-tel-cache.html',
    title: 'Session téléphone, tour caché',
    theme: 'dark',
    body: sessionScreen({ me: 'Sofia', participants: phoneHidden, links: sofiaPhone }),
  },
  {
    file: 'session-tel-revele.html',
    title: 'Session téléphone, tour révélé',
    theme: 'dark',
    body: sessionScreen({ me: 'Sofia', participants: phoneRevealed, revealed: true, links: sofiaPhone }),
  },
  {
    file: 'session-tel-reconnexion.html',
    title: 'Session téléphone, reconnexion',
    theme: 'dark',
    body: sessionScreen({ me: 'Sofia', participants: phoneHidden, reconnecting: true, links: {} }),
  },
  {
    file: 'session-tel-observateur.html',
    title: 'Session téléphone, observatrice',
    theme: 'dark',
    body: sessionScreen({
      me: 'Sofia',
      participants: phoneHidden.map((p) => (p.pseudo === 'Sofia' ? O('Sofia') : p)),
      links: { ...sofiaPhone, VOTER: `${T}#cache` },
    }),
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Planches
// ---------------------------------------------------------------------------------------------------------------
const BOARDS = [
  ['index.html', 'Sommaire'],
  ['rejoindre.html', 'Accueil et Rejoindre'],
  ['etats.html', "Écrans d'état"],
  ['session-pc.html', 'Session sur PC'],
  ['session-telephone.html', 'Session sur téléphone'],
];

function board({ file, title, dark = false, intro, content }) {
  const nav = BOARDS.map(
    ([href, label]) => `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="maquettes.css">
</head>
<body${dark ? ' class="dark-board"' : ''}>
<!--
  Planche générée par generer.mjs : ne pas modifier à la main.
  Chaque écran est une page de ecrans/, rendue avec app.css (copie de la feuille de style du front) dans une iframe
  à la taille du cadre. Cliquer un bouton d'écran mène à l'écran qu'il produit ; les liens « › » des légendes
  suivent les parcours. En cas de conflit, EXPERIENCE.md et DESIGN.md font foi, pas ces maquettes.
-->
<nav class="board-nav" aria-label="Planches"><span class="title">Maquettes Planning Poker</span>${nav}</nav>
${intro ? `<div class="board-intro">${intro}</div>` : ''}
${content}
</body>
</html>
`;
}

const next = (links) => links.map(([href, label]) => `<a class="next" href="${href}">${label} ›</a>`).join('');

/** Cadre de navigateur. */
function browserShot({ id, src, caption, links = [], url = `planning-poker.example/s/${SESSION}`, height = 650 }) {
  return `<section class="shot" id="${id}">
  <p class="caption">${caption} ${next(links)}</p>
  <div class="browser">
    <div class="chrome"><i></i><i></i><i></i><div class="url">${url}</div><span class="size">zone utile 1280 × ${height}</span></div>
    <iframe src="ecrans/${src}" width="1280" height="${height}" title="${esc(id)}"></iframe>
  </div>
</section>
`;
}

/** Cadre de téléphone : 390 × 800 sous la barre d'état. */
function phoneShot({ id, src, caption, links = [], dark = false, time = '9:41', network = '5G' }) {
  return `  <div class="col" id="${id}">
    <p class="caption">${caption} ${next(links)}</p>
    <div class="phone"><div class="screen${dark ? ' dark' : ''}">
      <div class="status"><span>${time}</span><span class="notch"></span><span>${network}</span></div>
      <iframe src="ecrans/${src}" width="390" height="800" title="${esc(id)}"></iframe>
      <span class="home"></span>
    </div></div>
  </div>
`;
}

const jump = (items) => `<div class="jump">${items.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</div>`;

const boards = [
  {
    file: 'index.html',
    title: 'Maquettes',
    intro: `<h1>Maquettes de Planning Poker</h1>
<p>Les écrans tels qu'ils sont dans le front aujourd'hui, avec la feuille de style de l'application (<code>app.css</code>, copie de <code>frontend/src/styles.css</code>). Chaque planche montre les écrans dans un cadre de navigateur ou de téléphone ; un clic sur un bouton d'un écran mène à l'écran qu'il produit, et les liens « › » sous chaque légende suivent les parcours.</p>
<p>Pour les remettre à jour après un changement d'écran : adapter les gabarits de <code>generer.mjs</code> puis lancer <code>node generer.mjs</code>. En cas de conflit, EXPERIENCE.md et DESIGN.md font foi, pas ces maquettes.</p>`,
    content: `<div class="toc">
<section>
  <h2>Flux 1 : Eric anime l'affinage</h2>
  <p class="who">Sur PC, en observateur</p>
  <ol>
    <li><a href="rejoindre.html#accueil">Accueil</a> <span>: pseudo prérempli, « J'observe », cartes de la session.</span></li>
    <li><a href="etats.html#session-vide">Session vide</a> <span>: le lien, « Copier le lien » et « QR code ».</span></li>
    <li><a href="session-pc.html#observateur">Session, tour caché</a> <span>: 9 votes sur 12, main grisée.</span></li>
    <li><a href="session-pc.html#revele">Tour révélé</a> <span>: résultat dans la barre d'action, « Nouveau tour ».</span></li>
  </ol>
</section>
<section>
  <h2>Flux 2 : Sofia vote depuis son téléphone</h2>
  <p class="who">Sur téléphone, en thème sombre</p>
  <ol>
    <li><a href="rejoindre.html#rejoindre">Rejoindre</a> <span>: le lien ouvert, « Je vote » par défaut.</span></li>
    <li><a href="rejoindre.html#rejoindre-pseudo-pris">Pseudo pris</a> <span>: message sous le champ, saisie conservée.</span></li>
    <li><a href="session-telephone.html#cache">Session, tour caché</a> <span>: carte 8 choisie, tiroir de la main.</span></li>
    <li><a href="session-telephone.html#revele">Tour révélé, consensus</a> <span>: tiroir replié, résultat condensé.</span></li>
    <li><a href="session-telephone.html#reconnexion">Reconnexion</a> <span>: bandeau ambre, actions inactives.</span></li>
  </ol>
</section>
<section>
  <h2>Accueil et Rejoindre</h2>
  <ul>
    <li><a href="rejoindre.html#accueil">Accueil, Fibonacci</a></li>
    <li><a href="rejoindre.html#accueil-tailles">Accueil, tailles de tee-shirt</a></li>
    <li><a href="rejoindre.html#accueil-erreur">Accueil, serveur injoignable</a></li>
    <li><a href="rejoindre.html#rejoindre">Rejoindre</a>, <a href="rejoindre.html#rejoindre-pseudo-pris">pseudo pris</a>, <a href="rejoindre.html#rejoindre-place-reprise">place reprise</a></li>
  </ul>
</section>
<section>
  <h2>Écrans d'état</h2>
  <ul>
    <li><a href="etats.html#reveil">Réveil du serveur</a>, <a href="etats.html#serveur-indisponible">serveur indisponible</a></li>
    <li><a href="etats.html#session-introuvable">Session introuvable</a>, <a href="etats.html#session-injoignable">session injoignable</a></li>
    <li><a href="etats.html#session-vide">Session vide</a>, <a href="etats.html#session-vide-qr">QR code déplié</a>, <a href="etats.html#session-vide-votant">en votant</a></li>
  </ul>
</section>
<section>
  <h2>Session sur PC</h2>
  <ul>
    <li><a href="session-pc.html#observateur">Vu par Eric, observateur</a></li>
    <li><a href="session-pc.html#choisir">Sofia doit choisir sa carte</a>, <a href="session-pc.html#votant">Sofia a voté</a></li>
    <li><a href="session-pc.html#revele">Tour révélé sans consensus</a></li>
    <li><a href="session-pc.html#menu">Menu du participant</a>, <a href="session-pc.html#qr">QR code</a></li>
  </ul>
</section>
<section>
  <h2>Session sur téléphone</h2>
  <ul>
    <li><a href="session-telephone.html#cache">Tour caché</a>, <a href="session-telephone.html#revele">tour révélé</a></li>
    <li><a href="session-telephone.html#reconnexion">Reconnexion</a>, <a href="session-telephone.html#observateur">observatrice</a></li>
  </ul>
</section>
</div>`,
  },
  {
    file: 'rejoindre.html',
    title: 'Accueil et Rejoindre',
    intro: `<h1>Accueil et Rejoindre</h1>
<p>Formulaire d'entrée commun (<code>entry-form</code>). Sur PC, il s'élargit à 640 px pour tenir les cartes sur une ligne ; quand la fenêtre est basse (1920 × 1080 à 150 %, soit 1280 × 600 utiles), il se resserre et le dos de carte disparaît, pour ne jamais défiler. Sections qui font foi : DESIGN.md › Components (entry-form), EXPERIENCE.md › Component Patterns (Formulaire d'entrée), State Patterns (Pseudo refusé).</p>
${jump([
  ['#accueil', 'Accueil'],
  ['#accueil-tailles', 'Tailles de tee-shirt'],
  ['#accueil-erreur', 'Serveur injoignable'],
  ['#rejoindre', 'Rejoindre'],
  ['#rejoindre-pseudo-pris', 'Pseudo pris'],
  ['#rejoindre-place-reprise', 'Place reprise'],
])}`,
    content:
      browserShot({
        id: 'accueil',
        src: 'accueil.html',
        height: 600,
        url: 'planning-poker.example/',
        caption:
          "<strong>Accueil sur PC.</strong> Flux 1, étape 1 : pseudo « Eric » prérempli, Eric choisit « J'observe ». « Cartes de la session » : la suite de Fibonacci, toutes les cartes retenues ; un clic sur une pastille la retire (contour pointillé, texte barré). Ce choix est définitif pour la session.",
        links: [
          ['etats.html#session-vide', 'Créer une session'],
          ['#accueil-tailles', 'Tailles de tee-shirt'],
        ],
      }) +
      browserShot({
        id: 'accueil-tailles',
        src: 'accueil-tailles.html',
        height: 600,
        url: 'planning-poker.example/',
        caption:
          '<strong>Accueil, tailles de tee-shirt.</strong> Eric a retiré XXS et XXL. Le choix fait dans une famille est gardé quand on passe à l’autre. Avec moins de deux cartes, le texte d’aide devient « Garde au moins 2 cartes. » et le bouton est inactif.',
        links: [
          ['#accueil', 'Fibonacci'],
          ['etats.html#session-vide', 'Créer une session'],
        ],
      }) +
      browserShot({
        id: 'accueil-erreur',
        src: 'accueil-erreur.html',
        height: 600,
        url: 'planning-poker.example/',
        caption:
          "<strong>Accueil, échec de l'envoi.</strong> Le message s'affiche sous le bouton, avec l'icône « ! » ; la saisie est conservée. Autres messages au même endroit : « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. », « Trop de sessions créées depuis ton réseau. Patiente une minute. », « Ce jeu de cartes n'est pas valide. ».",
        links: [['#accueil', 'Accueil']],
      }) +
      `<div class="phones">
${phoneShot({
  id: 'rejoindre',
  src: 'rejoindre.html',
  time: '9:38',
  caption:
    "<strong>Rejoindre, sur téléphone.</strong> Flux 2, étape 1 : Sofia ouvre le lien ; « Je vote » est présélectionné. Pas de choix des cartes : le jeu est celui de la session.",
  links: [['#rejoindre-pseudo-pris', 'Rejoindre']],
})}${phoneShot({
        id: 'rejoindre-pseudo-pris',
        src: 'rejoindre-pseudo-pris.html',
        time: '9:39',
        caption:
          "<strong>Rejoindre, pseudo refusé.</strong> Contour du champ en rouge brique, message avec icône « ! » dessous ; la saisie est conservée. Même place pour « Cette session est complète. » et « Ce pseudo n'est pas valide. ».",
        links: [['session-telephone.html#cache', 'Rejoindre avec un autre pseudo']],
      })}${phoneShot({
        id: 'rejoindre-place-reprise',
        src: 'rejoindre-place-reprise.html',
        time: '9:52',
        caption:
          '<strong>Rejoindre, place reprise.</strong> La place de Sofia a été reprise depuis un autre appareil : information neutre au-dessus du champ, pseudo prérempli.',
        links: [['session-telephone.html#cache', 'Rejoindre']],
      })}</div>
`,
  },
  {
    file: 'etats.html',
    title: "Écrans d'état",
    intro: `<h1>Écrans d'état</h1>
<p>Colonne centrée de 400 px (<code>state-screen</code>), puis la Session vide. Sections qui font foi : DESIGN.md › Components (state-screen, copy-link-button), EXPERIENCE.md › State Patterns (Réveil du serveur, Serveur indisponible, Session disparue ou expirée, Session vide).</p>
${jump([
  ['#reveil', 'Réveil'],
  ['#serveur-indisponible', 'Serveur indisponible'],
  ['#session-introuvable', 'Session introuvable'],
  ['#session-injoignable', 'Session injoignable'],
  ['#session-vide', 'Session vide'],
  ['#session-vide-qr', 'QR code déplié'],
  ['#session-vide-votant', 'Session vide, en votant'],
])}`,
    content:
      browserShot({
        id: 'reveil',
        src: 'reveil.html',
        height: 560,
        url: 'planning-poker.example/',
        caption:
          "<strong>1. Réveil du serveur (0 à 3 min).</strong> Trois dos de carte se battent en boucle ; l'animation s'arrête si l'utilisateur a demandé à réduire les animations.",
        links: [
          ['rejoindre.html#accueil', 'Serveur réveillé'],
          ['#serveur-indisponible', 'Au-delà de 3 min'],
        ],
      }) +
      browserShot({
        id: 'serveur-indisponible',
        src: 'serveur-indisponible.html',
        height: 560,
        url: 'planning-poker.example/',
        caption: '<strong>2. Serveur indisponible (au-delà de 3 min).</strong> Icône, titre en rouge brique, un seul bouton « Réessayer ».',
        links: [['#reveil', 'Réessayer']],
      }) +
      browserShot({
        id: 'session-introuvable',
        src: 'session-introuvable.html',
        height: 560,
        caption:
          "<strong>3. Session introuvable.</strong> Lien inconnu ou expiré, ou session disparue (fermeture 4404) ; on propose d'en créer une nouvelle.",
        links: [['rejoindre.html#accueil', 'Créer une session']],
      }) +
      browserShot({
        id: 'session-injoignable',
        src: 'session-injoignable.html',
        height: 560,
        caption:
          "<strong>4. Session injoignable.</strong> La vérification du lien a échoué faute de réseau : « Impossible de joindre le serveur. » et « Réessayer », qui relance la vérification.",
        links: [['rejoindre.html#rejoindre', 'Réessayer']],
      }) +
      browserShot({
        id: 'session-vide',
        src: 'session-vide.html',
        caption:
          "<strong>5. Session vide.</strong> Flux 1, étape 2 : Eric (observateur) est seul. Le lien s'affiche en clair, « Copier le lien » est le bouton principal, suivi de « QR code » ; pas de barre d'action. La barre du haut porte « Copier le lien », « QR code » et le menu du participant. En bas, la main reste visible mais grisée, et la bascule « Je vote » / « J'observe » montre « J'observe » enfoncé.",
        links: [
          ['#session-vide-qr', 'QR code'],
          ['#session-vide-votant', 'Je vote'],
          ['session-pc.html#observateur', "L'équipe arrive"],
        ],
      }) +
      browserShot({
        id: 'session-vide-qr',
        src: 'session-vide-qr.html',
        caption:
          '<strong>6. Session vide, QR code déplié.</strong> Le panneau se déplie sous les boutons, dans la carte d’invitation : QR code noir sur blanc quel que soit le thème, lien en clair, « Fermer ». Échap ou un clic ailleurs le referment aussi ; seule la table défile si la place manque.',
        links: [['#session-vide', 'Fermer']],
      }) +
      browserShot({
        id: 'session-vide-votant',
        src: 'session-vide-votant.html',
        caption:
          "<strong>7. Session vide, en votant.</strong> Eric est passé à « Je vote » : sa place montre une carte vide, la main s'active avec « Choisis ta carte ». Toujours pas de barre d'action tant qu'il est seul.",
        links: [['#session-vide', "J'observe"]],
      }),
  },
  {
    file: 'session-pc.html',
    title: 'Session sur PC',
    intro: `<h1>Session sur PC</h1>
<p>13 participants (12 votants et Eric, observateur), jeu de Fibonacci complet (11 cartes). Règle : aucun défilement de page dans une zone utile de 1280 × 650 px (écran 1366 × 768), tour révélé compris ; si la fenêtre est moins haute, seule la table défile. Trois bandes : barre du haut, table (7 places par rangée) et barre d'action, puis la main fixée en bas avec la bascule « Je vote » / « J'observe » à gauche. Sections qui font foi : DESIGN.md › Layout & Spacing, Components ; EXPERIENCE.md › Responsive & Platform, Component Patterns (Main de cartes).</p>
${jump([
  ['#observateur', 'Vu par Eric'],
  ['#choisir', 'Sofia choisit'],
  ['#votant', 'Sofia a voté'],
  ['#revele', 'Tour révélé'],
  ['#menu', 'Menu du participant'],
  ['#qr', 'QR code'],
])}`,
    content:
      browserShot({
        id: 'observateur',
        src: 'session-pc-observateur.html',
        caption:
          "<strong>1. Vu par Eric (observateur).</strong> Tour caché, 9 votes sur 12 ; Inès, Yanis et Lucas n'ont pas encore voté ; Maëlle est déconnectée, son dos de carte reste en place. Les observateurs sont en fin de table. Eric voit la main, grisée ; « J'observe » est enfoncé, « Je vote » le fait voter.",
        links: [
          ['#revele', 'Révéler les votes'],
          ['#choisir', 'Vu par Sofia'],
        ],
      }) +
      browserShot({
        id: 'choisir',
        src: 'session-pc-choisir.html',
        caption:
          '<strong>2. Vu par Sofia, avant son vote.</strong> Sa place vient en premier, carte vide en pointillés ; « Choisis ta carte » au-dessus de la main.',
        links: [['#votant', 'Choisir le 8']],
      }) +
      browserShot({
        id: 'votant',
        src: 'session-pc-votant.html',
        caption:
          "<strong>3. Vu par Sofia, carte 8 choisie.</strong> Sa place montre la face « 8 » avec « visible par toi seul » ; dans la main, la 8 garde sa face blanche, prend un contour rouge épais et se soulève de 12 px. Un nouveau clic sur la 8 retire le vote.",
        links: [
          ['#revele', 'Révéler les votes'],
          ['#choisir', 'Retirer le vote'],
          ['#menu', 'Menu du participant'],
          ['#qr', 'QR code'],
        ],
      }) +
      browserShot({
        id: 'revele',
        src: 'session-pc-revele.html',
        caption:
          "<strong>4. Tour révélé, sans consensus, vu par Sofia.</strong> Les faces des autres se retournent l'une après l'autre (400 ms), puis le résultat remplace le compteur dans la barre d'action, sur une rangée : Moyenne 6,2 (62 / 10 votes numériques, le « ? » de Lucas exclu), Plus votée 5 · 6 votes, Min 3, Max 13. Yanis n'a pas voté. La main est grisée ; « Nouveau tour » est le bouton principal, « Masquer » rouvre le vote sur le même tour.",
        links: [
          ['#choisir', 'Nouveau tour'],
          ['#votant', 'Masquer'],
        ],
      }) +
      browserShot({
        id: 'menu',
        src: 'session-pc-menu.html',
        caption:
          "<strong>5. Menu du participant ouvert.</strong> Il ne porte plus que le thème : « Automatique » (coché), « Clair », « Sombre ». Le rôle se change avec la bascule en bas à gauche de la main.",
        links: [['#votant', 'Fermer']],
      }) +
      browserShot({
        id: 'qr',
        src: 'session-pc-qr.html',
        caption:
          '<strong>6. QR code depuis la barre du haut.</strong> Panneau non modal sous les boutons, aligné à droite comme le menu : QR code du lien, lien en clair, « Fermer ».',
        links: [['#votant', 'Fermer']],
      }),
  },
  {
    file: 'session-telephone.html',
    title: 'Session sur téléphone',
    dark: true,
    intro: `<h1>Session sur téléphone</h1>
<p>390 × 844, thème sombre, vue par Sofia ; 8 participants (7 votants et Eric). Barre du haut compacte (logo, « Copier le lien » et « QR code » en icônes, menu du participant), table de 3 places par rangée (seule à défiler), barre d'action pleine largeur, puis le tiroir de la main : 11 cartes sur 2 rangées, et la bascule « Je vote » / « J'observe » dessous, à gauche. Sections qui font foi : DESIGN.md › Colors (jetons -dark), Components ; EXPERIENCE.md › Responsive & Platform (&lt; 600 px), State Patterns.</p>
${jump([
  ['#cache', 'Tour caché'],
  ['#revele', 'Tour révélé'],
  ['#reconnexion', 'Reconnexion'],
  ['#observateur', 'Observatrice'],
])}`,
    content: `<div class="phones">
${phoneShot({
  id: 'cache',
  src: 'session-tel-cache.html',
  dark: true,
  caption:
    "<strong>(a) Tour caché.</strong> Sofia a choisi 8 : la carte garde sa face claire, prend un contour rouge épais et se soulève ; sa place montre la face avec « visible par toi seul ». 5 votes sur 7 ; Maëlle déconnectée.",
  links: [
    ['#revele', 'Révéler les votes'],
    ['#observateur', "J'observe"],
  ],
})}${phoneShot({
      id: 'revele',
      src: 'session-tel-revele.html',
      dark: true,
      time: '9:43',
      caption:
        "<strong>(b) Tour révélé, consensus.</strong> Toutes les faces à 5. Le tiroir de la main est replié ; le résultat condensé « Moy. 5 · Consensus ! · Plus votée 5 (7) · Min 5 · Max 5 » passe sur deux lignes faute de place, juste au-dessus de la barre d'action, qui n'a plus de compteur.",
      links: [['#cache', 'Nouveau tour']],
    })}${phoneShot({
      id: 'reconnexion',
      src: 'session-tel-reconnexion.html',
      dark: true,
      time: '9:42',
      network: '—',
      caption:
        '<strong>(c) Reconnexion en cours.</strong> Coupure de plus de 2 s : bandeau ambre « Reconnexion… » ; la table reste visible, les boutons, la main et la bascule de rôle sont inactifs ; la carte 8 reste soulevée.',
      links: [['#cache', 'Connexion rétablie']],
    })}${phoneShot({
      id: 'observateur',
      src: 'session-tel-observateur.html',
      dark: true,
      caption:
        "<strong>(d) Sofia passe observatrice.</strong> Sa place rejoint les observateurs, en fin de table, avec « observe » ; la main reste affichée mais grisée ; le compteur passe à 4 votes sur 6.",
      links: [['#cache', 'Je vote']],
    })}</div>
`,
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------------------------------------------
mkdirSync(join(here, 'ecrans'), { recursive: true });
out(
  'ecrans/nav.js',
  `// Généré par ../generer.mjs. Un bouton porteur de data-go mène à l'écran que son clic produirait, dans la
// fenêtre entière (l'écran est affiché dans une iframe de planche).
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-go]');
  if (!target) return;
  event.preventDefault();
  window.top.location.href = new URL(target.dataset.go, location.href).href;
});
// Formulaire d'entrée : l'envoi suit le data-go du bouton principal.
document.addEventListener('submit', (event) => event.preventDefault());
`,
);
for (const s of screens) out(`ecrans/${s.file}`, page(s));
for (const b of boards) out(b.file, board(b));
console.log(`${screens.length} écrans, ${boards.length} planches.`);
