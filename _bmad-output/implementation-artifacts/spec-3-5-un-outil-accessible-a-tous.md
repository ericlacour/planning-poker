---
title: 'Story 3.5 : un outil accessible à tous'
type: 'feature'
created: '2026-10-06'
baseline_commit: '4c4833289a1e93cc7e569d5c19efdf479eed11bb'
status: 'done'
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
- [x] `frontend/package.json` -- ajouter `@axe-core/playwright` en devDependency, version exacte (4.13.0) -- l'audit est demandé par le critère d'acceptation.
- [x] `frontend/src/app/session/action-bar.component.ts` + `src/styles/base.css` -- boutons stables à libellé variable, `aria-disabled` au lieu de `disabled`, garde de clic dans le composant -- conserver le focus.
- [x] `frontend/src/app/session/result.ts` -- `arrivalAnnouncements(previous, next)` pure -- arrivées.
- [x] `frontend/src/app/session/session-page.component.ts` -- arrivées dans `announcements`, région de compteur limitée à une annonce par 5 s (minuteur nettoyé à la destruction), `role="region"` pour la main -- annonces.
- [x] `frontend/src/app/session/participant-table.component.ts` -- carte vide nommée en tour caché -- place muette.
- [x] Specs unitaires de ces composants -- matrice I/O (faux minuteurs pour les 5 s).
- [x] `frontend/e2e/accessibility.spec.ts` -- audit axe des écrans dans les deux thèmes ; séance au clavier seul (rejoindre, voter, révéler, effacer, changer de rôle, focus visible) ; focus conservé après une révélation par un autre ; contenu des régions live ; 640 × 400 et 360 px.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- solder les trois reports 3.5 (présence, « n'a pas voté », main dans un repère).

**Acceptance Criteria:**
- Given tous les écrans dans les deux thèmes, when l'audit axe s'exécute, then il ne relève aucune violation WCAG 2.2 AA.
- Given un utilisateur au clavier, when il mène une séance complète, then tout passe par Tab, les flèches, Entrée et Espace, avec un contour `primary` visible.
- Given un zoom à 200 % ou 360 px de large, when on affiche chaque écran, then il n'y a aucun défilement horizontal et toutes les cibles font au moins 44 × 44 px.

## Implementation Notes

- Le repère de la main est posé sur l'hôte de `HandComponent` (`host`), comme le dit la Code Map, plutôt que dans le gabarit de la page.
- Coupure : un `effect` sur `connection()` marque toute période hors `open` ; le premier instantané qui suit n'annonce aucune arrivée (`SessionService` inchangé).
- L'audit à 360 px a révélé un débordement de 20 px sur l'accueil et Rejoindre (`app-entry-form`, élément flexible, gardait la largeur de 400 px du panneau) : `max-width: 100%` sur l'hôte dans `entry-form.css`.
- Le champ pseudo garde son contour de 1 px doublé d'une bordure `primary` (story 1.4) ; l'e2e clavier vérifie un contour plein en `primary`, d'au moins 1 px.
- Prettier : `.prettierrc` à 100 colonnes, code existant à 120 (cf. 3.3). Seul le nouveau `e2e/accessibility.spec.ts` est formaté ; les fichiers existants modifiés suivent le style voisin et échouaient déjà à `prettier --check`.

## Spec Change Log

## Review Triage Log

| # | Couche | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | edge-case | Boutons stables : une touche Entrée ou Espace maintenue sur « Révéler les votes » (ou « Masquer ») enchaîne sur le bouton renommé et envoie `clear` | medium | Avant, le remplacement des boutons faisait perdre le focus ; la répétition de touche déclenche un clic natif à chaque `keydown` | patch : répétitions ignorées (`event.repeat`) |
| 2 | blind, edge-case | Le compteur différé peut répéter le dernier texte annoncé (vote puis retrait en moins de 5 s) | low | Courant en séance ; correction directe | patch : échéance ignorée si le texte est identique |
| 3 | blind, edge-case | `innerText() ?? type` ne retombe jamais sur `type` dans `expectReflowAndTargets` | low | `innerText()` renvoie `''`, jamais `null` | patch : `||` |
| 4 | blind | Statut de la story différent entre la spec (`in-review`) et le suivi de sprint (`in-progress`) | false | Le workflow synchronise le suivi de sprint à la présentation (étape 5) | rejeté |
| 5 | blind | Report de présence soldé sans changement de code | false | Décision gelée de la spec : la mention « déconnecté » (2.1) suffit, testée dans `participant-table.component.spec.ts` | rejeté |
| 6 | blind | Repère « Ta main » vide avant le premier instantané, ou contenant « Tu observes » ; deux noms (« Ta main », « Ta carte ») | low | Repère et nom imposés par la spec ; axe ne relève rien ; aucune gêne courante | rejeté |
| 7 | blind | `afterCut` dépend de l'ordre de deux `effect` | false | Une coupure dure au moins le délai de reconnexion (réseau, asynchrone) : l'effet de connexion s'exécute avant le retour ; `session.service.ts` pose l'état puis `open` dans le même gestionnaire | rejeté |
| 8 | blind | Une arrivée déclenche aussi l'annonce du compteur (`expected` change) | low | Conforme à la spec (« quand `progress` change ») ; une annonce de plus par arrivée, limitée à une toutes les 5 s | rejeté |
| 9 | blind, edge-case | E2E des régions live sur l'horloge réelle (`waitForTimeout`, `> 3 000 ms`) | maybe-false | Instable seulement si plus de 2 s séparent l'annonce « 0 vote sur 3 » de `sentAt` ; 4 passages sans échec en local | rejeté (low si vrai) |
| 10 | blind | `package-lock.json` change le nom du paquet et ajoute `engines` | low | Simple resynchronisation par `npm install` avec le `package.json` existant ; sans effet | rejeté |
| 11 | blind | Bouton inactif focalisé sans explication pour le lecteur d'écran | low | `aria-disabled` annonce « indisponible » ; une explication ajouterait des liaisons | rejeté |
| 12 | blind | Cas combinés non testés (révélation et arrivée dans un même instantané ; `lastCounterAt` d'un tour à l'autre) | low | Le tableau `texts` est construit dans l'ordre ; garder l'intervalle de 5 s d'un tour à l'autre respecte « au plus toutes les 5 s » | rejeté |
| 13 | blind | 44 × 44 px est de niveau AAA, au-delà de l'AA | false | Exigé par NFR5 et par le critère d'acceptation de l'epic | rejeté |
| 14 | edge-case | Premier instantané après une coupure : le compteur est annoncé si `progress` a changé | low | Information juste et limitée à une annonce ; la spec ne coupe que les arrivées | rejeté |
| 15 | edge-case | `boundingBox()` nul : cible ignorée en silence | false | Seules les cibles visibles sont mesurées ; un élément visible a toujours une boîte | rejeté |
| 16 | verification-gap | Aucun écart de vérification | — | — | — |

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: unitaires et tests de scripts verts.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npx playwright test` -- expected: tous les e2e verts, dont `accessibility.spec.ts`.
- `cd frontend && npx prettier --check` sur les fichiers modifiés -- expected: aucun écart.
