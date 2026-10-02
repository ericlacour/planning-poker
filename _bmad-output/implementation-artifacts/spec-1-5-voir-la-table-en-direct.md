---
title: 'Story 1.5 : voir la table en direct'
type: 'feature'
created: '2026-10-02'
status: 'in-progress'
baseline_commit: '3622286d5c8576c8bd6cdac3aff818bbb07a9752'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/contract/asyncapi.yaml'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une fois dans la session, on ne voit personne : il n'y a ni WebSocket, ni instantané, ni table. Un rafraîchissement ne ramène qu'une page de partage (FR6, FR7 pour le rafraîchissement, FR16).

**Approach:** Ouvrir le canal `/ws/sessions/{sessionId}` de bout en bout : la poignée de main `hello` (4404 puis 4401), l'instantané `sessionState` construit par le domaine pour chaque destinataire, la diffusion non bloquante à chaque changement de `version`, `tick` et `heartbeat` ; côté front, un `SessionService` unique et la table des participants, qui remplacent la page de session provisoire. Un script de charge mesure 5 × 13 connexions.

## Boundaries & Constraints

**Always :**
- Poignée de main (asyncapi.yaml) : `hello` attendu en 5 s, sinon `1008` ; premier message autre qu'un `hello` conforme : `1008` ; session inconnue (ou `sessionId` de forme invalide) : `4404`, vérifiée **avant** le jeton ; jeton inconnu : `4401` ; sinon la connexion est rattachée au participant et reçoit aussitôt son instantané.
- Après la poignée de main : `heartbeat` accepté sans effet ; second `hello`, JSON invalide, `type` inconnu ou message hors schéma → `error INVALID_MESSAGE`, sans effet. `vote`, `reveal`, `hide`, `clear`, `changeRole` conformes au schéma sont ignorés sans réponse (stories 1.6, 1.7, 3.x).
- Présence (domaine) : un participant est `connected` tant qu'il a au moins une connexion ouverte ; l'ouverture de la première ou la fermeture de la dernière change l'état observable (`version + 1`, `lastChange {PRESENCE, participantId}`). Rejoindre par REST (`JOIN`) incrémente `version` et diffuse aussi.
- Instantané (domaine, pur) pour un destinataire, conforme à `session-state.json` : participants triés votants puis observateurs, chacun par `joinOrder` ; `hasVoted` faux et `vote` nul (pas encore de vote) ; `canVoteThisRound` = rôle votant ; `progress {voted: 0, expected: nombre de votants, déconnectés compris}` ; `summary: null` ; `round {roundId, HIDDEN}` ; `lastChange` tenu par la session.
- AD-3 : chaque mutation (rejoindre, connexion, déconnexion) suit charger → règle → `version++` si changement → `save` → `publish`, sous le verrou de la session. `publish` ne fait aucun envoi bloquant : il construit les instantanés sous le verrou et confie l'envoi à une file par connexion (`ConcurrentWebSocketSessionDecorator`, 2 s, 64 Ko) servie hors du verrou. Une connexion qui déborde est fermée.
- `tick` envoyé toutes les 5 s sur chaque connexion rattachée.
- Journaux : jamais de jeton, de pseudo ni d'identifiant de session ; désigner par `participantId`.
- Front : `SessionService` est le **seul** à ouvrir le WebSocket (URL déduite de `apiBaseUrl` : `http`→`ws`, `https`→`wss`). Il envoie `hello` dès l'ouverture, `heartbeat` toutes les 5 s, expose l'instantané en `Signal` lecture seule, remplace son état sans fusionner et ignore une `version` inférieure sur la même connexion. Fermeture `4404` → écran « Session introuvable » et jeton effacé ; `4401` → écran Rejoindre avec `pp.pseudo` prérempli et jeton effacé.
- Table : places dans l'ordre du serveur, ma place remontée en tête de son groupe avec « (toi) » ; chaque place a le pseudo et une pastille de présence (`presence-dot`, verte si connecté, grise sinon) ; un votant a une carte vide en pointillés, un observateur la mention « observe ». Avant le premier instantané : places vides en attente, sans pseudo ni sablier plein écran. Seul dans la session : « Partage le lien pour inviter ton équipe » et « Copier le lien » en bouton principal ; pas de barre d'action dans cette story.
- Rafraîchir `/s/{id}` réutilise `pp.token.{id}` (vérification REST de la story 1.4, puis `hello`) : même place, même pseudo, même rôle, sans écran Rejoindre.
- Contrat : aller-retour des exemples `session-state/alone-after-create`, `session-state/hidden-round`, `hello`, `heartbeat`, `tick`, `error/*` à travers les types écrits à la main, des deux côtés.

