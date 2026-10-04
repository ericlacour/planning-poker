---
title: 'Story 2.3 : revenir après une longue absence'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: '099130b7d80caf2ae640271576c91db29bffc01d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aujourd'hui, un participant déconnecté garde sa place et son pseudo indéfiniment : un téléphone verrouillé ou un collègue parti laisse une place fantôme comptée dans « N votes sur M ». Le contrat (`asyncapi.yaml`, étape 4 de la poignée de main) prévoit déjà le retrait au bout de 5 min et le retour transparent, mais le webservice ne les fait pas (FR7, FR9, AD-7, AD-8).

**Approach:** Le balayeur retire, sous le verrou de la session, tout participant sans aucune connexion depuis 5 min (`LEAVE`) ; la session garde son jeton à part. Au `hello` avec ce jeton, si le pseudo est encore libre, le participant est remis à sa place en une seule mutation (`JOIN`, connecté) ; sinon `4401`. Le client actuel (story 2.2) suffit : « Reconnexion… » puis la table, ou l'écran Rejoindre prérempli.

## Boundaries & Constraints

**Always:**
- « Sans connexion depuis » : depuis la fermeture de sa dernière connexion, ou depuis son entrée (création, `join`) s'il n'en a jamais ouvert. Une connexion ouverte, même muette mais pas encore fermée par le balayeur, empêche le retrait.
- Retrait à `offlineSince + 5 min` exactement (pas avant, comparaison `!isAfter`) : place, vote du tour et marque d'arrivée tardive supprimés ; `version + 1`, `lastChange { LEAVE, participantId }`, publié aux connectés. Plusieurs retraits dans un même passage : une mutation et une diffusion par participant, comme les connexions muettes.
- Le participant retiré (identifiant, pseudo, rôle, jeton) est conservé hors de `participants` : absent de l'instantané, de « N votes sur M » et du contrôle d'unicité du pseudo.
- `hello` : session d'abord (`4404`), puis jeton actif → reconnexion inchangée ; jeton d'un participant retiré dont le pseudo est libre (même règle de casse que `join`) → remis à sa place : même `participantId`, pseudo, rôle et jeton, nouveau `joinOrder`, arrivée tardive si le tour est révélé (règle de `join`), déjà connecté, `version + 1`, `lastChange { JOIN }`, une seule diffusion ; pseudo pris → `4401`, et l'entrée retirée est conservée.
- Délai réglable `planning-poker.absence-timeout` (défaut `5m`) ; heure lue par `Clock` uniquement, `Duration` partout.
- Journaux : seulement l'identifiant du participant, jamais jeton, pseudo, vote ni identifiant de session.

