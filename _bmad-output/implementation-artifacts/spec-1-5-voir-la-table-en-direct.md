---
title: 'Story 1.5 : voir la table en direct'
type: 'feature'
created: '2026-10-02'
status: 'done'
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
- [x] `backend/.../domain/` -- présence (compteur de connexions par participant), `lastChange`, `SessionSnapshot.forRecipient(session, participantId)` ; tests JUnit (ordre, progress, filtrage, présence multi-onglets).
- [x] `backend/.../application/` -- `SessionBroadcaster`, cas d'usage de connexion (`hello` → 4404/4401/instantané) et de déconnexion ; `JoinSessionUseCase` publie.
- [x] `backend/.../adapter/in/ws/` -- gestionnaire WebSocket (poignée de main, messages, `tick` 5 s), registre des connexions, diffusion non bloquante (`ConcurrentWebSocketSessionDecorator` 2 s / 64 Ko, envoi hors verrou), types JSON des messages ; tests d'intégration couvrant la matrice serveur et l'aller-retour des exemples.
- [x] `frontend/src/app/session/session.service.ts` -- seul propriétaire du WebSocket ; tests Vitest avec un faux WebSocket (hello, heartbeat, version, 4401/4404).
- [x] `frontend/src/app/session/` -- table des participants et page de session (attente, seul, table), aiguillage 4401/4404 ; `styles/table.css` ; tests.
- [x] `frontend/e2e/table.spec.ts` -- faux serveur WebSocket (Playwright `routeWebSocket`) : table, seul, 4404 ; sans violation de CSP.
- [x] `deploy/load-test.mjs` + section dans `deploy/README.md` -- script de charge ; exécution locale consignée dans les Implementation Notes.

**Acceptance Criteria :**
- Étant donné le webservice réel en local, quand deux contextes de navigateur créent puis rejoignent la même session, alors chacun voit les deux places en moins d'une seconde, et un rafraîchissement ramène chacun à sa place.
- Étant donné le script de charge contre le webservice local (5 × 13, au moins 2 min), quand il s'exécute, alors aucune diffusion ne dépasse 1 s et aucune connexion ne tombe.

## Implementation Notes

Reprise du commit WIP df88869 (domaine, `SessionBroadcaster`, `SessionConnectionUseCase`), complétée sans repartir de zéro.

**Webservice**
- `SessionBroadcaster.attach` renvoie désormais un booléen, et le cas d'usage rattache la connexion **avant** de modifier la session : une connexion fermée pendant le traitement de son `hello` n'est jamais comptée comme ouverte (`ConnectResult.ConnectionClosed`). L'adaptateur note la fermeture (`WsConnection.markClosed`) avant d'appeler `disconnect`, sous le même moniteur que `attach`, ce qui exclut toute connexion fantôme.
- Adaptateur `adapter/in/ws` : `SessionSocketHandler` (poignée de main de la story 1.2 conservée : `pendingHellos`, délai, 1008), `WebSocketBroadcaster` (registre des connexions, implémente le port, `tick` toutes les `planning-poker.tick-interval`, 5 s par défaut, 200 ms en test), `WsConnection` (file d'envoi par connexion), `ClientMessages` / `ServerMessages` (types écrits à la main et lecture stricte : clés exactes, bornes en points de code).
- Diffusion non bloquante : sous le verrou, `publish` construit et sérialise un instantané par participant destinataire et le range dans la file de chaque connexion (`ConcurrentLinkedQueue`). Une seule tâche (thread virtuel) à la fois vide la file d'une connexion, dans l'ordre, à travers le `ConcurrentWebSocketSessionDecorator(2 s, 64 Ko, TERMINATE)`. Comme cette tâche est le seul émetteur, les limites du décorateur ne se déclenchent jamais d'elles-mêmes ; elles sont donc aussi appliquées à l'entrée de la file : plus de 64 Ko en attente, ou un envoi bloqué depuis plus de 2 s, ferme la connexion (`4500 SESSION_NOT_RELIABLE`, journal « send buffer overflow »). Les réponses `error`, l'instantané initial et les `tick` passent par la même file.
- Identifiant de session de forme invalide : traité comme inconnu (4404) dès l'adaptateur. Message binaire après la poignée de main : `error INVALID_MESSAGE`.
- Journaux : seuls `participantId` et l'identifiant technique de connexion (UUID Spring) apparaissent ; vérifié dans les journaux du test de charge (aucun pseudo, jeton ni `sessionId`) et par `helloWithTheCreatorTokenAttachesAndSendsTheSnapshot`.
- Pendant le test de charge, la fermeture simultanée des 65 connexions par le script faisait échouer quelques envois en cours, journalisés à tort comme débordements. Un envoi qui échoue arrête désormais la file et ferme la connexion avec un journal DEBUG ; seul un vrai débordement est journalisé en INFO.

**Front**
- `SessionService` est fourni par `SessionEntryComponent` (il vit et meurt avec la page du lien) ; `WEB_SOCKET_FACTORY` permet de le tester avec un faux WebSocket. Fermeture `4401` (ou aucun jeton) : écran Rejoindre, avec `pp.pseudo` relu au moment de la fermeture.
- `ParticipantTableComponent` + `seatsOf` (ordre du serveur, ma place en tête de son groupe). Places en attente : 3 cartes vides sans pseudo. Les styles de la page de session ont quitté `copy-link.css` pour `styles/table.css` (grille de 7, 5 puis 3 places).
- Les e2e existants qui atteignent la page de session (création, rejoindre, déjà membre) branchent le faux serveur WebSocket partagé `e2e/fake-session-socket.ts` : sans lui, « Partage le lien… » n'apparaît plus (il attend l'instantané) et la connexion refusée produirait une erreur de console.

