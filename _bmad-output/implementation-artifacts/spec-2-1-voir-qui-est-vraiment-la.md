---
title: 'Story 2.1 : voir qui est vraiment là'
type: 'feature'
created: '2026-10-03'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/contract/asyncapi.yaml'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un participant dont le réseau tombe sans fermeture propre (wifi coupé, téléphone en veille) reste affiché « connecté » indéfiniment : le serveur ne mesure pas la vivacité des connexions. Et un participant déconnecté n'a qu'une pastille grise, sans libellé, ce qui fait passer l'information par la couleur seule (FR6, FR16, AD-8, UX-DR5).

**Approach:** Le serveur mesure la vivacité de chaque connexion : ping de protocole WebSocket toutes les 5 s, et la date de dernière activité (pong ou message) est tenue par le domaine, sans effet observable. Un balayeur, une fois par seconde, ferme les connexions muettes depuis 15 s ; la fermeture de la dernière connexion d'un participant le passe à `connected: false` et diffuse le changement. Le front affiche le libellé « déconnecté » et le pseudo en `muted-foreground`.

## Boundaries & Constraints

**Always:**
- Présence : un participant est `connected` tant qu'il a au moins une connexion ouverte et vivante. Deux onglets = un seul participant qui porte deux connexions. Seules l'ouverture de la première et la fermeture de la dernière changent l'état observable (`version + 1`, `lastChange {PRESENCE, participantId}`).
- Vivacité mesurée par le serveur seul : un pong **ou** n'importe quel message reçu (y compris `heartbeat`) compte comme activité. Aucune minuterie du client n'entre dans le calcul.
- Mettre à jour la dernière activité d'une connexion n'incrémente pas `version` et ne diffuse rien (AD-3).
- Toute mutation (connexion, fermeture, activité, balayage) passe par le verrou de la session : charger → règle → `version++` si changement observable → `save` → `publish` non bloquant.
- Le balayeur lit l'heure uniquement par `java.time.Clock` (UTC) ; délais en `Duration`, réglables : `planning-poker.ping-interval` (5 s), `planning-poker.liveness-timeout` (15 s), `planning-poker.sweep-interval` (1 s).
- Une fois la fermeture constatée par le serveur, le changement est diffusé en moins d'une seconde. Derrière Render, une fermeture propre met environ 5 s à atteindre le serveur : 6 s au plus de bout en bout (décision d'équipe du 2026-10-03).
- Participant déconnecté à l'écran : pseudo en `muted-foreground`, pastille grise, libellé « déconnecté » ; opacité inchangée ; sa carte garde son aspect (dos, vide ou face) ; il reste compté dans le M de « N votes sur M ».
- Journaux : désigner un participant par son `participantId`, jamais par son pseudo, son jeton ou l'identifiant de session.

