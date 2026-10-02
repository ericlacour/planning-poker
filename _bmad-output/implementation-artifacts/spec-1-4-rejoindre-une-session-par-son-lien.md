---
title: 'Story 1.4 : rejoindre une session par son lien'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: 'b26130a7c289523066d35219ff15fa4e704803d4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-3-creer-une-session-et-en-partager-le-lien.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un lien de session ouvre aujourd'hui la page de partage pour n'importe quel identifiant : on ne peut ni rejoindre une session existante, ni savoir qu'un lien est mort (FR2, FR3, UJ-2).

**Approach:** Ajouter `GET /api/sessions/{sessionId}` (204/404) et `POST /api/sessions/{sessionId}/participants` (pseudo libre → 200, pseudo pris → 409 `PSEUDO_TAKEN`), avec un `joinOrder` croissant tenu par la session ; côté front, le lien vérifie d'abord la session, puis affiche « Session introuvable », l'écran Rejoindre, ou la page de session si un jeton est déjà rangé.

## Boundaries & Constraints

**Always :**
- Domaine : `Session.join(participantId, pseudo, role, token)` renvoie une nouvelle session ; pseudo comparé par `Pseudo.uniquenessKey()` (casse ignorée après normalisation) → `PseudoTakenException` ; `joinOrder` = `nextJoinOrder`, puis `nextJoinOrder + 1` ; `version + 1`. Tests JUnit sans Spring. Le contrat impose `joinOrder ≥ 1` : le créateur reçoit 1 (corriger `Session.create` de la story 1.3, qui lui donne 0).
- Cas d'usage `JoinSessionUseCase` : sous `SessionLocks`, `find` → règle → `save` ; session absente → `SessionNotFoundException`. `CheckSessionUseCase` (ou méthode équivalente) pour l'existence.
- REST : `GET` → 204 sans corps ou 404 `SESSION_NOT_FOUND` ; `POST …/participants` → 200 `{participantId, participantToken}`, 400 `INVALID_PSEUDO` / malformé sans `code` (mêmes règles que la création, code partagé), 404 `SESSION_NOT_FOUND`, 409 `PSEUDO_TAKEN`. Corps des problèmes égal aux exemples `problem/*` du contrat (sauf `instance`, qui suit le chemin réel). Un `sessionId` de forme invalide est une session inconnue (404), jamais un 400.
- Ordre de vérification du `POST` : corps malformé (400) → session inconnue (404) → pseudo invalide (400) → pseudo pris (409).
- Front : `GET` d'abord à l'ouverture de `/s/{id}`. 404 → écran « Session introuvable » (titre « Cette session n'existe plus. », texte « Elle a peut-être expiré, ou le serveur a redémarré. », bouton « Créer une session » qui mène à l'accueil) et suppression de `pp.token.{id}`. 204 + jeton rangé → page de session ; 204 sans jeton → écran Rejoindre (même formulaire, bouton « Rejoindre », pseudo prérempli par `pp.pseudo`, « Je vote » présélectionné).
- Rejoindre réussi : jeton sous `pp.token.{id}`, pseudo sous `pp.pseudo`, puis page de session sans recharger. 409 : « Ce pseudo est déjà pris dans cette session. » sous le champ, saisie conservée. Réseau / 5xx : « Impossible de joindre le serveur. » sous le bouton. 404 au moment de rejoindre : écran « Session introuvable ».
- Échec réseau du `GET` initial : écran d'état « Impossible de joindre le serveur. » avec « Réessayer » qui relance la vérification.
- Libellés exacts, tutoiement ; CSP inchangée (styles globaux uniquement).

