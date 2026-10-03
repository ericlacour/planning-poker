---
title: 'Story 1.3 : créer une session et en partager le lien'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '3c4df2204da57a975659a158dad6ad1bfc636f22'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'outil n'a qu'un accueil provisoire : on ne peut ni créer de session, ni obtenir de lien à partager (FR1, UJ-1, UJ-3).

**Approach:** Livrer de bout en bout la création de session : le domaine (pseudo, session, participant, identifiants), le cas d'usage et le stockage en mémoire, `POST /api/sessions`, puis côté front le formulaire d'entrée de l'accueil, le stockage du jeton et du pseudo, et une page de session provisoire à `/s/{sessionId}` qui affiche le lien et « Copier le lien ».

## Boundaries & Constraints

**Always :**
- Pseudo normalisé par le **domaine** : NFC, `strip()` (espaces Unicode de début et de fin), 1 à 20 points de code ; sinon `INVALID_PSEUDO` (400 `problem+json`, `code: INVALID_PSEUDO`). Corps malformé (rôle inconnu, champ manquant ou en trop, JSON invalide, pseudo brut > 200 caractères) : 400 **sans** `code`.
- `sessionId` et `participantToken` : 16 octets `SecureRandom`, base64url sans remplissage (22 caractères) ; `participantId` : UUID aléatoire. Réponse 201 conforme à `create-session-response.json`.
- Écriture par le cas d'usage sous le verrou de la session : charger → règle → `save` (AD-3, AD-9). Le port `SessionStore` expose `find`, `save`, `delete`, `all`.
- Le jeton n'apparaît dans aucun journal ni URL ; aucun pseudo journalisé.
- Front : `pp.token.{sessionId}` et `pp.pseudo` en `localStorage` ; accès protégé par `try/catch` (stockage indisponible = pas de préremplissage, la création réussit quand même).
- Libellés exacts : « Ton pseudo », « Ton rôle », « Je vote », « J'observe », « Créer une session », « Connexion… », « Impossible de joindre le serveur. », « Copier le lien », « Lien copié », « Partage le lien pour inviter ton équipe ». Tutoiement.
- CSP inchangée : aucun style en ligne, styles dans des feuilles globales.

**Never :**
- Pas de WebSocket côté front (story 1.5), pas d'écran Rejoindre ni de `GET /api/sessions/{id}` (story 1.4), pas de table de participants.
- Aucun champ hors contrat, aucune modification du contrat.

**Décisions (prises par l'agent, l'utilisateur ayant délégué la validation à la fin de la série) :**
- **Adresse de session** : `/s/{sessionId}` (forme des maquettes). Le lien partagé est `location.origin + '/s/' + sessionId`.
- **Page de session provisoire** : barre du haut avec « Copier le lien », puis l'état « Session vide » d'EXPERIENCE (le lien affiché en clair, « Partage le lien pour inviter ton équipe », « Copier le lien » en bouton principal). La story 1.5 la remplacera par la table.
- **Partage** : `navigator.share({url})` si disponible **et** `matchMedia('(pointer: coarse)')` vrai ; sinon presse-papiers. « Lien copié » 2 s après une copie réussie. Un partage annulé ne montre rien.
- **`INVALID_PSEUDO` côté front** : inatteignable avec `maxlength="20"` et le bouton inactif sur pseudo vide ; s'il arrive, « Ce pseudo n'est pas valide. » sous le champ.
- **Tests du contrat** : des tests des deux côtés font l'aller-retour des exemples `create-session-request/*` et `create-session-response/*`, et des `problem/*` concernés, à travers les types écrits à la main, et comparent le JSON obtenu à l'exemple.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Création | `{"pseudo":"  Sofia ","role":"VOTER"}` | 201, `sessionId`/`participantToken` en `^[A-Za-z0-9_-]{22}$`, `participantId` UUID ; pseudo stocké « Sofia » | N/A |
| Observateur | `role: "OBSERVER"` | 201, participant observateur | N/A |
| Pseudo vide | `""` ou `"   "` | 400 `INVALID_PSEUDO` | N/A |
| Pseudo trop long | 21 points de code après normalisation | 400 `INVALID_PSEUDO` | N/A |
| Pseudo limite | 20 émojis (40 unités UTF-16) | 201 | N/A |
| NFC | `"é"` | pseudo stocké `"é"` (1 point de code) | N/A |
| Corps malformé | rôle `"ADMIN"`, champ manquant, champ en plus, JSON invalide, pseudo brut de 201 caractères | 400 `problem+json` sans `code` | N/A |
| Bouton | pseudo vide ou espaces | « Créer une session » inactif | N/A |
| Envoi | clic avec pseudo valide | « Connexion… », bouton inactif, champ lisible | N/A |
| Succès front | 201 | jeton sous `pp.token.{id}`, pseudo sous `pp.pseudo`, navigation vers `/s/{id}` | N/A |
| Réseau | échec `fetch` ou réponse 5xx | « Impossible de joindre le serveur. » + icône sous le bouton, saisie conservée, bouton actif | N/A |
| Préremplissage | `pp.pseudo` = « Eric » | champ prérempli « Eric » | stockage inaccessible : champ vide |
| Copie | clic « Copier le lien » sur PC | lien dans le presse-papiers, « Lien copié » 2 s | N/A |