**Never:**
- Pas de retrait au bout de 5 min ni d'expiration à 24 h (stories 2.3 et 2.5), pas de reconnexion client (story 2.2), pas de message « je pars » envoyé par le client.
- Pas de nouveau message applicatif ni de champ dans l'instantané : le contrat ne change pas (le ping est déjà décrit dans `asyncapi.yaml`).
- Ne pas lire l'heure par `Instant.now()`, `System.currentTimeMillis()` ni `System.nanoTime()` dans le domaine, l'application ou le balayeur.
- Ne pas envoyer le ping hors de la file d'envoi de la connexion (aucun envoi bloquant sous le verrou).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Deux onglets | Bob ouvre une 2ᵉ connexion | Rien d'observable ; Bob a deux connexions | N/A |
| Un onglet sur deux fermé | Bob ferme 1 connexion sur 2 | Bob reste `connected: true`, aucune diffusion | N/A |
| Dernier onglet fermé | Bob ferme sa dernière connexion | `connected: false`, `PRESENCE` diffusé à tous | N/A |
| Connexion vivante | pong ou message reçu toutes les 5 s | jamais fermée par le balayeur | N/A |
| Connexion muette | aucun pong ni message depuis 15 s | balayeur : connexion détachée puis fermée ; si c'était la dernière, `PRESENCE` diffusé | fermeture du socket sans effet si déjà fermé |
| Seuil exact | dernière activité il y a 14,999 s / 15 s | pas fermée / fermée | N/A |
| Fermeture après balayage | le socket fermé par le balayeur déclenche sa fermeture côté serveur | aucun second `PRESENCE`, aucune erreur | fermeture idempotente par connexion |
| Activité d'une connexion inconnue | pong reçu d'une connexion déjà détachée | ignoré | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/com/planningpoker/domain/Participant.java` -- porte aujourd'hui `int connections` ; à remplacer par les connexions identifiées et leur dernière activité.
- `backend/src/main/java/com/planningpoker/domain/Session.java` -- `connect`/`disconnect`/`withConnections` (l. 86-118) : règles de présence existantes, à étendre (identifiant de connexion, activité, connexions muettes). Une règle sans effet renvoie la même instance ; un changement caché garde la même `version`.
- `backend/src/main/java/com/planningpoker/application/SessionConnectionUseCase.java` -- `connect`/`disconnect` sous verrou ; ajouter l'activité. Motif à suivre pour le balayeur (rétrospective D1 : squelette répété).
- `backend/src/main/java/com/planningpoker/application/SessionBroadcaster.java` -- port ; ajouter une fermeture non bloquante d'une connexion.
- `backend/src/main/java/com/planningpoker/application/SessionStore.java` -- `all()` pour parcourir les sessions.
- `backend/src/main/java/com/planningpoker/adapter/in/ws/SessionSocketHandler.java` -- `handleTextMessage`, `afterConnectionClosed` ; ajouter `handlePongMessage`.
- `backend/src/main/java/com/planningpoker/adapter/in/ws/WebSocketBroadcaster.java` -- `ticker` (envoie déjà `tick` toutes les 5 s) ; `detach`, `closed` (une connexion détachée renvoie `null` à sa fermeture).
- `backend/src/main/java/com/planningpoker/adapter/in/ws/WsConnection.java` -- file d'envoi (`enqueue` n'accepte que `TextMessage`), `close`.
- `backend/src/main/java/com/planningpoker/config/SessionConfig.java`, `WebConfig.java` -- assemblage ; le bean `Clock` (UTC) existe dans `WebConfig`.
- `backend/src/test/java/com/planningpoker/domain/SessionPresenceTest.java`, `application/SessionConnectionUseCaseTest.java`, `application/RecordingBroadcaster.java`, `adapter/in/ws/SessionSocketHandlerTest.java` -- tests existants à adapter.
- `frontend/src/app/session/participant-table.component.ts` -- `noteOf` (mentions), classe `offline` déjà posée sur la place ; pastille déjà grise.
- `frontend/src/styles/table.css` -- `.seat-pseudo`, `.seat-note`, `.presence-offline`.
- `frontend/src/app/session/participant-table.component.spec.ts` -- l. 93-99 : le test exige aujourd'hui l'**absence** de « déconnecté » ; à inverser.
- Ne pas toucher : `contract/`, `SessionSnapshot` (le M compte déjà les déconnectés), `deploy/`.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/.../domain/Participant.java`, `Session.java` -- connexions identifiées avec leur dernière activité (`Instant`) ; `connect(participantId, connectionId, now)`, `disconnect(participantId, connectionId)` idempotent par connexion, `touch(connectionId, now)` (changement caché), `silentConnections(now, timeout)` -- le domaine porte la règle des 15 s, testable avec une horloge fixe.
- [ ] `backend/.../domain/SessionPresenceTest.java` -- couvrir chaque ligne de la matrice côté domaine, dont le seuil exact.
- [ ] `backend/.../application/SessionConnectionUseCase.java` -- passer l'identifiant de connexion et `Clock` ; ajouter `touch(sessionId, connectionId)` sans diffusion.
- [ ] `backend/.../application/SweepUseCase.java` (nouveau) -- pour chaque session : sous le verrou, détacher chaque connexion muette, appliquer `disconnect`, `save`, `publish` si la `version` change, puis demander la fermeture du socket ; une session qui disparaît pendant le balayage est ignorée -- AD-8.
- [ ] `backend/.../application/SessionBroadcaster.java`, `RecordingBroadcaster.java` -- `close(connectionId)` non bloquant.
- [ ] `backend/.../adapter/in/ws/WsConnection.java`, `WebSocketBroadcaster.java` -- la file accepte un ping ; le `ticker` envoie un ping de protocole à chaque connexion rattachée (intervalle `ping-interval`) ; `close` délégué à l'exécuteur d'envoi.
- [ ] `backend/.../adapter/in/ws/SessionSocketHandler.java` -- tout message reçu et tout pong d'une connexion rattachée appellent `touch`.
- [ ] `backend/.../adapter/in/scheduling/SweepScheduler.java` (nouveau) -- lance `SweepUseCase` toutes les `sweep-interval`, arrêté proprement (`DisposableBean`) ; une exception n'arrête pas les passages suivants.
- [ ] `backend/.../config/SessionConfig.java` -- assembler `SweepUseCase` avec `Clock` et `liveness-timeout`.
- [ ] Tests application et adaptateur -- balayeur avec horloge fixe (fermeture à 15 s, aucune avant), `touch` sans `version++` ni diffusion, fermeture après balayage sans second `PRESENCE`, ping envoyé par la file.
- [ ] `frontend/.../participant-table.component.ts`, `styles/table.css` -- déconnecté : mention « déconnecté » prioritaire dans la ligne de mention de la place, pseudo en `--muted-foreground`, opacité inchangée.
- [ ] `frontend/.../participant-table.component.spec.ts` -- inverser le test l. 93-99 ; vérifier carte inchangée et M inchangé.