**Never :**
- Pas de reprise d'un participant déconnecté (FR-8, story 2.4) : en V1 de cette story, tout pseudo déjà présent donne 409.
- Pas de WebSocket (story 1.5) ; la page de session reste celle de la story 1.3.
- Aucune modification du contrat.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Session existe | `GET /api/sessions/{id}` connu | 204, corps vide | N/A |
| Session inconnue | id inconnu, ou de forme invalide (`abc`, 23 caractères) | 404 `SESSION_NOT_FOUND` | N/A |
| Rejoindre | `{"pseudo":"  Bob ","role":"VOTER"}` | 200, `participantId` UUID, jeton 22 car. ; `joinOrder` = 2 après le créateur (1) | N/A |
| Ordre | 3 arrivées successives | `joinOrder` 2, 3, 4, `version` incrémentée à chaque fois | N/A |
| Pseudo pris | créateur « Sofia », on rejoint avec `" sofia  "` | 409 `PSEUDO_TAKEN` | N/A |
| Pseudo pris NFC | « Élodie » (NFC) existe, on rejoint avec `"Élodie"` | 409 `PSEUDO_TAKEN` | N/A |
| Pseudo invalide | `"   "` sur session existante | 400 `INVALID_PSEUDO` | N/A |
| Rejoindre session inconnue | POST sur id inconnu, pseudo valide ou invalide | 404 `SESSION_NOT_FOUND` | N/A |
| Corps malformé | rôle inconnu, champ en plus, JSON invalide | 400 sans `code` | N/A |
| Concurrence | 20 `POST` simultanés avec des pseudos distincts | 20 participants, `joinOrder` 2..21 tous distincts | N/A |
| Front, lien mort | `GET` → 404 | « Cette session n'existe plus. » + « Elle a peut-être expiré, ou le serveur a redémarré. » + « Créer une session » ; jeton effacé | N/A |
| Front, Rejoindre | `GET` → 204, pas de jeton | formulaire, bouton « Rejoindre », « Je vote » sélectionné | N/A |
| Front, déjà membre | `GET` → 204, jeton rangé | page de session directement | N/A |
| Front, 409 | Rejoindre avec pseudo pris | « Ce pseudo est déjà pris dans cette session. » sous le champ, saisie conservée, bouton actif | N/A |
| Front, réseau | `GET` initial en échec | « Impossible de joindre le serveur. » + « Réessayer » | Réessayer relance le `GET` |

</frozen-after-approval>

## Code Map

- Story 1.3 (voir sa spec, Implementation Notes) : `domain/{Pseudo,Session,Participant,ParticipantToken,IdGenerator,Role}`, `application/{SessionStore,SessionLocks,CreateSessionUseCase}`, `adapter/in/rest/{SessionController,RestErrorHandler,CreateSessionRequest,MalformedRequestException}`, `config/SessionConfig` -- à étendre, pas à dupliquer. `Session` est un record immuable avec `nextJoinOrder`.
- `contract/examples/{join-session-request,join-session-response,problem}/` -- exemples à faire passer en aller-retour (`ContractRoundTripTest`, `frontend/src/app/api/contract.spec.ts`).
- Front 1.3 : `api/{contract,session-api}.ts` (ajouter `checkSession`, `joinSession`, erreurs `pseudoTaken`, `notFound`), `entry-form/entry-form.component.ts` (réutilisé tel quel : `submitLabel`, `pseudoError`, `submitError`), `home/home.component.ts` (modèle du flux de création), `storage/browser-storage.ts` (ajouter `removeToken`), `session/session-page.component.ts` (page provisoire), `wake/wake-screen.component.ts` + `styles/state-screen.css` (modèle d'écran d'état), `app.routes.ts`.
- Maquettes : `mockups/rejoindre.html` (Rejoindre, pseudo refusé), `mockups/etats.html` (Session introuvable).
- Outillage : `JAVA_HOME=/opt/jdk25`, `PATH=/opt/node24/bin:$PATH`, Chromium `/opt/pw-browsers/chromium`.

## Tasks & Acceptance

**Execution :**
- [x] `backend/.../domain/` -- `Session.join`, `PseudoTakenException`, tests (ordre, unicité casse/NFC/espaces, version).
- [x] `backend/.../application/` -- `JoinSessionUseCase`, vérification d'existence, `SessionNotFoundException` ; tests dont la concurrence.
- [x] `backend/.../adapter/in/rest/` -- `GET /api/sessions/{sessionId}`, `POST /api/sessions/{sessionId}/participants`, types requête/réponse, problèmes `SESSION_NOT_FOUND` et `PSEUDO_TAKEN` dans `RestErrorHandler` ; tests MVC de toute la matrice serveur et aller-retour des exemples.
- [x] `backend/.../config/SessionConfig.java` -- nouveaux beans.
- [x] `frontend/src/app/api/` -- `checkSession`, `joinSession`, parseur `parseJoinSessionResponse`, tests.
- [x] `frontend/src/app/session/` -- page d'entrée du lien (vérification puis aiguillage : introuvable / Rejoindre / session), écran Rejoindre, écran « Session introuvable », écran d'échec réseau avec « Réessayer » ; tests Vitest.
- [x] `frontend/src/app/storage/browser-storage.ts` -- `removeToken`.
- [x] `frontend/e2e/join-session.spec.ts` -- API simulée : lien mort, rejoindre, pseudo pris, déjà membre ; sans violation de CSP.

**Acceptance Criteria :**
- Étant donné le webservice réel en local et une session créée dans un premier navigateur, quand un second contexte ouvre le lien et rejoint avec un autre pseudo, alors il arrive sur la page de session ; avec le même pseudo en majuscules, il voit « Ce pseudo est déjà pris dans cette session. ».

