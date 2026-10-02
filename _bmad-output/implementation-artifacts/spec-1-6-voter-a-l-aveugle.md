---
title: 'Story 1.6 : voter à l''aveugle'
type: 'feature'
created: '2026-10-02'
status: 'in-progress'
baseline_commit: '484ec12ce49456da0ded1ae68435e412088f42a6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-5-voir-la-table-en-direct.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La table s'affiche en direct, mais personne ne peut voter (FR10, FR6).

**Approach:** Traiter l'intention `vote {roundId, card|null}` dans le domaine (choisir, changer, retirer, avec les erreurs du contrat) et refléter les votes dans l'instantané filtré ; côté front, ajouter la main « Ta carte », les faces et dos de carte sur la table et le compteur « N votes sur M ».

## Boundaries & Constraints

**Always :**
- Domaine : le tour tient les votes par participant. `vote` vérifie dans cet ordre : `roundId` périmé → ignoré silencieusement (pas d'erreur, pas de `version`) ; observateur → `NOT_A_VOTER` ; tour révélé → `ROUND_REVEALED` ; carte hors du jeu (`"0","1","2","3","5","8","13","21","?","coffee"`) → `INVALID_CARD`. Une erreur ne change rien et n'est envoyée qu'à l'auteur (`error {code}`).
- Choisir, changer ou retirer (`card: null`) son vote incrémente `version` et pose `lastChange {VOTE, auteur}` ; une intention déjà satisfaite (même carte, ou retrait sans vote) ne change rien et n'incrémente pas `version`.
- Instantané : `hasVoted` vrai pour qui a voté ; pendant un tour caché, `vote` n'est rempli que pour le destinataire, `null` pour les autres ; `progress.voted` = votants ayant voté, `expected` = tous les votants, déconnectés compris.
- Message `vote` hors schéma (carte de plus de 16 caractères, `roundId` vide ou de plus de 64, champ manquant ou en trop) → `INVALID_MESSAGE` (règle de la story 1.5).
- Mutation sous le verrou de la session, puis diffusion (AD-3).
- Front, votant pendant un tour caché : la main est une barre d'outils nommée « Ta carte » (`role="toolbar"`, `aria-label`), faite de 10 boutons bascule (`aria-pressed`) ; vraie carte (face blanche, liseré, valeur au centre, index dans deux coins opposés dont un retourné, proportion 2:3, au moins 44 px de large) ; `coffee` affiché `☕` en texte ; flèches gauche/droite pour naviguer (focus itinérant), Entrée ou Espace pour choisir ; « Choisis ta carte » tant que je n'ai pas voté.
- Cliquer une carte envoie `vote {roundId, card}` ; recliquer la carte choisie envoie `card: null`. L'état « choisi » vient de l'instantané (mon `vote`), sans mise à jour optimiste. Carte choisie : contour de 3 px (`--primary`), soulevée de 12 px en 150 ms ; aucune animation avec `prefers-reduced-motion: reduce`.
- Table : ma place montre la face de ma carte avec « visible par toi seul » ; les autres votants qui ont voté montrent le dos à croisillons (`card-back`) ; sans vote, carte vide en pointillés.
- Barre d'action (masquée si je suis seul, story 1.5) : compteur venu de `progress` ; « Aucun votant » si `expected` = 0.
- Libellés exacts, tutoiement, CSP inchangée.
- Contrat : aller-retour des exemples `vote/*` et `session-state/hidden-round` à travers les types écrits à la main, des deux côtés.

**Never :**
- Pas de révélation, d'effacement ni de boutons dans la barre d'action (story 1.7) ; pas de lien « Je veux voter » (story 3.1) ; pas de disposition téléphone en tiroir (story 1.8).
- Aucun calcul métier côté front (le compteur vient de `progress`).
- Aucune modification du contrat.

**Décisions (prises par l'agent, validation groupée en fin de série) :**
- **Accord du compteur** : « 0 vote sur M », « 1 vote sur M », « N votes sur M » dès 2 (singulier pour 0 et 1, comme EXPERIENCE « 0 vote sur M »).
- **Observateur** : à la place de la main, le message « Tu observes » (sans lien, story 3.1).
- **Erreurs `vote` côté front** : aucune n'est affichée (elles ne surviennent que sur un état déjà périmé ; le prochain instantané fait foi).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Choisir | votant, tour caché, `vote {roundId, "8"}` | `version + 1`, `lastChange VOTE` ; moi : `vote "8"`, `hasVoted` ; les autres : `vote null`, `hasVoted true` ; `progress.voted + 1` | N/A |
| Changer | vote 8, puis `"5"` | vote 5, `version + 1`, `progress` inchangé | N/A |
| Retirer | vote 5, puis `card: null` | plus de vote, `hasVoted false` chez tous, `version + 1` | N/A |
| Déjà satisfait | vote 5, puis `"5"` ; ou pas de vote puis `null` | aucun changement, pas de `version`, pas d'instantané | N/A |
| Café | `"coffee"` | accepté, compté dans `progress` | N/A |
| Périmé | `roundId` différent du tour courant | ignoré, aucune réponse | N/A |
| Observateur | observateur, `vote "8"` | rien ne change | `error NOT_A_VOTER` à l'auteur |
| Révélé | tour `REVEALED` (construit en test du domaine) | rien ne change | `ROUND_REVEALED` |
| Carte inconnue | `"4"` ou `"☕"` | rien ne change | `INVALID_CARD` |
| Ordre des contrôles | observateur + carte inconnue + `roundId` périmé | ignoré (périmé d'abord) ; observateur + carte inconnue → `NOT_A_VOTER` | N/A |
| Hors schéma | carte de 17 caractères | rien ne change | `INVALID_MESSAGE` |
| Compteur | 3 votants dont 1 déconnecté, 2 ont voté | « 2 votes sur 3 » ; 1 → « 1 vote sur 3 » ; 0 votant → « Aucun votant » | N/A |
| Front, main | votant, pas de vote | 10 cartes, « Choisis ta carte », aucune `aria-pressed="true"` | N/A |
| Front, clic | clic sur 8 | `vote {roundId, "8"}` envoyé ; après l'instantané, 8 `aria-pressed="true"`, ma place montre 8 et « visible par toi seul » | N/A |
| Front, re-clic | clic sur la carte choisie | `card: null` envoyé | N/A |
| Front, clavier | focus sur la main, flèche droite puis Entrée | la carte suivante reçoit le focus puis est choisie | N/A |
| Front, observateur | je suis observateur | pas de main, « Tu observes » | N/A |

</frozen-after-approval>

## Code Map

- Story 1.5 (voir sa spec et ses Implementation Notes) : domaine `Session` / instantané (`SessionSnapshot`, `lastChange`), cas d'usage et diffusion (`SessionBroadcaster`), gestionnaire WebSocket (aiguillage des messages après la poignée de main, `INVALID_MESSAGE`, `vote` aujourd'hui ignoré), front `session/session.service.ts` (seul propriétaire du WebSocket, `Signal` d'instantané) et table des participants.
- Contrat : `schemas/{vote,card,error,session-state}.json`, exemples `vote/*`, `error/*`, `session-state/hidden-round.json`.
- DESIGN.md › `poker-card`, `poker-card-selected`, `seat-card-back`, `seat-card-face`, `action-bar` ; maquette `mockups/session-pc.html` (main, faces, dos, compteur). Le dos de carte existe dans `frontend/src/styles/card-back.css`.
- Outillage : `JAVA_HOME=/opt/jdk25`, `PATH=/opt/node24/bin:$PATH`, Chromium `/opt/pw-browsers/chromium`.

## Tasks & Acceptance

**Execution :**
- [ ] `backend/.../domain/` -- votes du tour, `Card` (jeu), règle `vote` avec ses erreurs dans l'ordre du contrat, instantané (`hasVoted`, `vote` filtré, `progress`) ; tests JUnit de toute la matrice domaine.
- [ ] `backend/.../application/` -- cas d'usage `vote` (verrou, diffusion seulement si `version` change, erreur renvoyée à l'auteur).
- [ ] `backend/.../adapter/in/ws/` -- traitement du message `vote` ; tests d'intégration (diffusion filtrée chez deux clients, erreurs, périmé, hors schéma) et aller-retour des exemples.
- [ ] `frontend/src/app/session/session.service.ts` -- méthode d'intention `vote(card | null)` (avec le `roundId` courant).
- [ ] `frontend/src/app/session/` -- composant main « Ta carte », place avec face / dos / vide, barre d'action avec compteur ; styles globaux (`styles/cards.css`, `styles/action-bar.css`) ; tests Vitest (main, clavier, re-clic, compteur, observateur).
- [ ] `frontend/e2e/vote.spec.ts` -- faux serveur WebSocket : choisir, changer, retirer, compteur ; sans violation de CSP.

**Acceptance Criteria :**
- Étant donné le webservice réel en local et deux votants dans deux contextes de navigateur, quand A choisit 8, alors A voit sa face 8 « visible par toi seul » et B voit un dos sur la place de A, avec « 1 vote sur 2 » chez les deux, en moins d'une seconde.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts.
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
