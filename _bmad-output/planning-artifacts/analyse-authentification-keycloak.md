# Analyse : connexion des utilisateurs par Keycloak

- **Date :** 2026-10-13
- **Statut :** analyse d'impact, aucune modification de code
- **Besoin :**
  1. l'utilisateur se connecte par Keycloak, et Keycloak contrôle qu'il a le droit d'utiliser l'application ;
  2. son **nom** (venu de Keycloak) s'affiche à la place du pseudo saisi.

---

## 1. Synthèse

| Point | Aujourd'hui | Avec Keycloak |
| --- | --- | --- |
| Accès | Anonyme, « sans compte » | Connexion obligatoire (OIDC, Authorization Code + PKCE) et rôle Keycloak requis |
| Identité d'un participant | Pseudo saisi + `participantToken` (secret par session, dans le `localStorage`) | Identifiant Keycloak `sub`, prouvé par le jeton d'accès (JWT) |
| Nom affiché | Pseudo saisi, 1 à 20 points de code, unique dans la session (casse ignorée) | Claim `name` du jeton (repli : `preferred_username`), jamais saisi |
| Unicité | Par pseudo (`PSEUDO_TAKEN`) | Par `sub` : deux homonymes sont deux participants distincts |
| Reprise depuis un autre appareil (FR-8) | Rejoindre avec le pseudo d'un participant déconnecté, révocation de l'ancien jeton | Automatique : le même utilisateur retrouve sa place sur tous ses appareils |
| REST | Sans authentification | `Authorization: Bearer <jeton d'accès>` sur tout `/api/**` sauf `/api/health` |
| WebSocket | `hello {participantToken}` | `hello {accessToken}` (un navigateur ne peut pas poser d'en-tête sur un WebSocket) |

Le changement touche les **quatre couches** (Keycloak, contrat, webservice, front), plus les tests, le déploiement et les documents de cadrage (PRD, architecture). C'est une évolution de rupture : il faut un **nouvel AD** qui remplace AD-7 et un déploiement coordonné (§ 9).

**Recommandation principale :** faire de `sub` l'identité du participant et **supprimer le `participantToken`** (option B, § 4). Le garder (option A) coûte presque aussi cher et laisse deux mécanismes d'identité à maintenir.

---

## 2. Flux cible

```mermaid
sequenceDiagram
    autonumber
    participant N as Navigateur (Angular)
    participant K as Keycloak
    participant W as Webservice

    N->>N: lit /config.json (apiBaseUrl, issuer, clientId)
    N->>K: redirection /auth (Authorization Code + PKCE)
    K->>K: authentification + contrôle du rôle d'accès
    K-->>N: code → jeton d'accès (JWT), jeton de rafraîchissement
    N->>W: POST /api/sessions/{id}/participants {role}<br/>Authorization: Bearer JWT
    W->>W: vérifie signature (JWKS), iss, aud, exp, rôle
    W-->>N: 200 {participantId}
    N->>W: WS /ws/sessions/{id}
    N->>W: hello {accessToken}
    W->>W: vérifie le JWT, retrouve le participant par sub
    W-->>N: sessionState (participants[].pseudo = nom Keycloak)
```

Deux niveaux de contrôle du droit d'usage :

1. **Keycloak** refuse la connexion à qui n'a pas le rôle (politique d'accès du client, ou flux d'authentification avec condition sur le rôle) : l'utilisateur ne revient même pas dans l'application.
2. **Le webservice** revérifie le rôle dans chaque jeton (REST et `hello`) : c'est la seule barrière qui compte vraiment, le front pouvant être contourné.

---

## 3. Keycloak (configuration, pas de code)

| Élément | Réglage proposé |
| --- | --- |
| Realm | celui de l'entreprise (à confirmer) |
| Client front | `planning-poker`, **public** (pas de secret dans un SPA), *Standard flow* seul, PKCE `S256` obligatoire, *Direct access grants* et *Implicit flow* désactivés |
| Redirect URIs | `https://<front>/*` (et `http://localhost:4200/*` pour le développement local, dans un realm de dev) |
| Web origins | `https://<front>` (CORS de l'endpoint de jeton) |
| Rôle d'accès | rôle client `planning-poker:user` (ou groupe AD/LDAP mappé sur ce rôle) |
| Audience | *Audience mapper* ajoutant `planning-poker-api` dans `aud`, pour que le webservice n'accepte pas un jeton émis pour une autre application |
| Claims | `name`, `preferred_username` (scope `profile`) ; les rôles clients sont dans `resource_access.planning-poker.roles` |
| Durées | jeton d'accès 5 min (défaut), session SSO ≥ durée d'un atelier (2 h à 8 h) ; rafraîchissement par *refresh token*, pas par iframe |
| Refus d'accès | *Client policy* / flux d'authentification conditionnel « rôle requis » : l'utilisateur sans rôle voit l'écran de refus de Keycloak |

Optionnel : un second rôle `planning-poker:facilitator` si la **création** de session doit être réservée à certains (question ouverte, § 11).

---

## 4. Choix de conception : que devient le `participantToken` ?

### Option A — on garde le `participantToken`, on ajoute le JWT

- REST et `hello` portent les deux ; le serveur vérifie que `jwt.sub == participant.userId`.
- Peu de changement dans le front de session, mais deux identités à garder cohérentes, la logique de reprise par pseudo devient absurde (le pseudo n'est plus saisi), et la révocation `4401` « ta place a été reprise » chasse le même utilisateur de son autre appareil.

### Option B — l'identité est `sub` (recommandée)

- Le `Participant` porte un `UserId` (le `sub`) à la place de `ParticipantToken`.
- `POST /participants` devient **idempotent** : le même utilisateur qui rejoint deux fois retrouve sa place (même `participantId`, rôle, vote). Pas de jeton à révoquer, plusieurs appareils en même temps (AD-8 gère déjà plusieurs connexions).
- `hello {accessToken}` : session inconnue → `4404` ; JWT invalide ou expiré → nouveau code `4440` ; rôle absent → nouveau code `4403` ; utilisateur pas (ou plus) participant → `4401` (le front affiche « Rejoindre »).
- Retour après longue absence (FR-9) : le participant retiré est retrouvé par `sub`, sans le contrôle « pseudo repris entre-temps ».
- Disparaissent : `ParticipantToken`, `PseudoTakenException`, `PSEUDO_TAKEN`, `INVALID_PSEUDO`, la clé `pp.token.{sessionId}`, la reprise par pseudo.

La suite du document décrit l'option B.

---

## 5. Contrat (`contract/`, AD-6)

| Fichier | Modification |
| --- | --- |
| `openapi.yaml` | `securitySchemes.keycloak` (type `oauth2` / `openIdConnect`), `security` sur les trois endpoints de session ; `/api/health` reste public. Nouvelles réponses `401` (`UNAUTHENTICATED`) et `403` (`FORBIDDEN`) en `problem+json`. Suppression de `409 PSEUDO_TAKEN` et `400 INVALID_PSEUDO`. Le `participantToken` disparaît des réponses. |
| `schemas/create-session-request.json`, `join-session-request.json` | `pseudo` retiré de `required` (puis du schéma) : seuls `role` et `deck` restent. |
| `schemas/create-session-response.json`, `join-session-response.json` | `participantToken` retiré. |
| `schemas/hello.json` | `participantToken` remplacé par `accessToken` (chaîne JWT, `maxLength` ≈ 8 000). |
| `schemas/common.json` | `pseudo` (1 à 20) → nom affiché, 1 à **64** points de code (description « nom Keycloak normalisé ») ; `rawPseudo`, `participantToken` supprimés. On peut garder le nom de champ `pseudo` dans `session-state.json` pour limiter le diff, ou le renommer `displayName` (plus juste, mais tout le front et les exemples bougent). |
| `asyncapi.yaml` | Codes de fermeture `4403` (accès refusé) et `4440` (jeton d'accès invalide ou expiré : rafraîchir puis se reconnecter) ; `4401` redéfini (« pas participant de cette session »). |
| `examples/` | Supprimer `problem/pseudo-taken.json`, `problem/bad-request-invalid-pseudo.json` ; ajouter `problem/unauthenticated.json`, `problem/forbidden.json` ; mettre à jour les requêtes, réponses, `hello/hello.json` et les instantanés (noms complets). |

> AD-13 impose un contrat qui ne change que par ajout. L'authentification casse forcément les clients existants (un ancien front ne sait pas obtenir de jeton) : il faut l'acter dans le nouvel AD comme **exception unique**, avec un déploiement coordonné (§ 9).

---

## 6. Webservice (`backend/`)

### 6.1 Dépendances et configuration

- `pom.xml` : `spring-boot-starter-oauth2-resource-server` (Spring Security + Nimbus JOSE) ; en test, `spring-security-test`.
- `application.properties` (AD-12, uniquement par variables d'environnement) :

  ```properties
  spring.security.oauth2.resourceserver.jwt.issuer-uri=${KEYCLOAK_ISSUER_URI}
  planning-poker.auth.audience=${KEYCLOAK_AUDIENCE:planning-poker-api}
  planning-poker.auth.client-id=${KEYCLOAK_CLIENT_ID:planning-poker}
  planning-poker.auth.required-role=${KEYCLOAK_REQUIRED_ROLE:user}
  planning-poker.max-ws-message=16KB
  ```

  `max-ws-message` passe de 4 KB à 16 KB : un JWT Keycloak fait 1 à 3 KB, davantage avec beaucoup de rôles ou de groupes, et le `hello` le transporte. Sinon le conteneur ferme en `1009` et le client boucle en reconnexion.

### 6.2 Nouveau `config/SecurityConfig`

- `SecurityFilterChain` sans état : CSRF désactivé (jeton porteur, pas de cookie), `sessionManagement(STATELESS)`, `cors(withDefaults())` pour réutiliser la configuration CORS existante.
- Règles : `/api/health` → `permitAll` ; `/ws/**` → `permitAll` **au niveau HTTP** (l'authentification se fait dans le `hello`) ; `/api/**` → `hasAuthority("ROLE_" + requiredRole)` ; tout le reste refusé.
- `JwtAuthenticationConverter` personnalisé : lit `resource_access.<clientId>.roles` (et éventuellement `realm_access.roles`) pour produire les autorités.
- `JwtDecoder` avec validateurs : émetteur (`issuer-uri`), expiration (tolérance d'horloge 30 s), **audience** (`aud` contient `planning-poker-api`).
- Erreurs `401`/`403` en `application/problem+json` avec `code` `UNAUTHENTICATED` / `FORBIDDEN` (un `AuthenticationEntryPoint` et un `AccessDeniedHandler` alignés sur `RestErrorHandler`).
- `WebConfig.addCorsMappings` : ajouter `Authorization` à `allowedHeaders`.

### 6.3 Hexagone (AD-1 : le domaine reste pur)

| Couche | Modification |
| --- | --- |
| `domain` | Nouveau `UserId` (valeur opaque, le `sub`) ; `Pseudo` devient `DisplayName` (NFC, `strip`, 1 à 64 points de code, **tronqué** plutôt que refusé, `toString` sans la valeur ; plus de `uniquenessKey`). `Participant` : `UserId userId` à la place de `ParticipantToken token`, `withToken` supprimé. `Session.join` : retrouve le participant par `userId` (actif ou retiré) au lieu du pseudo ; plus de `PseudoTakenException` ; `participantWithToken` / `departedWithToken` → `participantOf(UserId)` / `departedOf(UserId)`. Le nom affiché est **mis à jour** à chaque entrée (il peut avoir changé dans l'annuaire). Suppression de `ParticipantToken`, `PseudoTakenException`, `InvalidPseudoException`. |
| `application` | Nouveau record `AuthenticatedUser(UserId id, DisplayName name)`, construit par les adaptateurs. `CreateSessionUseCase.create(user, role, deck)`, `JoinSessionUseCase.join(sessionId, user, role)`, `SessionConnectionUseCase.connect(sessionId, user, connectionId)`. `ConnectResult.UnknownToken` → `NotAParticipant`. Résultats sans `participantToken`. |
| `adapter.in.rest` | `SessionController` reçoit `@AuthenticationPrincipal Jwt jwt` et le traduit en `AuthenticatedUser` (un petit `JwtUsers` partagé avec le WebSocket : `sub`, `name` → `preferred_username` → `sub`). `CreateSessionRequest`/`JoinSessionRequest` sans `pseudo` ; `EntryRequests` simplifié. `CreationRateLimiter` : clé **par utilisateur** (`sub`) plutôt que par IP (plus juste derrière un proxy d'entreprise où tout le monde a la même IP). |
| `adapter.in.ws` | `SessionSocketHandler.handshake` : valide `hello.accessToken()` avec le `JwtDecoder` et le contrôle de rôle ; ferme en `4440` (invalide ou expiré) ou `4403` (rôle absent) avant d'appeler le cas d'usage. `ClientMessages.HelloMessage` : `accessToken`. |
| `config` | `SecurityConfig` (ci-dessus) ; `SessionConfig` inchangé hors signatures. |

### 6.4 Durée de vie du jeton et WebSocket

Le JWT est vérifié **au `hello`**, donc à chaque (re)connexion. Une connexion ouverte n'est **pas** fermée quand le jeton expire : c'est cohérent avec AD-8 (« l'inactivité ne déconnecte jamais ») et évite de couper un atelier toutes les 5 min. Conséquence acceptée : un retrait de droits dans Keycloak ne prend effet qu'à la prochaine reconnexion, ou au plus tard à l'expiration de la session (24 h). Si ce délai est jugé trop long, ajouter un message `reauth {accessToken}` envoyé par le client à chaque rafraîchissement, avec fermeture `4440` si le serveur ne reçoit plus de jeton valide (lot optionnel).

### 6.5 Confidentialité (NFR-6)

- Le nom Keycloak est une donnée personnelle, plus identifiante qu'un pseudo : même règle que le pseudo aujourd'hui, **jamais dans un journal** ; le `sub` et le JWT non plus.
- Les noms vivent en mémoire et disparaissent avec la session (24 h), comme aujourd'hui.
- Le `sub` ne sort jamais du webservice : l'instantané continue de désigner les participants par `participantId`.

---

## 7. Front (`frontend/`)

### 7.1 Bibliothèque

**`keycloak-js`** (adaptateur officiel, sans dépendance) enveloppé dans un `AuthService`. Le front n'utilise pas `HttpClient` mais `fetch` (`SessionApi`, `FETCH`) : les intercepteurs de `keycloak-angular` ou `angular-auth-oidc-client` n'apporteraient rien, il suffit d'obtenir un jeton frais avant chaque appel. Vérifier la compatibilité de version avec le serveur Keycloak de l'entreprise.

Réglages : `onLoad: 'login-required'`, `pkceMethod: 'S256'`, `checkLoginIframe: false` (pas d'iframe : cookies tiers bloqués par Safari, et la CSP n'aurait pas à ouvrir `frame-src`), jetons **en mémoire** uniquement (pas de `localStorage`).

### 7.2 Fichiers

| Fichier | Modification |
| --- | --- |
| `package.json` | + `keycloak-js` |
| `config/app-config.ts` | `AppConfig` : + `auth: { issuer, clientId }` ; validation (URL https de l'émetteur). |
| `scripts/write-config.mjs`, `scripts/api-base-url.mjs` | Lire `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` ; les écrire dans `config.json` ; **CSP** : ajouter l'origine Keycloak à `connect-src` (endpoint de jeton). La redirection de connexion est une navigation, non soumise à `connect-src`. |
| `main.ts` | Après `loadAppConfig()`, `await auth.init()` (redirige vers Keycloak si besoin) **avant** `bootstrapApplication`, puis fournir `AuthService`. L'URL de la session (`/s/:id`) est conservée par le paramètre `redirectUri` / `state` : un lien partagé mène bien à la session après connexion. Erreur Keycloak → écran d'erreur dédié. |
| `auth/auth.service.ts` (nouveau) | `init()`, `token(): Promise<string>` (`updateToken(30)` puis jeton), `displayName` (claim `name`), `logout()`. |
| `api/session-api.ts` | `send()` ajoute `Authorization: Bearer` ; nouveaux genres d'erreur `unauthenticated` (401 : rafraîchir puis relancer une fois, sinon reconnexion Keycloak) et `forbidden` (403 : écran « Accès refusé ») ; `invalidPseudo` et `pseudoTaken` supprimés. |
| `api/contract.ts` (+ specs de contrat) | Types alignés sur le nouveau contrat (requêtes sans `pseudo`, réponses sans `participantToken`, `hello {accessToken}`, codes `4403`/`4440`). |
| `session/session.service.ts` | `hello` avec un jeton **frais** à chaque tentative (`await auth.token()`), donc aussi à chaque reconnexion ; `4440` → rafraîchir et retenter (pas une fin de session) ; `4403` → fin `forbidden` ; `4401` → fin `notParticipant` (écran Rejoindre, **sans** le message « place reprise »). Plus de lecture ni d'effacement du jeton de session. |
| `session/session-entry.component.ts` | Plus de jeton rangé : après `checkSession`, on tente directement la connexion ; `4401` → formulaire Rejoindre. `TAKEN_OVER_MESSAGE`, `PSEUDO_TAKEN_MESSAGE`, `INVALID_PSEUDO_MESSAGE` supprimés. |
| `home/home.component.ts` | Plus de pseudo à préremplir ni à mémoriser. |
| `entry-form/entry-form.component.ts`, `entry-messages.ts`, `styles/entry-form.css` | Champ « Ton pseudo » **supprimé**, remplacé par une ligne « Connecté en tant que **Prénom Nom** » ; le bouton n'attend plus que le rôle (et le jeu à la création). |
| `storage/browser-storage.ts` | Suppression de `pp.pseudo` et `pp.token.{sessionId}` (nettoyer les anciennes clés au démarrage) ; `pp.theme` reste. |
| `top-bar/participant-menu.component.ts` | Affiche déjà `me.pseudo` venu de l'instantané : rien à changer pour le nom ; ajouter l'entrée « Se déconnecter ». Prévoir l'ellipse pour un nom de 64 caractères (CSS de la barre et de `participant-table`). |
| `session/participant-table.component.ts`, `styles/table.css` | Noms plus longs : ellipse + `title` ; homonymes possibles (deux « Julie Martin ») : ils restent distincts par `participantId`, à départager visuellement si besoin (question ouverte). |
| `wake/` | Inchangé : `/api/health` reste public. L'écran de réveil s'affiche après la connexion Keycloak. |

### 7.3 Nouveaux écrans

- **Accès refusé** (403 du webservice ou `4403`) : « Tu n'as pas accès au Planning Poker. Demande l'accès à … », avec « Se déconnecter ».
- **Keycloak injoignable** : réutiliser l'écran « Le serveur ne répond pas » de `main.ts`.

Mettre à jour `EXPERIENCE.md` (parcours d'entrée) et `DESIGN.md` (bloc « Connecté en tant que »).

---

## 8. Tests

| Niveau | Impact |
| --- | --- |
| Domaine (JUnit) | Réécrire `PseudoTest` (→ `DisplayNameTest`), `SessionTakeOverTest`, `SessionAbsenceTest`, `SessionTest`, `ParticipantTest`, `SessionSnapshotTest` : identité par `UserId`, plus de pseudo pris ; ajouter « le même utilisateur rejoint deux fois », « homonymes distincts », « nom mis à jour au retour ». |
| Application | `CreateSessionUseCaseTest`, `JoinSessionUseCaseTest`, `SessionConnectionUseCaseTest` : signatures `AuthenticatedUser`. |
| REST (MockMvc) | `spring-security-test` : `jwt().authorities(...)` ; cas 401 sans jeton, 401 jeton expiré, 403 sans rôle, 403 mauvaise audience ; CORS avec `Authorization`. |
| WebSocket | `JwtDecoder` de test (clé RSA générée dans le test) : `hello` valide, expiré (`4440`), sans rôle (`4403`), non participant (`4401`), JWT de 8 KB accepté. |
| Contrat | Nouveaux exemples validés des deux côtés (`ContractRoundTripTest`, `WsContractRoundTripTest`, `contract.spec.ts`, `ws-contract.spec.ts`). |
| Architecture | `ArchitectureTest` : le domaine ne dépend ni de Spring Security ni de Nimbus. |
| Front (Vitest) | `AuthService` simulé ; specs de `session-api`, `session.service`, `session-entry`, `home`, `entry-form`, `browser-storage`, `app-config`, scripts `api-base-url` (CSP). |
| E2E Playwright | Les parcours UJ-1 à UJ-3 et `e2e/*` saisissent un pseudo (≈ 90 occurrences) : il faut un **Keycloak de test** (conteneur `quay.io/keycloak/keycloak` avec un realm importé et des utilisateurs de test, dans la CI) et une connexion par utilisateur dans `journey-helpers.ts` (formulaire Keycloak, ou état de stockage préparé). Ajouter un parcours « utilisateur sans rôle ». |
| Charge (`deploy/load-test.mjs`) | Obtenir des jetons pour 13 utilisateurs de test (client de test confidentiel avec *client credentials* ou comptes de service). |

---

## 9. Déploiement et exploitation

- **Variables** — webservice : `KEYCLOAK_ISSUER_URI`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_REQUIRED_ROLE` ; front : `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` (→ `config.json`, ConfigMap sur OpenShift, AD-11). Mettre à jour `deploy/render.yaml`, `deploy/README.md`, le `README.md` et `.github/workflows/ci.yml` (Keycloak de test pour les e2e).
- **Réseau** : le webservice doit joindre Keycloak (découverte OIDC et JWKS, mis en cache par Nimbus) ; au démarrage, `issuer-uri` est résolu, donc Keycloak doit répondre avant le webservice (ou utiliser `jwk-set-uri` pour un démarrage paresseux).
- **Render** : un Keycloak d'entreprise n'est en général pas joignable depuis Render. Cette évolution vise de fait l'hébergement **OpenShift** (Deferred de l'architecture). Si la démo Render doit survivre, il faut un interrupteur `planning-poker.auth.enabled` (voir § 11) ou un Keycloak public.
- **Bascule** : rupture de contrat → déployer webservice **et** front ensemble, hors atelier (AD-13) ; les sessions en mémoire sont perdues au redémarrage, comme à tout déploiement.

---

## 10. Documents de cadrage à mettre à jour

- `README.md` : « sans compte » ne tient plus.
- PRD : FR-2 (rejoindre), FR-8 (reprise), NFR-6 (données personnelles), et une nouvelle exigence « accès réservé aux utilisateurs autorisés ».
- `ARCHITECTURE-SPINE.md` : nouvel **AD-14 « Identité déléguée à Keycloak »** qui remplace AD-7 ; amender AD-2 (surface : 401/403, codes WS), AD-11 (CSP et `config.json` avec Keycloak), AD-13 (exception de rupture de contrat) ; Stack (Spring Security, `keycloak-js`).
- UX : `EXPERIENCE.md` (entrée sans pseudo, écran Accès refusé, déconnexion), `DESIGN.md`.
- Epics / stories : un nouvel epic (découpage proposé ci-dessous).

---

## 11. Questions ouvertes

1. **Quel rôle (ou groupe) donne accès**, et qui l'attribue ? Un rôle client dédié est recommandé.
2. **Création réservée ?** Tout utilisateur autorisé peut-il créer une session, ou seulement un rôle « animateur » ?
3. **Quel nom afficher** : `name` (« Prénom Nom »), `given_name` seul, `preferred_username` ? Que faire des homonymes (ajouter l'initiale du nom, l'identifiant) ?
4. **Le pseudo reste-t-il possible** en surcharge du nom (surnom d'équipe) ? Le besoin dit « à la place » : l'analyse le supprime.
5. **Retrait de droits** : la prise d'effet à la prochaine reconnexion suffit-elle, ou faut-il `reauth` (§ 6.4) ?
6. **Mode anonyme** : faut-il garder un fonctionnement sans Keycloak (démo Render, développement local) derrière un interrupteur ? Cela double une partie des chemins de code et des tests ; à éviter si la démo publique n'est plus nécessaire. Pour le développement local, un Keycloak en conteneur (`docker compose`) suffit.
7. **Version de Keycloak** de l'entreprise (compatibilité `keycloak-js`) et URL des realms de dev / recette / prod.

---

## 12. Découpage et estimation indicative

| Lot | Contenu | Charge |
| --- | --- | --- |
| 0 | Realm de dev en conteneur (export JSON versionné), client, rôle, mappers, utilisateurs de test | 0,5 j |
| 1 | Contrat : schémas, OpenAPI/AsyncAPI, exemples, validation | 1 j |
| 2 | Webservice : `SecurityConfig`, JWT au `hello`, domaine `UserId`/`DisplayName`, cas d'usage, limiteur par utilisateur, tests | 4 à 5 j |
| 3 | Front : `AuthService`, `config.json`/CSP, appels REST et WS, formulaire sans pseudo, écrans Accès refusé et déconnexion, tests | 3 à 4 j |
| 4 | E2E et CI avec Keycloak de test, test de charge | 2 à 3 j |
| 5 | Documents (AD-14, PRD, UX, README, déploiement) | 1 j |
| **Total** | | **≈ 12 à 15 j** |

Ordre conseillé : 0 → 1 → 2 et 3 en parallèle (contrat d'abord, AD-6) → 4 → 5, puis une seule mise en production coordonnée.
