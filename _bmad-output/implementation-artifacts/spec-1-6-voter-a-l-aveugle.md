---
title: 'Story 1.6 : voter à l''aveugle'
type: 'feature'
created: '2026-10-02'
status: 'in-review'
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
- [x] `backend/.../domain/` -- votes du tour, `Card` (jeu), règle `vote` avec ses erreurs dans l'ordre du contrat, instantané (`hasVoted`, `vote` filtré, `progress`) ; tests JUnit de toute la matrice domaine.
- [x] `backend/.../application/` -- cas d'usage `vote` (verrou, diffusion seulement si `version` change, erreur renvoyée à l'auteur).
- [x] `backend/.../adapter/in/ws/` -- traitement du message `vote` ; tests d'intégration (diffusion filtrée chez deux clients, erreurs, périmé, hors schéma) et aller-retour des exemples.
- [x] `frontend/src/app/session/session.service.ts` -- méthode d'intention `vote(card | null)` (avec le `roundId` courant).
- [x] `frontend/src/app/session/` -- composant main « Ta carte », place avec face / dos / vide, barre d'action avec compteur ; styles globaux (`styles/cards.css`, `styles/action-bar.css`) ; tests Vitest (main, clavier, re-clic, compteur, observateur).
- [x] `frontend/e2e/vote.spec.ts` -- faux serveur WebSocket : choisir, changer, retirer, compteur ; sans violation de CSP.

**Acceptance Criteria :**
- Étant donné le webservice réel en local et deux votants dans deux contextes de navigateur, quand A choisit 8, alors A voit sa face 8 « visible par toi seul » et B voit un dos sur la place de A, avec « 1 vote sur 2 » chez les deux, en moins d'une seconde.

## Implementation Notes

**Webservice**
- Domaine : `Card` (énumération du jeu, valeur du contrat, comparaison exacte), `VoteRejectedException` avec sa `Reason` (`NOT_A_VOTER`, `ROUND_REVEALED`, `INVALID_CARD`, noms identiques aux codes du contrat). `Session` gagne `roundStatus` et `votes` (`Map<UUID, Card>` immuable) ; `Session.vote(participantId, roundId, card)` contrôle dans l'ordre périmé (même instance) → observateur → révélé → carte, et renvoie la même instance pour une intention déjà satisfaite ; sinon `version + 1`, `lastChange VOTE`. Les votes survivent aux changements de présence. Le tour révélé ne se construit qu'en test (constructeur canonique), en attendant la story 1.7.
- `SessionSnapshot` : `hasVoted` d'après les votes ; pendant un tour caché, `vote` rempli seulement pour le destinataire ; `progress.voted` = votants ayant voté, `expected` = tous les votants. Pour un tour révélé (inatteignable avant 1.7), tous les votes sont visibles ; `summary` reste nul.
- `VoteUseCase` (sous le verrou ; `save` + `publish` seulement si `version` change) renvoie la raison d'un refus ; `SessionSocketHandler` l'envoie en `error {code}` à la seule connexion auteure. `ClientMessages.VoteMessage` remplace `Intent` pour `vote` (lecture stricte inchangée : carte > 16 points de code, `roundId` vide ou > 64, champ manquant ou en trop → `INVALID_MESSAGE`).
- `ROUND_REVEALED` n'est testé qu'au niveau du domaine (aucun tour révélé atteignable par le canal avant 1.7).

**Front**
- `SessionService.vote(card | null)` envoie `vote {roundId courant, card}` sur la connexion ouverte, sans mise à jour optimiste (rien avant le premier instantané ni après une coupure).
- `cards.ts` : `cardText` (`coffee` → `☕` + U+FE0E, `font-variant-emoji: text`), `cardName` (« Carte 5 », « Carte je ne sais pas », « Carte pause café »), `voteCounter` (décision d'accord : singulier pour 0 et 1, « Aucun votant » si `expected` = 0), et `CardFaceComponent` (sélecteur d'attribut `[appCardFace]`, valeur et deux index dont un retourné).
- `HandComponent` : barre d'outils « Ta carte » de 10 boutons bascule, focus itinérant (flèches gauche / droite, plus Début / Fin ; sans bouclage), Entrée / Espace gérés au `keydown` avec `preventDefault` pour un seul envoi par appui (vérifié en e2e) ; « Choisis ta carte » tant que mon `vote` est nul ; observateur : « Tu observes ». Cartes désactivées si le tour n'est pas caché (préparation 1.7).
- Table (`seatsOf`) : chaque place porte sa carte, `empty`, `back` (classe `card-back` réutilisée) ou face ; « visible par toi seul » sous ma face pendant un tour caché.
- `ActionBarComponent` : compteur seul, affiché dès qu'il y a un instantané et que je ne suis pas seul.
- Styles : `styles/cards.css` (anatomie de carte, main, sélection 3 px soulevée de 12 px en 150 ms, sans transition sous `prefers-reduced-motion: reduce` ; en thème sombre le contour passe en `--card-ink`, comme le prévoit DESIGN.md › `poker-card-selected`) et `styles/action-bar.css`. Pour fixer la main en bas, `app-session-page` (et `app-session-entry` qui la contient, via `:has`) deviennent des colonnes flexibles ; la main est `position: sticky; bottom: 0`. Sous 600 px la main passe sur deux lignes (le tiroir reste pour 1.8) : pas de défilement horizontal à 360 px, cartes de 44 × 66.
- `e2e/table.spec.ts` : l'exemple `hidden-round` vu par Emma montre désormais 3 dos et 1 carte vide (au lieu de 4 cartes vides).