**Vérification**
- `./mvnw verify` : 202 tests verts (matrice serveur de bout en bout dans `SessionSocketHandlerTest`, aller-retour des exemples WS dans `WsContractRoundTripTest`). `npm test` : 139 tests Vitest + 6 tests de scripts verts. `npm run e2e` : 25 tests verts, dont 6 dans `table.spec.ts`, sans violation de CSP. Contrat : `validate` et `test` verts, aucun fichier modifié.
- Critère 1 (webservice réel en local, front construit avec `API_BASE_URL=http://127.0.0.1:8080`, deux contextes Chromium) : après « Rejoindre », chacun voit les deux places en 126 ms (requête REST comprise) ; après un rafraîchissement, chacun retrouve sa place avec « (toi) », sans écran Rejoindre ; quand B ferme son onglet, A voit sa pastille passer au gris en moins d'une seconde.
- Critère 2, test de charge contre le webservice local (`java -jar`, `ALLOWED_ORIGINS=http://127.0.0.1:4300`), `node deploy/load-test.mjs --url http://localhost:8080 --minutes 2` :
  ```
  Charge : 5 sessions × 13 participants, 2 min, départ / retour toutes les 10 s, contre http://localhost:8080
  65 connexions ouvertes en 672 ms
  Diffusions mesurées : 1500 ; latence p50 11.7 ms, p95 28.2 ms, p99 38.5 ms, max 65.2 ms
  tick reçus : 1630 (≈ 25.1 par connexion)
  OK : aucune diffusion au-delà de 1 s, aucune connexion tombée.
  ```
  Sortie 0. L'option `--origin` est vérifiée : avec une origine hors `ALLOWED_ORIGINS`, le script sort en 1 (« connexion impossible »).
- Reste à faire par l'utilisateur : l'exécution de 10 min contre Render (commande dans `deploy/README.md`, résultat à consigner dans son tableau).

