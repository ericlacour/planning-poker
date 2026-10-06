---
title: 'Story 3.5 : un outil accessible à tous'
type: 'feature'
created: '2026-10-06'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une séance ne se mène pas encore entièrement au clavier ni au lecteur d'écran. Quand un autre révèle (ou que j'efface), les boutons de la barre d'action sont remplacés et le focus retombe sur `<body>` (constaté en e2e). Les arrivées et le compteur « N votes sur M » ne sont jamais annoncés. Une place sans vote d'un tour caché est muette. La main « Ta carte » est hors de tout repère. Enfin, rien ne garde l'audit axe, qui est vert aujourd'hui sur tous les écrans, dans les deux thèmes.

**Approach:** Garder les mêmes éléments focalisables d'un état du tour à l'autre. Compléter les annonces `aria-live` polies (arrivées, compteur limité à une annonce toutes les 5 s). Donner un nom aux places muettes et un repère à la main. Verrouiller le tout par un audit `@axe-core/playwright` (tags WCAG 2.2 AA) et des e2e clavier, zoom et lecteur d'écran. Le contrat, `SessionService` et le webservice ne changent pas.

## Boundaries & Constraints

**Always:**
- Barre d'action : deux boutons rendus une fois pour toutes, dont seul le libellé change (« Effacer les votes » ↔ « Masquer », « Révéler les votes » ↔ « Nouveau tour »). Inactifs (garde de 1 s, hors connexion) : `aria-disabled="true"`, opacité 40 %, clic sans effet, le focus restant posé.
- Annonces dans la région polie existante : révélation et « Nouveau tour » inchangés ; « {pseudo} a rejoint la session » pour chaque nouveau `participantId` autre que moi (jamais au premier instantané).
- Compteur : région polie à part. Pendant un tour caché, quand `progress` change sans changement de tour, on annonce `voteCounter`, au plus une fois toutes les 5 s. Une annonce à moins de 5 s de la précédente est différée à l'échéance, avec la dernière valeur. Rien n'est annoncé si le tour est révélé ou effacé entre-temps. Aucune annonce vote par vote.
- Place sans vote d'un tour caché : carte vide `role="img"` nommée « n'a pas voté ». En tour révélé, la mention visible suffit.
- Main : `<app-hand>` porte `role="region"` et `aria-label="Ta main"`.
- Présence : la mention « déconnecté » (story 2.1) solde le report de la story 1.5. La pastille reste décorative.
- Audit axe sur l'accueil, Rejoindre (avec et sans erreur), le réveil, « Le serveur ne répond pas », « Session introuvable », « Injoignable », et la session seul, cachée, révélée et en observateur, en clair et en sombre : zéro violation pour les tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` et `wcag22aa`.
- Téléphone (< 600 px) : le tiroir de la main se replie toujours à la révélation (story 1.8). Le focus conservé ne vaut que là où la main reste visible (PC, tablette dès 600 px) : exception assumée, sans code (décision d'Eric du 2026-10-06).
- Zoom 200 % (fenêtre de 640 × 400) et 360 px : aucun défilement horizontal, et cibles d'au moins 44 × 44 px, sur ces mêmes écrans.

**Never:**
- Aucun raccourci clavier pour révéler, masquer ou effacer, et aucun déplacement programmé du focus à la révélation.
- Pas de règles axe désactivées, ni de sélecteurs exclus.
- Aucun changement du contrat, de `SessionService` ni du webservice.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Révélation par un autre | Focus sur « Révéler les votes » | Le focus reste sur le même bouton, devenu « Nouveau tour », inactif pendant 1 s | — |
| J'efface | Focus sur « Nouveau tour », Entrée | Le focus reste sur le bouton, devenu « Révéler les votes » | — |
| Votes en rafale | 3 votes reçus en 2 s | Une annonce immédiate, puis une seule à +5 s avec le dernier compte | — |
| Révélé avant l'échéance | Compteur différé, puis REVEALED | Pas d'annonce du compteur ; la révélation est annoncée | — |
| Arrivée | Sofia apparaît dans l'instantané | « Sofia a rejoint la session » | — |
| Reconnexion | Premier instantané après une coupure | Aucune arrivée annoncée | — |

</frozen-after-approval>

## Code Map

- `frontend/src/app/session/action-bar.component.ts` -- `@if (revealed())` qui crée deux paires de boutons, ce qui fait perdre le focus ; `[disabled]="inactive()"` ; `guarded` et `blocksActions` sont à garder.
- `frontend/src/styles/base.css:58` -- `.btn:disabled` (opacité 0,4) : étendre à `.btn[aria-disabled="true"]`. Le `:focus-visible` global en `--primary` est déjà en place (l. 63).
- `frontend/src/app/session/session-page.component.ts` -- l'`effect` `previous`/`state` qui alimente `announcements` (clé `id`) est le point unique pour les arrivées et le compteur ; `<app-hand class="hand-dock">` est hors de `<main>`.
- `frontend/src/app/session/result.ts` -- `announcementFor` et `NEW_ROUND_ANNOUNCEMENT` : y ajouter une fonction pure pour les arrivées.
- `frontend/src/app/session/cards.ts:23` -- `voteCounter` : texte du compteur, à réutiliser tel quel.
- `frontend/src/app/session/participant-table.component.ts` -- `@case ('empty')` en `aria-hidden` ; `noteOf` donne déjà « n'a pas voté » en tour révélé.
- `frontend/src/app/session/hand.component.ts` -- focus itinérant et `aria-disabled` déjà conformes ; n'ajouter que le `host`.
- `frontend/src/styles/session-layout.css:195` -- `.session-revealed .hand-dock { visibility: hidden }` : à ne pas toucher (exception téléphone).
- Écrans d'état : `session-entry.component.ts` (`notFound`, `unreachable`, `join`) et `wake/wake-screen.component.ts`.
- E2E modèles : `e2e/reveal.spec.ts` (`openWithToken`, `watchPage`, instantanés construits), `e2e/fake-session-socket.ts` (`routes[0].send`), `e2e/layout.spec.ts` (mesures 44 px et `scrollWidth`), `e2e/wake.spec.ts` et `e2e/join-session.spec.ts` (écrans d'état). Exemples : `contract/examples/session-state/*.json`.
- Environnement local : Node 24 (`/opt/nvm/versions/node/v24.21.0/bin`), `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`.

## Tasks & Acceptance

**Execution:**
- [ ] `frontend/package.json` -- ajouter `@axe-core/playwright` en devDependency, version exacte (4.13.0) -- l'audit est demandé par le critère d'acceptation.
- [ ] `frontend/src/app/session/action-bar.component.ts` + `src/styles/base.css` -- boutons stables à libellé variable, `aria-disabled` au lieu de `disabled`, garde de clic dans le composant -- conserver le focus.
- [ ] `frontend/src/app/session/result.ts` -- `arrivalAnnouncements(previous, next)` pure -- arrivées.
- [ ] `frontend/src/app/session/session-page.component.ts` -- arrivées dans `announcements`, région de compteur limitée à une annonce par 5 s (minuteur nettoyé à la destruction), `role="region"` pour la main -- annonces.
- [ ] `frontend/src/app/session/participant-table.component.ts` -- carte vide nommée en tour caché -- place muette.
- [ ] Specs unitaires de ces composants -- matrice I/O (faux minuteurs pour les 5 s).
- [ ] `frontend/e2e/accessibility.spec.ts` -- audit axe des écrans dans les deux thèmes ; séance au clavier seul (rejoindre, voter, révéler, effacer, changer de rôle, focus visible) ; focus conservé après une révélation par un autre ; contenu des régions live ; 640 × 400 et 360 px.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- solder les trois reports 3.5 (présence, « n'a pas voté », main dans un repère).

**Acceptance Criteria:**
- Given tous les écrans dans les deux thèmes, when l'audit axe s'exécute, then il ne relève aucune violation WCAG 2.2 AA.
- Given un utilisateur au clavier, when il mène une séance complète, then tout passe par Tab, les flèches, Entrée et Espace, avec un contour `primary` visible.
- Given un zoom à 200 % ou 360 px de large, when on affiche chaque écran, then il n'y a aucun défilement horizontal et toutes les cibles font au moins 44 × 44 px.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: unitaires et tests de scripts verts.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npx playwright test` -- expected: tous les e2e verts, dont `accessibility.spec.ts`.
- `cd frontend && npx prettier --check` sur les fichiers modifiés -- expected: aucun écart.