**Vérification**
- `./mvnw verify` : 249 tests verts (dont `SessionVoteTest` 20, `VoteUseCaseTest` 4, nouveaux cas de `SessionSocketHandlerTest` et `WsContractRoundTripTest` pour `vote/*` et les erreurs).
- `npm test` : 162 tests Vitest + 6 tests de scripts verts. `npm run e2e` : 28 tests verts, dont 3 dans `vote.spec.ts`, sans violation de CSP ni erreur de console. Contrat : `validate` et `test` verts, aucun fichier modifié.
- Critère d'acceptation (webservice réel `java -jar` avec `ALLOWED_ORIGINS=http://127.0.0.1:4300`, front construit avec `API_BASE_URL=http://127.0.0.1:8080`, deux contextes Chromium) : A crée, B rejoint ; A clique 8 → A voit sa face 8 et « visible par toi seul », la carte 8 `aria-pressed="true"` ; B voit un dos sur la place d'Alice et aucune face ; « 1 vote sur 2 » chez les deux, en 63 à 77 ms du clic à la mise à jour des deux pages ; aucune erreur de console.

**Points d'attention**
- Le compteur n'est pas encore annoncé par une zone `aria-live` (au plus toutes les 5 s selon EXPERIENCE) : laissé à la story d'accessibilité.
- `ClientMessages.Intent` couvre désormais seulement `reveal`, `hide`, `clear`, `changeRole`.

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | verification-gap | `Session.join` qui conserve les votes du tour : aucun test | medium | Tous les tests rejoignent avant de voter | patch |
| 2 | blind | Statuts du spec et du sprint désaccordés | false | Synchronisés à la fin du workflow (`review`) | rejeté |
| 3 | blind | `vote` sans champ `card` : NPE | false | `node.has("card")` est testé avant `isNull()` | rejeté |
| 4 | blind | Entrée/Espace maintenus : répétition qui alterne vote et retrait | medium | `onKeydown` ne filtre pas `event.repeat` ; pas de mise à jour optimiste | patch |
| 5 | blind, verification-gap | Test « my vote is only a back » sans assertion sur le dos | low | Le test ne vérifie que l'ordre et l'absence de note | patch |
| 6 | blind | Place sans vote muette pour un lecteur d'écran | medium | Carte vide en `aria-hidden`, dos en « a voté » | defer |
| 7 | blind | Main hors du repère `main` | low | `<app-hand>` après `</main>` ; disposition revue en 1.8, accessibilité en 3.5 | defer |
| 8 | blind | Survol des cartes désactivées | low | Règles `:hover` sans `:not(:disabled)` | patch |
| 9 | blind | Couleurs d'ombre et rayons en dur | low | Cosmétique, sans effet démontré hors ombre en thème sombre | rejeté |
| 10 | blind | Clavier vérifié sous Chromium seul | low | Navigateur unique de la suite e2e du projet | rejeté |
| 11 | blind | `VoteUseCase` : participant inconnu non testé | low | Garde présente, non atteignable par le WebSocket (connexion rattachée) | rejeté |
| 12 | blind, edge-case | Vote d'un non-votant compté en `hasVoted` | false | Inatteignable : le rôle ne change pas avant la story 3.1 | defer (3.1) |
| 13 | blind | Repli `'0'` de `faceOf` | low | Branche inatteignable par le gabarit | rejeté |
| 14 | blind | Vote sur `roundId` périmé sans retour | false | Voulu par l'intention (ignoré silencieusement) | rejeté |
| 15 | edge-case | Coupure : main active, clics perdus | low | Intention : coupure → dernière table ; reconnexion en story 2.2 | rejeté |
| 16 | edge-case | Tour révélé : focus perdu sur les boutons désactivés | low | Tour révélé inatteignable avant la story 1.7 | rejeté |
| 17 | edge-case | `votes` nul ou orphelin dans `Session` | low | Seules les règles du domaine construisent la map | rejeté |

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts.
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