**Points d'attention**
- Mesure de latence du script : depuis l'envoi de la requête REST, du `hello` ou de la fermeture côté client, jusqu'à la réception ; elle inclut donc le réseau aller-retour, ce qui est pessimiste et voulu.
- Le participant « mobile » du test de charge part et revient par fermeture et réouverture de sa connexion (PRESENCE), puisque le départ définitif (LEAVE, balayeur) appartient à l'epic 2.

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | verification-gap | Fermeture sur envoi bloqué > 2 s et sur échec d'envoi non testées | medium | Seul `aConnectionThatOverflowsItsBufferIsClosed` ferme, par la limite d'octets | patch |
| 2 | verification-gap | Contrôle des journaux WS aveugle à un pseudo dans le texte (`"Alice"` entre guillemets, `getOut()` seul) | medium | Journaux JSON : un pseudo dans le message ne contient pas `"Alice"` | patch |
| 3 | verification-gap | Script de charge hors de toute vérification automatique | low | Exécution manuelle prévue par la décision du spec | rejeté |
| 4 | edge-case | `localStorage` indisponible : jeton non rangé, renvoi vers Rejoindre puis PSEUDO_TAKEN | medium | `BrowserStorage.write` est sans effet si le stockage est nul ; `SessionService.connect` lit le jeton rangé | patch |
| 5 | edge-case, blind | Envoi bloqué détecté seulement au prochain `enqueue` (≤ 5 s par le `tick`) | low | Délai borné par le `tick` ; correction = minuterie de surveillance | rejeté |
| 6 | edge-case, blind | Une exception dans `tickAll` arrête les `tick` | low | `enqueue` ne lève pas en marche normale ; l'exécuteur ne refuse qu'à l'arrêt du contexte | rejeté |
| 7 | edge-case | `RejectedExecutionException` à l'arrêt | low | Uniquement à la fermeture du contexte | rejeté |
| 8 | edge-case | Instantané > 64 Ko | low | ≈ 300 participants nécessaires ; cible 13 | rejeté |
| 9 | edge-case | `tick-interval` ≤ 0 | low | Erreur de configuration explicite au démarrage | rejeté |
| 10 | edge-case | `new WebSocket` lève (contenu mixte) | low | Déploiement en https des deux côtés | rejeté |
| 11 | edge-case, blind | Instantané d'une autre session accepté | false | Le serveur n'envoie sur une connexion que les instantanés de sa session | rejeté |
| 12 | edge-case | Script de charge : double comptage, dépassement de durée | low | Sortie en erreur dans les deux cas ; dépassement cosmétique | rejeté |
| 13 | blind | Course sur `queuedBytes` (dépassement d'un message) | low | Dépassement borné à un message | rejeté |
| 14 | blind | `WebSocketBroadcaster` sans test unitaire | low | Couvert de bout en bout par `SessionSocketHandlerTest` | rejeté |
| 15 | blind | Nettoyage fragile si `disconnect` lève | low | Aucune source d'exception démontrée | rejeté |
| 16 | blind | Javadoc de `Session` contraire à `withConnections` | low | `disconnect` dépend de `!=` sur une nouvelle instance de même version | patch |
| 17 | blind | Rien d'affiché sur coupure avant le premier instantané / pastilles vertes après coupure | false | Exclu par l'intention (Never : coupure → dernière table, story 2.1/2.2) | rejeté |
| 18 | blind | Présence invisible aux lecteurs d'écran | medium | `presence-dot` en `aria-hidden` sans texte ; libellés de présence réservés à 2.1, accessibilité à 3.5 | defer |
| 19 | blind | Critère 1 sans test automatisé | low | Vérifié manuellement, consigné | rejeté |
| 20 | blind | Statut du sprint désaccordé | false | Synchronisé à la fin du workflow | rejeté |
| 21 | blind | Script de charge ignore `error` et l'ordre des `version` | low | Améliorations du script, hors besoin du critère | rejeté |
| 22 | blind | Journal de débordement par id de connexion | low | Règle du spec : désigner par `participantId` | patch |
| 23 | blind | Test de `tick` à délai fixe fragile | low | 550 ms pour 2 `tick` de 200 ms : marge de 150 ms | patch |
| 24 | blind | CSS : `.invite` en double, carte « observe », jeton mobile | low | Doublon réel ; les deux autres non démontrés | patch (doublon), rejeté (reste) |

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts.
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
- `PATH=/opt/node24/bin:$PATH node deploy/load-test.mjs --url http://localhost:8080 --minutes 2` (webservice local lancé avec `ALLOWED_ORIGINS`) -- attendu : sortie 0, latence maximale < 1 s.
