---
title: 'Story 2.5 : une session qui s''efface d''elle-même'
type: 'feature'
created: '2026-10-04'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une session vit aujourd'hui jusqu'au redémarrage du serveur : ses pseudos, votes et jetons restent en mémoire indéfiniment, contre FR4 et NFR6, et elle occupe une place du futur plafond de sessions (2.6).

**Approach:** Le balayeur supprime du `SessionStore`, sous le verrou de la session, toute session créée depuis 24 h ou plus (durée réglable `planning-poker.session-lifetime`, `24h` par défaut) et ferme toutes ses connexions en `4404`. Le front affiche déjà l'écran « Cette session n'existe plus. » et efface `pp.token.{sessionId}` sur `4404` comme sur un 404 : aucun changement côté front.

## Boundaries & Constraints

**Always:**
- Expirée quand `now >= createdAt + lifetime` (`java.time.Clock` UTC, `Duration`) : vivante à T + 23 h 59, supprimée au premier passage du balayeur à T + 24 h ou après.
- L'expiration est vérifiée en premier dans le passage du balayeur sur la session ; une session expirée n'est ni balayée (connexions muettes, absents) ni publiée : `delete`, puis pour chaque connexion ouverte `detach` puis demande de fermeture en `4404`. Détachée avant d'être fermée, sa fermeture ne produit aucun `disconnect`.
- Tout disparaît avec la session : participants, participants retirés (`departed`) et leurs jetons, votes. Ensuite `GET`, `join` et `hello` répondent comme pour une session inconnue (404 `SESSION_NOT_FOUND`, `4404`) — chemins existants.
- Journal : une ligne « Session expired » avec le nombre de connexions fermées ; jamais identifiant de session, pseudo, jeton ni vote.

**Never:**
- Pas de changement du contrat (`4404` et le 404 décrivent déjà « unknown or expired »), ni du front.
- Pas de vérification d'expiration dans les autres cas d'usage : une session expirée reste utilisable au plus un intervalle du balayeur (1 s).
- Pas de plafond (2.6), pas de prolongation de la durée par l'activité.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Avant l'échéance | créée à T, balayage à T + 23 h 59 | session présente, rien fermé | N/A |
| Échéance | créée à T, deux participants, trois connexions, balayage à T + 24 h | session absente du store, trois connexions détachées et fermées en `4404`, aucune publication | N/A |
| Sans connexion | créée à T, personne connecté, balayage à T + 25 h | session supprimée, rien à fermer | N/A |
| Après expiration | `hello` / `GET` / `join` sur la session supprimée | `4404` / 404 `SESSION_NOT_FOUND` | front : « Cette session n'existe plus. », jeton effacé (existant) |
| Plusieurs sessions | A expirée, B créée 1 h après | A supprimée, B balayée normalement | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/com/planningpoker/domain/Session.java` -- ajouter `isExpired(Instant now, Duration lifetime)` et `openConnections()` (toutes les `OpenConnection`, même forme que `silentConnections` l. 230-245).
- `backend/src/main/java/com/planningpoker/application/SweepUseCase.java` -- nouveau paramètre `sessionLifetime` ; dans `sweep(String)`, si expirée : `store.delete`, `detach` + fermeture `4404` de chaque connexion, journal, `return`. Mettre la Javadoc de classe à jour.
- `backend/src/main/java/com/planningpoker/application/SessionBroadcaster.java` -- ajouter `closeSessionNotFound(String connectionId)` (non bloquant, sans effet si fermée ou inconnue). Ne pas changer `close` (fermeture `SESSION_NOT_RELIABLE`, déclenche la reconnexion).
- `backend/src/main/java/com/planningpoker/adapter/in/ws/WebSocketBroadcaster.java` -- implémenter avec `connection.closeLater(SessionSocketHandler.SESSION_NOT_FOUND)`.
- `backend/src/main/java/com/planningpoker/config/SessionConfig.java` + `src/main/resources/application.properties` -- `planning-poker.session-lifetime=24h`, passé à `SweepUseCase`.
- `backend/src/test/java/com/planningpoker/application/RecordingBroadcaster.java` -- retenir les fermetures `4404` à part (`notFoundRequested`).
- Ne pas changer : `SessionConnectionUseCase` (session absente → `SessionNotFound` → `4404`, et `disconnect` ignore une session absente), `CheckSessionUseCase`, front.
- Modèles de test : `SweepUseCaseTest` (`MutableClock`, session créée avec `Clock.fixed(NOW)`), `SessionAbsenceTest`, `LivenessTest` (bout en bout, délais raccourcis par propriétés), `WebSocketBroadcasterTest`.

## Tasks & Acceptance

**Execution:**
- [ ] `domain/Session.java` + `domain/SessionExpiryTest.java` (nouveau) -- `isExpired` à T + 23 h 59 (faux) et T + 24 h (vrai), `openConnections`.
- [ ] `application/SessionBroadcaster.java`, `adapter/in/ws/WebSocketBroadcaster.java`, `RecordingBroadcaster.java` -- `closeSessionNotFound` ; test adaptateur dans `WebSocketBroadcasterTest` (fermeture reçue en `4404`, connexion inconnue sans effet).
- [ ] `application/SweepUseCase.java` + `SweepUseCaseTest.java` -- lignes de la matrice : avant / à l'échéance, sans connexion, plusieurs sessions, aucune publication, connexions détachées, puis `connect` → `SessionNotFound`.
- [ ] `config/SessionConfig.java`, `application.properties` -- propriété et assemblage.
- [ ] `adapter/in/ws/SessionExpiryTest.java` (nouveau, bout en bout comme `LivenessTest`, `session-lifetime=1s`, `sweep-interval=100ms`) -- un client connecté reçoit la fermeture `4404`, puis `GET /api/sessions/{id}` répond 404.

**Acceptance Criteria:**
- Given une session créée à T avec des participants connectés, when le balayeur passe à T + 24 h, then elle n'existe plus et chaque navigateur reçoit `4404`, affiche « Cette session n'existe plus. » avec « Créer une session » et efface son jeton.
- Given l'expiration, when les journaux sont lus, then aucun pseudo, jeton, vote ni identifiant de session n'y figure.
- Given la suite complète, when `./mvnw -B verify`, `npm test` (front) et `npm test` (contrat) tournent, then elles sont vertes, ArchUnit compris.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Nouvelle méthode du port plutôt qu'un code passé à `close` :** l'application ne connaît pas les codes WebSocket ; `close` (reconnexion) et `closeSessionNotFound` (fin définitive) sont deux intentions distinctes du domaine.
- **Pas de publication à l'expiration :** les destinataires vont être fermés ; un dernier instantané n'apporterait rien et pourrait arriver après la fermeture.

## Verification

**Commands:**
- `cd backend && ./mvnw -B verify` -- expected: vert.
- `cd frontend && npm test` -- expected: vert (aucun changement attendu).
- `cd contract && npm test` -- expected: vert (aucun changement attendu).