**Never:**
- Pas de changement du contrat, du front, ni des codes de fermeture.
- Pas de reprise depuis un autre appareil (story 2.4), pas d'expiration de session (2.5), pas de plafond (2.6).
- Pas de diffusion `PRESENCE` en plus du `JOIN` lors d'un retour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Retrait | dernière connexion fermée à T, balayeur à T + 5 min | retiré, vote supprimé, `LEAVE` diffusé | N/A |
| Pas avant | balayeur à T + 5 min − 1 ms | rien ne change, rien n'est diffusé | N/A |
| Jamais connecté | `join` REST à T, aucun `hello`, balayeur à T + 5 min | retiré (`LEAVE`) | N/A |
| Onglet en arrière-plan | connexion ouverte et vivante pendant 20 min | jamais retiré | N/A |
| Retour, pseudo libre | `hello` avec le jeton du retiré | même `participantId`, pseudo, rôle ; `joinOrder` suivant ; connecté ; `JOIN` diffusé une fois ; instantané reçu | N/A |
| Retour, tour révélé | idem pendant un tour révélé | `canVoteThisRound=false` jusqu'au `clear` | N/A |
| Pseudo pris | « bob » retiré, un autre entre en « Bob », puis `hello` du retiré | fermeture `4401`, rien ne change | le client efface le jeton, écran Rejoindre prérempli |
| Retiré deux fois | revenu puis de nouveau absent 5 min | retiré à nouveau, puis peut revenir | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/com/planningpoker/domain/Participant.java` -- ajouter `Instant offlineSince` (nul si connecté) : posé à l'entrée et par `withoutConnection` quand la dernière connexion se ferme, effacé par `withActivity`. Constructeur court à adapter (prend `now`).
- `backend/src/main/java/com/planningpoker/domain/Session.java` -- record immuable ; ajouter les participants retirés (`List<Participant> departed`, copie défensive) au record et à **tous** les `new Session(...)`. `create`/`join` prennent `now`. Nouvelles règles : `absentParticipants(now, timeout)` (miroir de `silentConnections`), `remove(participantId)` → `LEAVE`, `departedWithToken(token)`, `rejoin(participantId, connectionId, now)` → `JOIN` + connecté, `PseudoTakenException` si pris. `withParticipant` garde sa règle `PRESENCE`.
- `backend/src/main/java/com/planningpoker/domain/SessionSnapshot.java` -- lit `participants` seulement : ne pas changer.
- `backend/src/main/java/com/planningpoker/application/SweepUseCase.java` -- après les connexions muettes, sous le même verrou : retirer les absents (`save` + `publish` par retrait). Constructeur + `absenceTimeout`.
- `backend/src/main/java/com/planningpoker/application/SessionConnectionUseCase.java` -- `connect` : jeton actif inchangé ; sinon `departedWithToken` → `attach` puis `rejoin` (pseudo pris → `UnknownToken`, sans `attach`) ; `publish` (le retour change toujours la version).
- `backend/src/main/java/com/planningpoker/application/JoinSessionUseCase.java`, `CreateSessionUseCase.java` -- passer `clock.instant()` ; `JoinSessionUseCase` reçoit un `Clock`.
- `backend/src/main/java/com/planningpoker/config/SessionConfig.java`, `src/main/resources/application.properties` -- câbler `Clock` et `planning-poker.absence-timeout=5m`.
- `backend/src/main/java/com/planningpoker/adapter/in/ws/SessionSocketHandler.java` -- `Connected(participantId)` couvre déjà le retour : ne pas changer.
- Tests : `MutableClock`, `RecordingBroadcaster` à réutiliser ; `SweepUseCaseTest`, `SessionPresenceTest`, `SessionConnectionUseCaseTest` comme modèles. Tous les tests qui construisent `Session`, `Participant` ou appellent `join` sont à adapter.

## Tasks & Acceptance

**Execution:**
- [x] `domain/Participant.java`, `domain/Session.java` -- `offlineSince`, liste des retirés, règles `absentParticipants`, `remove`, `departedWithToken`, `rejoin` ; adapter les appels.
- [x] `domain/SessionAbsenceTest.java` (nouveau) -- horloge fixe : 5 min − 1 ms / 5 min, jamais connecté, connexion ouverte jamais retirée, retrait (vote, arrivée tardive, absent de l'instantané et de `progress`), retour (même id, `joinOrder` suivant, tour révélé), pseudo pris (casse), retrait répété.
- [x] `application/SweepUseCase.java`, `SessionConnectionUseCase.java`, `JoinSessionUseCase.java`, `CreateSessionUseCase.java`, `config/SessionConfig.java`, `application.properties` -- câblage décrit dans le Code Map.
- [x] `application/SweepUseCaseTest.java`, `SessionConnectionUseCaseTest.java` -- retrait diffusé en `LEAVE` et une seule diffusion `JOIN` au retour ; `4401` (`UnknownToken`) sans diffusion si pseudo pris ; connexion muette fermée à 15 s puis retrait à 15 s + 5 min.

**Acceptance Criteria:**
- Given un participant retiré, when les autres reçoivent l'instantané, then sa place a disparu et « N votes sur M » ne le compte plus.
- Given un participant retiré dont le pseudo est libre, when son navigateur se reconnecte, then il retrouve la table sans écran intermédiaire et les autres le voient arriver en `JOIN`.
- Given la suite complète, when `./mvnw -B verify` tourne, then elle est verte, ArchUnit compris.

## Design Notes

- **Retour en une seule mutation :** `JOIN` puis `PRESENCE` diffuserait deux instantanés pour un seul fait, et un retour non connecté serait aussitôt éligible au retrait.
- **`offlineSince` plutôt que l'activité des connexions :** une connexion vivante dans un onglet caché n'a pas d'activité utilisateur, mais elle est ouverte ; seul l'état réseau compte (FR9).

## Verification

**Commands:**
- `cd backend && ./mvnw -B verify` -- expected: vert.
- `cd frontend && npm test` -- expected: vert (aucun changement attendu).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | blind, edge | `absence-timeout` nul ou négatif non refusé | low | Réel seulement sur une mauvaise configuration ; la correction ajoute une garde. | rejeté |
| 2 | blind, edge | La liste `departed` ne se vide jamais ; des `join` sans connexion la remplissent | medium | Vérifié : seules les entrées revenues sortent ; la session (24 h, story 2.5) borne la durée, pas le volume. | reporté (2.6) |
| 3 | edge | Session vide conservée après le retrait de tous | low | Voulu : l'expiration est la story 2.5 (exclue par l'intention). | rejeté |
| 4 | vgap | Heure d'entrée passée par `JoinSessionUseCase` non vérifiée (entrée à `createdAt` dans le test) | low | Constat vérifié par le relecteur. | patch : entrée décalée, 5 min − 1 ms / 5 min |
| 5 | vgap | Câblage de `planning-poker.absence-timeout` non testé dans un contexte Spring | low | Câblage direct, comme les autres délais du balayeur. | rejeté |
| 6 | blind | Invariant `participants` / `departed` disjoints non imposé par le record | low | Tenu par les seules règles qui les modifient ; la garde ajouterait de la complexité. | rejeté |
| 7 | blind | Invariant `offlineSince` de `Participant` non testé | low | Vérifié : `ParticipantTest` ne l'exerce pas. | patch : tests ajoutés |
| 8 | blind | Le retrait pendant un tour révélé change la synthèse | false | Voulu : FR9 et la story suppriment le vote du tour au retrait. | rejeté |
| 9 | blind | Pas de test de bout en bout du retour via le socket | low | `SessionSocketHandler` inchangé ; `Connected` et `UnknownToken` déjà couverts de bout en bout. | rejeté |
| 10 | blind | Retour refusé (pseudo pris) non journalisé | low | Vérifié ; correction directe. | patch : une ligne de journal (identifiant seul) |
| 11 | blind | Deux lignes de journal pour un retour | low | Deux faits distincts (retour, connexion ouverte). | rejeté |
| 12 | blind | `withNewcomer` filtre `departed` à chaque `join` | low | Coût négligeable. | rejeté |
| 13 | blind | `Participant.returning` crée un état aussitôt remplacé | low | Sans effet observable. | rejeté |
| 14 | blind | `java.time.Instant` qualifié dans `ParticipantTest` | low | Correction directe. | patch |
| 15 | blind | Ordre d'import, champ au milieu des tests, indentation | low | Corrections directes. | patch |
| 16 | blind | Horloge fixe recréée plusieurs fois dans les tests | low | Cosmétique. | rejeté |