**Never :**
- Pas de ping de protocole, de délai de 15 s, de balayeur ni de libellé « déconnecté » (story 2.1) ; pas de reconnexion automatique (story 2.2) : une coupure autre que 4401/4404 laisse la dernière table affichée.
- Pas de main de cartes, de compteur ni de barre d'action (story 1.6), pas de menu du participant (story 3.1).
- Aucune modification du contrat.

**Décisions (prises par l'agent, validation groupée en fin de série) :**
- **Test de charge** : script Node `deploy/load-test.mjs` (WebSocket natif de Node 24) : crée N sessions de M participants (par défaut 5 × 13), garde les connexions ouvertes D minutes en envoyant `heartbeat`, fait rejoindre/quitter périodiquement un participant de chaque session et mesure le délai entre la mutation et la réception de l'instantané par tous. Il sort en erreur si une diffusion dépasse 1 s ou si une connexion tombe. Exécuté ici contre le webservice local (durée réduite) ; l'exécution de 10 min sur Render reste à faire par l'utilisateur, résultat à consigner dans `deploy/README.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Poignée de main | `hello` avec le jeton du créateur | instantané `version` ≥ 2, `connected: true` pour lui, `lastChange PRESENCE` | N/A |
| Session inconnue | `hello` sur un id inconnu, même avec un jeton valide d'une autre session | fermeture `4404` | N/A |
| Jeton inconnu | `hello` avec un jeton bien formé mais inconnu | fermeture `4401` | N/A |
| Pas de hello | rien pendant 5 s / premier message `heartbeat` | fermeture `1008` | N/A |
| Second hello | `hello` après la poignée de main | `error INVALID_MESSAGE`, `version` inchangée | N/A |
| Message invalide | `{` , `{"type":"nope"}`, `{"type":"heartbeat","x":1}` | `error INVALID_MESSAGE`, connexion ouverte | N/A |
| Heartbeat | `heartbeat` | aucune réponse, `version` inchangée | N/A |
| Arrivée | B rejoint (REST) puis se connecte | A reçoit un instantané `JOIN` (B déconnecté) puis `PRESENCE` (B connecté), chacun en < 1 s | N/A |
| Deux onglets | A ouvre une seconde connexion puis en ferme une | `connected` reste vrai, aucune nouvelle `version` | N/A |
| Départ | A ferme sa dernière connexion | B reçoit `connected: false` pour A, `PRESENCE` | N/A |
| Ordre | votants Bob(2), Alice(1), observateur Emma(3) | `participants` : Alice, Bob, Emma | N/A |
| Filtrage | instantané pour B | `selfParticipantId` = B, aucun jeton dans la charge | N/A |
| Tick | connexion ouverte 11 s (horloge accélérée en test) | au moins 2 `tick` | N/A |
| Front, table | instantané à 3 participants dont moi observateur | votants d'abord, ma place en tête des observateurs avec « (toi) », « observe » | N/A |
| Front, attente | aucun instantané | places vides en attente, pas de sablier plein écran | N/A |
| Front, seul | instantané à 1 participant | « Partage le lien pour inviter ton équipe » + « Copier le lien » principal | N/A |
| Front, 4404 / 4401 | fermeture reçue | écran « Session introuvable » / écran Rejoindre prérempli ; jeton effacé | N/A |
| Front, version | instantané v5 puis v4 sur la même connexion | v4 ignoré | N/A |
| Front, rafraîchir | jeton rangé, rechargement | même place sans écran Rejoindre | N/A |

</frozen-after-approval>

## Code Map

- `backend/.../adapter/in/ws/SessionSocketHandler.java` -- poignée de main minimale de la story 1.2 (délai `planning-poker.hello-timeout`, exclusivité de fermeture via `pendingHellos`, contrôle de forme du `hello`) : à faire évoluer, en gardant ses garanties et ses tests (`SessionSocketHandlerTest`).
- `backend/.../config/WebSocketConfig.java` (origines `ALLOWED_ORIGINS`) -- inchangé sauf besoin d'intercepteur pour lire `{sessionId}`.
- Stories 1.3/1.4 : `domain/{Session,Participant,ParticipantToken,Pseudo}` (`joinOrder` commence à 1 ; `Session.join` incrémente `version`), `application/{SessionStore,SessionLocks,CreateSessionUseCase,JoinSessionUseCase}`, `config/SessionConfig` -- le cas d'usage de rejoindre doit désormais publier. `ParticipantToken.matches` existe.
- Nouveaux : port `application/SessionBroadcaster`, domaine `SessionSnapshot` (+ `LastChange`), adaptateur WS de diffusion.
- Front 1.3/1.4 : `session/session-entry.component.ts` (route `s/:sessionId` : `GET` puis états `checking`/`notFound`/`unreachable`/`join`/`session` ; l'état `session` intègre `session-page.component.ts`, page provisoire à remplacer par la table ; les fermetures 4404/4401 doivent ramener à `notFound` / `join`), `entry-form/entry-messages.ts`, `api/contract.ts` (ajouter les types WS), `storage/browser-storage.ts`, `share/copy-link.ts`, `config/app-config.ts`.
- Maquettes : `mockups/session-pc.html`, `mockups/etats.html` (Session vide) ; DESIGN.md › `seat-card-empty`, `presence-dot`, table.
- Outillage : `JAVA_HOME=/opt/jdk25`, `PATH=/opt/node24/bin:$PATH`, Chromium `/opt/pw-browsers/chromium`.

## Tasks & Acceptance

**Execution :**
- [ ] `backend/.../domain/` -- présence (compteur de connexions par participant), `lastChange`, `SessionSnapshot.forRecipient(session, participantId)` ; tests JUnit (ordre, progress, filtrage, présence multi-onglets).
- [ ] `backend/.../application/` -- `SessionBroadcaster`, cas d'usage de connexion (`hello` → 4404/4401/instantané) et de déconnexion ; `JoinSessionUseCase` publie.
- [ ] `backend/.../adapter/in/ws/` -- gestionnaire WebSocket (poignée de main, messages, `tick` 5 s), registre des connexions, diffusion non bloquante (`ConcurrentWebSocketSessionDecorator` 2 s / 64 Ko, envoi hors verrou), types JSON des messages ; tests d'intégration couvrant la matrice serveur et l'aller-retour des exemples.
- [ ] `frontend/src/app/session/session.service.ts` -- seul propriétaire du WebSocket ; tests Vitest avec un faux WebSocket (hello, heartbeat, version, 4401/4404).
- [ ] `frontend/src/app/session/` -- table des participants et page de session (attente, seul, table), aiguillage 4401/4404 ; `styles/table.css` ; tests.
- [ ] `frontend/e2e/table.spec.ts` -- faux serveur WebSocket (Playwright `routeWebSocket`) : table, seul, 4404 ; sans violation de CSP.
- [ ] `deploy/load-test.mjs` + section dans `deploy/README.md` -- script de charge ; exécution locale consignée dans les Implementation Notes.

**Acceptance Criteria :**
- Étant donné le webservice réel en local, quand deux contextes de navigateur créent puis rejoignent la même session, alors chacun voit les deux places en moins d'une seconde, et un rafraîchissement ramène chacun à sa place.
- Étant donné le script de charge contre le webservice local (5 × 13, au moins 2 min), quand il s'exécute, alors aucune diffusion ne dépasse 1 s et aucune connexion ne tombe.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts.
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
- `PATH=/opt/node24/bin:$PATH node deploy/load-test.mjs --url http://localhost:8080 --minutes 2` (webservice local lancé avec `ALLOWED_ORIGINS`) -- attendu : sortie 0, latence maximale < 1 s.
