---
title: 'Story 3.4 : une révélation qui se voit'
type: 'feature'
created: '2026-10-06'
status: 'done'
baseline_commit: '6804e26c4bd47ebaf697c6ff53cb963ad22a3025'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** À la révélation, les dos de cartes de la table sont remplacés d'un coup par les faces, et la synthèse surgit en même temps : le seul moment mis en scène de l'interface (UX-DR10, DESIGN « un seul moment de mise en scène ») passe inaperçu.

**Approach:** Quand un instantané fait passer le tour de caché à révélé, l'écran Session retourne les cartes des autres places l'une après l'autre, en 400 ms au total, puis montre la synthèse. L'état est déjà à jour : seul l'affichage est animé, en CSS, sans dépendance nouvelle. Sous `prefers-reduced-motion`, rien ne bouge et la synthèse s'affiche aussitôt.

## Boundaries & Constraints

**Always:**
- Déclencheur unique : un instantané `REVEALED` qui suit un instantané `HIDDEN` (révélation par moi ou par un autre, y compris après un « Masquer »). Jamais au premier instantané ni à l'arrivée dans un tour déjà révélé.
- Ne se retournent que les places qui montraient un dos : les faces des autres participants. Ma carte, déjà visible pendant le tour caché, ne bouge pas. Les places sans vote restent vides avec « n'a pas voté ».
- Ordre de la table ; chaque carte se retourne en 200 ms (dos qui se referme, puis face qui s'ouvre) ; les départs s'étalent régulièrement de 0 à 200 ms ; fin de la dernière carte à 400 ms quel que soit le nombre de places. Une carte qui attend son tour montre son dos.
- La synthèse (panneau sur PC, ligne condensée sur téléphone) reste invisible pendant ces 400 ms, puis apparaît sans fondu. L'annonce `aria-live` et les noms accessibles des faces (« Carte 8 ») sont à jour dès la réception.
- `prefers-reduced-motion: reduce` : aucune animation, synthèse immédiate (vérifié en JS au moment de la révélation, et garde CSS).
- Un nouvel instantané `HIDDEN` pendant l'animation l'interrompt et ne laisse rien de masqué. Le focus ne bouge pas.

**Never:**
- Ni son, ni vibration, ni confettis, ni fenêtre modale, ni aucune autre animation nouvelle ; pas de `@angular/animations`.
- Aucun retard sur l'état : `SessionService`, le contrat et le webservice ne changent pas.
- Pas d'attribut `style` inline dans le HTML (CSP `default-src 'self'`) : seules les liaisons Angular `[style.--…]` (CSSOM) sont permises.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Révélation | Caché, Alice (moi) 5, Bob et Chloé ont voté | Bob puis Chloé se retournent (départs 0 et 200 ms), ma carte fixe, synthèse à 400 ms | — |
| Une seule autre carte | Bob seul a voté hors moi | Départ 0 ms ; synthèse à 400 ms | — |
| Mouvement réduit | `prefers-reduced-motion: reduce` | Faces et synthèse immédiates, aucune animation | — |
| Arrivée en tour révélé | Premier instantané `REVEALED` | Faces et synthèse immédiates | — |
| Masquer pendant l'animation | `HIDDEN` reçu avant 400 ms | Animation coupée, dos affichés, pas de synthèse | — |
| Revote puis révélation | `HIDDEN` → `REVEALED` après un masquage | Nouveau retournement | — |

</frozen-after-approval>

## Code Map

- `frontend/src/app/session/participant-table.component.ts` -- `seatsOf`, rendu des faces (`@switch`, cas `default`) : y ajouter la classe `seat-card-flip` et `[style.--flip-delay.ms]` sur les faces des autres.
- `frontend/src/app/session/session-page.component.ts` -- `effect` qui compare `previous`/`state` pour les annonces : même endroit pour détecter `HIDDEN → REVEALED` ; `host` porte déjà `session-revealed`.
- `frontend/src/app/session/action-bar.component.ts` -- `app-result-panel` et `app-result-line` (`.result-line-dock`) : à masquer pendant le retournement, sans changer le composant.
- `frontend/src/styles/cards.css` -- `.seat-card-face` (taille, `::before` du liseré) ; bloc `prefers-reduced-motion` existant (l. 188).
- `frontend/src/styles/card-back.css` -- motif du dos (`--card-back`, `--card-back-pattern`, marge `inset`) à reprendre pour la phase « dos » de l'animation.
- `frontend/src/app/share/copy-link.ts:16` -- modèle de `matchMedia` protégé (`typeof matchMedia === 'function'`).
- Animations déjà prévues par DESIGN, à garder : `state-screen.css` (`shuffle-left`/`shuffle-right`), `cards.css:165` (carte soulevée 150 ms), `session-layout.css:169-197` (tiroir).
- `frontend/e2e/reveal.spec.ts` -- modèle e2e (instantanés `hidden`/`revealed`, `watchPage` qui relève les violations de CSP).
- `frontend/scripts/tokens.test.mjs` -- modèle de test `node:test` sur les fichiers CSS.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/session/participant-table.component.ts` -- fonction pure exportée `flipDelays(seats)` (délai en ms par `participantId` pour les faces des autres, étalés de 0 à 200 ms) ; classe `seat-card-flip` et `--flip-delay` sur ces faces -- ordre et durée de l'étalement.
- [x] `frontend/src/app/session/session-page.component.ts` -- signal `flipping` et classe d'hôte `session-flipping` : vrai à `HIDDEN → REVEALED` si le mouvement n'est pas réduit, faux après `REVEAL_FLIP_MS` (400), à tout `HIDDEN` et à la destruction -- point unique du retournement.
- [x] `frontend/src/styles/reveal.css` (importé dans `styles.css`) -- `@keyframes seat-card-flip` (scaleX 1 → 0 avec le dos en `::after`, puis 0 → 1 sur la face), 200 ms, `animation-delay: var(--flip-delay)`, `fill-mode: both`, sous `.session-flipping` ; `visibility: hidden` de `.result-panel` et `.result-line` sous `.session-flipping` ; tout désactivé sous `prefers-reduced-motion` -- l'affichage seul est animé.
- [x] `frontend/src/app/session/participant-table.component.spec.ts`, `session-page.component.spec.ts` -- matrice I/O (faux minuteurs, `matchMedia` simulé).
- [x] `frontend/scripts/motion.test.mjs` -- les seuls `@keyframes` de `src/styles` sont `shuffle-left`, `shuffle-right`, `seat-card-flip` ; aucun `vibrate`, `new Audio`, `<dialog`, `confetti` dans `src` -- garde « aucune autre animation ».
- [x] `frontend/e2e/reveal-motion.spec.ts` -- révélation par un autre : « Carte 8 » présente aussitôt, animation en cours sur la face, synthèse cachée puis visible en moins d'1 s ; `emulateMedia({ reducedMotion: 'reduce' })` : synthèse visible aussitôt, aucune animation ; aucune violation de CSP.

**Acceptance Criteria:**
- Given un tour caché avec des votes, when le tour est révélé, then les cartes des autres se retournent l'une après l'autre en environ 400 ms, puis la synthèse apparaît, l'état étant déjà à jour.
- Given `prefers-reduced-motion`, when le tour est révélé, then les faces et la synthèse apparaissent sans mouvement.
- Given le code du front, when `npm test` s'exécute, then la garde « aucune autre animation » passe.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Couche | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | verification-gap, edge-case | Synthèse du téléphone (`.result-line`) jamais vérifiée pendant le retournement ; `observeReveal` vise `.result-panel` en dur | medium | Sous 600 px, `.result-panel` est en `display: none` ; l'e2e tourne en `Desktop Chrome` et les unitaires ne lisent pas `visibility` | patch : sélecteur paramétré, cas e2e téléphone |
| 2 | verification-gap, blind | Bloc `prefers-reduced-motion` de `reveal.css` jamais atteint ni testé | low | Le TS ne pose pas `session-flipping` sous mouvement réduit ; le bloc est la garde CSS voulue par la spec, utile seulement si la préférence change pendant 400 ms | rejeté |
| 3 | edge-case, blind | Une présence ou un rôle qui change pendant les 400 ms recalcule `--flip-delay` | low | Réel mais rare (instantané dans la fenêtre de 400 ms) ; geler les délais ajoute un état | rejeté |
| 4 | edge-case, blind | `HIDDEN` puis `REVEALED` d'un autre tour (reconnexion) déclenche le retournement | false | Conforme au déclencheur gelé (« un `REVEALED` qui suit un `HIDDEN` ») : l'écran montrait des dos, il les retourne | rejeté |
| 5 | edge-case | État `null` pendant le retournement : `session-flipping` persiste | false | `SessionService` ne remet jamais l'état à `null` | rejeté |
| 6 | edge-case, blind | `motion.test.mjs` : modales et sons hors liste (`role="dialog"`, `showModal`, `.animate(`, `AudioContext`), et faux positifs possibles dans les specs | low | Liste incomplète ; correction directe | patch : mots ajoutés, `*.spec.ts` exclus |
| 7 | edge-case, blind | `@keyframes` dans des styles en ligne de composants non vus | false | Aucun composant ne déclare `styles` (CSP, `styles.css`) | rejeté |
| 8 | edge-case | `observeReveal` peut démarrer après l'affichage révélé (course de protocole) | maybe-false | Dépend de l'ordre des messages Playwright entre `evaluate` et l'envoi WebSocket ; si vrai, e2e instable (medium) | différé |
| 9 | blind | Synthèse cachée 400 ms même avec une seule carte, ou aucune | false | La matrice gelée fixe « Une seule autre carte : synthèse à 400 ms » ; le commentaire de `flipDelays` était faux | patch : commentaire corrigé |
| 10 | blind | Durées dupliquées entre TS (`REVEAL_FLIP_MS`) et CSS (200 ms) | low | Aucun appelant ne diverge aujourd'hui ; les relier ajoute une propriété | rejeté |
| 11 | blind | Tests de `flipDelays` sans observateur gardant un vote ni votant déconnecté | low | Le filtre repose sur `seat.card`, déjà couvert par `seatsOf` | rejeté |
| 12 | blind | « Ma carte ne bouge pas » ne prouve pas l'absence d'animation | false | L'animation ne s'applique qu'à `.seat-card-flip`, absente de ma carte | rejeté |
| 13 | blind | Repli sans `@property` non vérifié | low | Safari 16.4+ et Firefox 128+ le gèrent ; WebKit tourne en CI | rejeté |

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: unitaires et tests de scripts verts, dont `motion.test.mjs`.
- `cd frontend && npm run build:e2e && npx playwright test` -- expected: tous les parcours verts, dont `reveal-motion.spec.ts` (`API_BASE_URL=http://127.0.0.1:4310`).
- `cd frontend && npx prettier --check` sur les fichiers créés -- expected: aucun écart.