## Implementation Notes

- **`joinOrder`** : `Session.FIRST_JOIN_ORDER = 1` ; `Participant` refuse désormais un `joinOrder < 1`. `Session.join` compare les `uniquenessKey()` de tous les participants (pas de reprise FR-8 : tout pseudo présent → `PseudoTakenException`).
- **Ordre de vérification du `POST`** : la forme du corps est vérifiée dans le contrôleur (Jackson + `isWellFormed`, règle partagée dans `EntryRequests`) ; puis, sous le verrou, `find` (404) → `Pseudo.of` (400 `INVALID_PSEUDO`) → `join` (409). `CheckSessionUseCase` : simple lecture, sans verrou.
- **Problèmes** : `title` standard de Spring (« Not Found », « Conflict »), `detail` repris des exemples du contrat ; `instance` = chemin réel de la requête.
- **Front** : `SessionEntryComponent` remplace `SessionPageComponent` sur la route `s/:sessionId` et l'affiche dans l'état `session` (même `ActivatedRoute`). Pendant la vérification, écran d'état vide `aria-busy` (pas de sablier). `checkSession` / `joinSession` ne reconnaissent un 404 / 409 qu'avec le `code` du contrat ; sinon `network`. Messages du formulaire regroupés dans `entry-form/entry-messages.ts`.
- **e2e 1.3** : `create-session.spec.ts` simule aussi `GET /api/sessions/{id}` → 204, la page du lien vérifiant désormais la session.
- **Acceptation** vérifiée avec le webservice réel (`PORT=4310`) et le front construit : création dans un contexte, « SOFIA » refusé puis « Bob » accepté dans un second, rafraîchissement → page de session directe, `/s/abc` → « Session introuvable ». Seule erreur console : celle que Chromium émet lui-même pour la réponse 409.

## Spec Change Log

- Avant implémentation : le contrat (`session-state.json`) impose `joinOrder ≥ 1`, or la story 1.3 donne 0 au créateur. Le créateur reçoit désormais 1, les suivants 2, 3… (matrice et règle domaine corrigées). État évité : un instantané hors contrat en story 1.5.

## Review Triage Log

| # | Source | Constat | Verdict | Suite |
|---|---|---|---|---|
| 1 | gap | Aucun test ne vérifie que `Participant` refuse `joinOrder` 0 | gap pré-vérifié | patch |
| 2 | edge | Identifiant de lien mal formé (`..`, `%2F`) : boucle « Réessayer » au lieu de « Session introuvable » | low : correction directe côté front | patch |
| 3 | edge | Stockage indisponible : après rechargement, son propre pseudo répond 409 | low : rare ; la reprise de place relève de la story 2.4 | rejeté |
| 4 | edge | Arrivées sans plafond, `nextJoinOrder` peut déborder | medium : même cause que les limites de ressources reportées en 1.3 | defer (entrée 1.3 complétée) |
| 5 | edge, blind | Un jeton rangé périmé ou corrompu mène à la page de session | low : la story 1.5 efface le jeton sur `4401` | rejeté |
| 6 | edge | Critère d'acceptation sur le vrai webservice non automatisé | false : vérifié manuellement (Implementation Notes) | rejeté |
| 7 | blind | Pseudo à espace insécable ou caractère invisible : sosie d'un participant | medium : règle `strip()` de la story 1.3 ; la changer touche l'intention | defer |
| 8 | blind | `pp.pseudo` (trim JS) diffère du pseudo serveur | low : déjà rejeté en 1.3 | rejeté |
| 9 | blind | Écran de vérification vide et muet ; `role="alert"` sur `<main>` ; focus non déplacé | low : accessibilité, story 3.5 | rejeté |
| 10 | blind | Pas d'e2e pour le 404 au moment de rejoindre ni `INVALID_PSEUDO` | low : couvert en Vitest | rejeté |
| 11 | blind | 409 systématique au lieu de la reprise d'un déconnecté (FR-8) non tracé | low : écart voulu par la spec | defer (repère pour la story 2.4) |
| 12 | blind | Le créateur repasse par `GET` après la création | low : un aller-retour de plus, sans effet visible en temps normal | rejeté |
| 13 | blind | `detail` des erreurs écrit deux fois | low : correction directe | patch |
| 14 | blind | Assertions manquantes (version finale en concurrence, rôle enregistré) | low : correction directe | patch |
| 15 | blind | Nettoyage des tests et doublon de SVG | low : cosmétique | rejeté |

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts.
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