</frozen-after-approval>

## Code Map

- `contract/openapi.yaml`, `contract/schemas/{create-session-request,create-session-response,common,role,problem}.json`, `contract/examples/{create-session-request,create-session-response,problem}/` -- forme exacte des échanges ; lecture seule.
- `backend/src/test/java/com/planningpoker/ContractExamples.java` -- lecture des exemples ; à réutiliser.
- `backend/src/test/java/com/planningpoker/ArchitectureTest.java` -- doit rester vert (domaine sans Spring/Jackson/jakarta ; couches).
- `backend/src/main/java/com/planningpoker/adapter/in/ws/SessionSocketHandler.java` -- ne pas toucher (story 1.5).
- `backend/src/main/resources/application.properties` -- `problemdetails` déjà activé.
- `frontend/src/app/app.routes.ts`, `home/home.component.ts` (accueil provisoire à remplacer), `app.ts` (barre du haut actuelle, toujours affichée), `config/app-config.ts` (`APP_CONFIG.apiBaseUrl`, fourni au démarrage dans `main.ts`).
- `frontend/src/styles.css` + `src/styles/*.css` -- feuilles globales ; jetons dans `tokens.css` (`--primary`, `--primary-soft`, `--danger`, `--border`, `--surface`, `--rounded-lg`, `--spacing-panel-narrow`…).
- Maquette : `_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/mockups/rejoindre.html` (formulaire d'entrée, Accueil PC) et `mockups/etats.html` (Session vide, `copy-link-button`). DESIGN.md › Components : `entry-form`, `copy-link-button`, `top-bar`.
- Outillage : `JAVA_HOME=/opt/jdk25`, Node 24 dans `/opt/node24/bin`, Chromium `/opt/pw-browsers/chromium`.

## Tasks & Acceptance

**Execution :**
- [x] `backend/src/main/java/com/planningpoker/domain/` -- `Pseudo` (normalisation, `InvalidPseudoException`, clé d'unicité `toLowerCase(Locale.ROOT)`), `Role`, `Participant` (id, pseudo, rôle, `joinOrder`, empreinte du jeton ou jeton), `Session` (id, participants, `version`, `roundId`, création avec son créateur), `IdGenerator` (port ou classe pure prenant un `RandomGenerator`) -- règles en Java pur.
- [x] `backend/src/main/java/com/planningpoker/application/` -- port `SessionStore`, `CreateSessionUseCase` (verrou par session, `Clock` injectée), résultat `{sessionId, participantId, participantToken}`.
- [x] `backend/src/main/java/com/planningpoker/adapter/out/memory/InMemorySessionStore.java` -- `ConcurrentHashMap`.
- [x] `backend/src/main/java/com/planningpoker/adapter/in/rest/SessionController.java` + gestion d'erreurs -- `POST /api/sessions` → 201 ; `INVALID_PSEUDO` → `ProblemDetail` 400 avec propriété `code` ; corps illisible → 400 sans `code`.
- [x] `backend/src/main/java/com/planningpoker/config/` -- beans `SecureRandom`, store, cas d'usage.
- [x] `backend/src/test/java/...` -- tests JUnit du domaine sans Spring (toutes les lignes pseudo de la matrice), test du cas d'usage, test MVC du contrôleur (201, 400 avec et sans `code`, corps conforme), aller-retour des exemples du contrat, test qu'aucun journal ne contient le jeton.
- [x] `frontend/src/app/api/` -- `SessionApi` (`createSession` par `fetch` vers `apiBaseUrl`, erreurs typées : `invalidPseudo`, `network`) et types TS écrits à la main.
- [x] `frontend/src/app/storage/browser-storage.ts` -- `pp.token.{id}`, `pp.pseudo`, sûr si le stockage lève.
- [x] `frontend/src/app/entry-form/entry-form.component.ts` -- formulaire réutilisable (libellé du bouton en entrée, état « Connexion… », erreurs sous le champ ou sous le bouton), Entrée valide, groupe de rôle accessible (`role="radiogroup"` ou boutons `aria-pressed`).
- [x] `frontend/src/app/home/home.component.ts` -- accueil avec le formulaire, création, stockage, navigation.
- [x] `frontend/src/app/session/session-page.component.ts` + `share/copy-link.ts` -- page provisoire et bouton « Copier le lien » (partage natif ou copie, « Lien copié » 2 s) ; route `s/:sessionId` dans `app.routes.ts`.
- [x] `frontend/src/styles/entry-form.css`, `copy-link.css` (et imports dans `styles.css`) -- apparence DESIGN.
- [x] `frontend/src/**/*.spec.ts` -- Vitest : bouton inactif, « Connexion… », erreurs, stockage, préremplissage, copie, aller-retour des exemples du contrat.
- [x] `frontend/e2e/create-session.spec.ts` -- Playwright, API simulée : créer, arriver sur `/s/{id}`, copier le lien, échec réseau ; sans violation de CSP.

**Acceptance Criteria :**
- Étant donné l'accueil, quand je l'ouvre, alors je vois un panneau de 400 px avec « Ton pseudo », « Ton rôle » (« Je vote » sélectionné) et « Créer une session » pleine largeur.
- Étant donné le webservice réel lancé en local, quand je crée une session depuis le front, alors j'arrive sur `/s/{sessionId}` avec le lien affiché, et aucune erreur n'apparaît en console.

## Implementation Notes

- **`type` des problèmes** : Spring 7 omet `type` quand il vaut `about:blank`, alors que `problem.json` l'exige. `RestErrorHandler` étend `ResponseEntityExceptionHandler` (l'auto-configuration Boot s'efface) et pose `type: about:blank` sur tous les `ProblemDetail`, y compris les 400 de corps illisible.
- **Corps strict** : `spring.jackson.deserialization.fail-on-unknown-properties=true` (champ en trop) et `JacksonConfig` (un nombre ou un booléen n'est jamais lu comme texte : `{"pseudo":42}` → 400 sans `code`). `spring.jackson.mapper.allow-coercion-of-scalars` n'a pas d'effet sous Jackson 3.
- **Jeton** : le domaine n'en garde que l'empreinte SHA-256 (`ParticipantToken`), comparée à temps constant ; `toString()` de `Pseudo`, `CreateSessionResult`, `CreateSessionRequest/Response` ne révèle ni pseudo ni jeton. Le seul journal émis (`Session created by participant {id}`) ne contient pas non plus l'identifiant de session.
- **Verrou par session** : `SessionLocks`, 64 verrous indexés par le hachage de l'identifiant (rien à nettoyer quand une session disparaît). Collision d'identifiant de session : nouveau tirage.
- **Barre du haut** : `TopBarState.shareUrl` (signal) ; la page de session le pose à sa création et l'efface à sa destruction, `App` affiche alors « Copier le lien ». Sous 600 px, le libellé passe en masqué accessible (icône seule).
- **`maxlength="20"`** compte en unités UTF-16 : 20 émojis ne se saisissent pas depuis le front (accepté par le webservice). Conforme à la décision de la spec.
- **Presse-papiers refusé** : rien n'est affiché ; le lien reste lisible en clair dans la page.

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Suite |
|---|---|---|---|---|
| 1 | edge | `maxlength="20"` compte les unités UTF-16 : 20 émojis impossibles à saisir | low : réel, mais c'est la décision de la spec | rejeté (corriger = modifier la spec) |
| 2 | edge, blind | `trim()` JS et `strip()` Java diffèrent (NBSP) ; `pp.pseudo` non NFC | low : le front est plus strict, écart cosmétique | rejeté |
| 3 | edge, blind | Pseudo invisible (U+200B) accepté | low : conforme à la règle `strip()` de la spec, cas rare | rejeté |
| 4 | edge, blind | `navigate` dans le `try` réseau : erreur trompeuse et seconde session ; `false` bloque « Connexion… » | low : correction directe | patch |
| 5 | edge | Composant réutilisé si `/s/a` → `/s/b` | false : aucune navigation entre sessions dans l'application ; page remplacée en 1.4 | rejeté |
| 6 | edge, blind | `/s/{id}` affiche le partage pour tout identifiant | low : l'intention réserve la vérification à la story 1.4 | rejeté |
| 7 | edge | `share` rejeté autrement qu'en `AbortError` : bouton muet | medium : téléphone sans retour | patch (repli presse-papiers) |
| 8 | edge | `AbortSignal.timeout` absent avant Safari 16 | false : cible = deux dernières versions | rejeté |
| 9 | edge, blind | Boucle de tirage d'identifiant sans borne | low : probabilité 2⁻¹²⁸, garde = complexité | rejeté |
| 10 | edge | Rôle numérique (`"role":0`) peut-être accepté | maybe-false → vérifié par un test | patch (test, correction si besoin) |
| 11 | edge | Clés JSON en double : la dernière gagne | low : improbable | rejeté |
| 12 | edge, blind | Pas de limite de taille de corps, de nombre de sessions ni de débit | medium : épuisement mémoire possible | defer |
| 13 | edge, blind | Une 500 ne renvoie pas de `problem+json` | false : le contrat ne garantit pas le corps de `default` | rejeté |
| 14 | edge | Erreur de pseudo restée affichée après correction | low : `INVALID_PSEUDO` inatteignable en 1.3 | rejeté |
| 15 | blind | Invariants de `Session` / `ParticipantToken` non vérifiés | low : aucun appelant fautif identifié | rejeté |
| 16 | blind | `pp.token.*` s'accumulent dans le stockage | low : stockage par session voulu (AD-7) | rejeté |
| 17 | blind, gap | Absence du `sessionId` dans les journaux non vérifiée | gap pré-vérifié | patch |
| 18 | blind, gap | `SessionLocks` jamais testé entre fils | gap pré-vérifié | patch |
| 19 | blind | e2e : un test sans contrôle CSP/console | low : correction directe | patch |
| 20 | blind | « Lien copié » invisible sous 600 px dans la barre du haut | low : sur téléphone, le partage natif s'ouvre ; la Session vide montre le retour | rejeté |
| 21 | blind | Corps malformé non comparé à l'exemple du contrat | low : correction directe | patch |
| 22 | gap | Coercition flottant / booléen non testée | gap pré-vérifié | patch |
| 23 | gap | Délai de 15 s jamais vérifié | gap pré-vérifié | patch |

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts (30 existants + nouveaux).
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