**Acceptance Criteria:**
- Given Bob connecté dans deux onglets, when les autres regardent la table, then Bob apparaît une seule fois, connecté.
- Given Bob déconnecté, when la table s'affiche, then son pseudo est en `muted-foreground` avec la pastille grise et « déconnecté », sa carte garde son aspect et il reste compté dans « N votes sur M ».
- Given un tour révélé et Bob déconnecté sans vote, when la table s'affiche, then sa place montre la carte vide et la mention « déconnecté ».
- Given 13 participants dont plusieurs déconnectés sur PC 1280 × 650, when la table s'affiche, then elle tient toujours sans défilement (test de disposition existant vert).

## Design Notes

- **Pourquoi l'activité dans le domaine :** le balayeur et les stories 2.3 et 2.5 appliquent des règles de temps sous le verrou de la session ; tenir `lastSeenAt` par connexion dans `Session` les rend testables avec une horloge fixe, sans Spring. Une mise à jour d'activité crée une nouvelle instance de même `version` : rien n'est diffusé.
- **Fermeture par le balayeur :** détacher **avant** de fermer le socket, sous le verrou. Le `afterConnectionClosed` qui suit trouve une connexion déjà détachée (`closed` renvoie `null`) : aucun second `disconnect`.
- **Mention « déconnecté » :** une place n'a qu'une ligne de mention, pour garder la disposition à 13 places sans défilement. « déconnecté » y est prioritaire ; l'état du vote reste lisible par la carte (vide, dos ou face).
- **Risque Render :** si le proxy de Render répondait lui-même aux pings, un onglet en arrière-plan dont le navigateur ralentit `heartbeat` à une fois par minute pourrait être fermé à tort. À vérifier après déploiement (voir Vérification) ; en cas de problème, ne pas allonger le seuil sans décision d'équipe.

## Verification

**Commands:**
- `cd backend && ./mvnw -B verify` -- expected: tests domaine, application, adaptateur et ArchUnit verts.
- `cd frontend && npm test` -- expected: Vitest vert, dont la table.
- `cd frontend && npm run build:e2e && npm run e2e` -- expected: Playwright vert (Chromium et WebKit), dont la disposition.
- `node deploy/load-test.mjs --url <webservice local> --minutes 2` -- expected: OK, aucune connexion fermée par le balayeur.

**Manual checks (if no CLI):**
- Après déploiement sur Render : couper le wifi d'un téléphone connecté ; les autres le voient « déconnecté » en 15 à 20 s. Laisser un onglet en arrière-plan 20 min : il reste connecté.
