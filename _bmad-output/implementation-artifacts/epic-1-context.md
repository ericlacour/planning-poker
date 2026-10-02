# Epic 1 Context: Un premier atelier de bout en bout

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

L'équipe mène un vrai atelier d'affinage avec l'outil déployé sur Render : créer une session sans compte et en partager le lien, la rejoindre comme votant ou observateur, voter à l'aveugle en voyant qui a voté, révéler avec la synthèse (moyenne, plus votée, min, max, consensus), effacer pour passer au ticket suivant, et retrouver sa place après un rafraîchissement. Le tout sur PC (13 personnes sans défilement) et sur téléphone, avec l'écran de réveil du serveur et l'écran « Session introuvable ». L'epic pose aussi les fondations : contrat d'échange, monodépôt, CI et déploiement.

## Stories

- Story 1.1 : Le contrat d'échange front / webservice
- Story 1.2 : Ouvrir l'outil, même quand le serveur dort
- Story 1.3 : Créer une session et en partager le lien
- Story 1.4 : Rejoindre une session par son lien
- Story 1.5 : Voir la table en direct
- Story 1.6 : Voter à l'aveugle
- Story 1.7 : Révéler, lire le résultat, passer au ticket suivant
- Story 1.8 : Un écran de séance qui tient sur PC et sur téléphone

## Requirements & Constraints

- Sans compte : pseudo + rôle (`VOTER` ou `OBSERVER`). Pseudo normalisé NFC, espaces aux extrémités retirés, 1 à 20 points de code ; unicité insensible à la casse (`Locale.ROOT`) parmi les participants de la session.
- Cartes : `"0","1","2","3","5","8","13","21","?","coffee"` ; seul le front affiche `☕`. Un vote se change ou se retire (`card: null`) tant que le tour est caché ; verrouillé une fois révélé.
- Tout participant peut révéler ou effacer à tout moment, sans confirmation. Effacer démarre un nouveau tour caché (nouveau `roundId`), sans historique.
- Synthèse calculée par le domaine uniquement : moyenne au dixième (`HALF_UP`), plus votée avec toutes les valeurs à égalité et leur nombre, min, max, consensus (tous les votes numériques identiques, au moins deux). `?` et `coffee` exclus ; sans vote numérique, pas de chiffre.
- Tout changement visible chez tous en moins d'une seconde ; actions quasi simultanées : la dernière reçue s'applique, état final identique pour tous.
- Capacité : 13 participants par session, 5 sessions, 65 connexions (test de charge sur Render dans la story 1.5).
- Sécurité : lien impossible à deviner, HTTPS/WSS, aucune donnée personnelle hors pseudo, aucun traceur ni ressource tierce. Interface entièrement en français, tutoiement, libellés fixes mot pour mot.
- Coût récurrent nul ; PC et téléphone, deux dernières versions de Chrome, Edge, Firefox, Safari ; 360 px minimum, zones tactiles ≥ 44 px.

## Technical Decisions

- **Monodépôt** : `contract/` (OpenAPI 3.2.0 + AsyncAPI 3.1.0, charges utiles en JSON Schema, exemples, script de validation), `backend/` (Maven 3.9.16, Spring Boot 4.1.1, Java 25, paquet `com.planningpoker`), `frontend/` (Angular 22, Node ≥ 24.15), `deploy/render.yaml`, `.github/workflows/`.
- **Contrat d'abord** : source de vérité unique ; aucun champ ne circule s'il n'y est pas décrit ; types Java et TypeScript écrits à la main ; des tests valident les exemples contre les schémas des deux côtés ; le contrat n'évolue que par ajout.
- **Surface fermée** : `GET /api/health` (200), `POST /api/sessions` `{pseudo, role}` → `{sessionId, participantId, participantToken}`, `GET /api/sessions/{sessionId}` (204/404), `POST /api/sessions/{sessionId}/participants` `{pseudo, role}` → `{participantId, participantToken}`, et WebSocket brut `/ws/sessions/{sessionId}` (pas de STOMP ni SockJS).
- **Messages WS** : enveloppe `{ "type": "<camelCase>", ... }`. Client → serveur : `hello {participantToken}`, `heartbeat`, `vote {roundId, card|null}`, `reveal {roundId}`, `hide {roundId}`, `clear {roundId}`, `changeRole {role}`. Serveur → client : `sessionState`, `tick`, `error {code}`.
- **Erreurs** : REST en `application/problem+json` (RFC 9457) avec `code` ∈ `PSEUDO_TAKEN` (409), `INVALID_PSEUDO`, `SESSION_NOT_FOUND`. WS : `ROUND_REVEALED`, `NOT_A_VOTER`, `INVALID_CARD`, `INVALID_MESSAGE`. Fermetures : `4404` (session inexistante, vérifiée d'abord), `4401` (jeton inconnu/révoqué ou pseudo repris). Le texte affiché vient du front.
- **Instantané `sessionState`** normatif, filtré par destinataire : `sessionId`, `version`, `selfParticipantId`, `round {roundId, status: HIDDEN|REVEALED}`, `participants[] {participantId, pseudo, role, connected, joinOrder, hasVoted, vote: card|null, canVoteThisRound}` triés (votants puis observateurs, par `joinOrder`), `progress {voted, expected}`, `summary: null | {average: number|null, mostVoted: {values, count}|null, min, max, consensus}`, `lastChange {action: JOIN|LEAVE|VOTE|REVEAL|HIDE|CLEAR|ROLE|PRESENCE, byParticipantId: string|null}`. Tour caché : `vote` rempli seulement pour soi.
- **Intentions** idempotentes liées au `roundId` (opaque, change seulement au `clear`) ; `roundId` périmé ignoré silencieusement ; intention déjà satisfaite sans effet ni incrément de `version`.
- **Identité** : `sessionId` 128 bits base64url ; `participantId` UUID public ; `participantToken` secret 128 bits (`SecureRandom`), jamais dans une URL, un instantané ou un journal ; stocké sous `pp.token.{sessionId}`. `hello` attendu dans les 5 s.
- **Webservice hexagonal** : `domain` (Java pur, ArchUnit), `application` (cas d'usage, ports `SessionStore`/`SessionBroadcaster`, `Clock` UTC), `adapter.in.rest`, `adapter.in.ws`, `adapter.out.memory`, `config`. Mutation unique par session sous verrou : charger → règle → `version++` si changement observable → `save` → `publish` non bloquant (file bornée par connexion, 2 s / 64 Ko). Jackson 3 (`tools.jackson`), jamais `jackson2`.
- **Présence** (pour 1.5) : `tick` serveur et `heartbeat` client toutes les 5 s.
- **Front** : un seul `SessionService` gère le WebSocket et expose l'état en `Signal` lecture seule ; aucun calcul métier ; `LOCALE_ID` `fr` ; jetons DESIGN en propriétés CSS (le thème sombre redéfinit les mêmes). `/config.json` `{apiBaseUrl}` généré au build depuis `API_BASE_URL` ; CSP `default-src 'self'`.
- **Exploitation** : image `eclipse-temurin:25-jre` épinglée, non root, groupe 0, `PORT` 8080, `ALLOWED_ORIGINS` pour CORS et WS ; déploiement Render sur étiquette `v*`, webservice avant le front. CI GitHub Actions : backend, frontend et contrat.
- **Tests** : domaine JUnit 5 avec `Clock` fixe ; ArchUnit ; validation du contrat ; Vitest ; Playwright Chromium + WebKit.
- **Journaux** JSON, sans jeton, sans pseudo, sans vote caché (désigner par `participantId`).

## UX & Interaction Patterns

- Formulaire d'entrée commun (accueil / rejoindre) : « Ton pseudo » prérempli via `pp.pseudo`, rôle « Je vote » / « J'observe » (votant présélectionné), bouton pleine largeur désactivé si pseudo vide, « Connexion… » pendant l'envoi ; erreurs « Ce pseudo est déjà pris dans cette session. », « Impossible de joindre le serveur. ».
- Écrans d'état : « Réveil du serveur… Ça peut prendre jusqu'à 2 minutes. » (0–3 min), « Le serveur ne répond pas. » + « Réessayer », « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. » + « Créer une session ».
- Table : votants puis observateurs, ma place en tête de son groupe avec « (toi) » ; carte vide en pointillés, dos à croisillons, ou face ; « visible par toi seul », « n'a pas voté », « observe ». Seul dans la session : « Partage le lien pour inviter ton équipe ».
- Main « Ta carte » en boutons bascule (`aria-pressed`), re-clic retire le vote ; barre d'action « N votes sur M » / « Aucun votant », « Révéler les votes » ou « Nouveau tour », « Effacer les votes » / « Masquer » ; boutons inactifs 1 s après un REVEAL/HIDE/CLEAR fait par un autre.
- Résultat : moyenne au format français (« 5,9 »), « 5 et 8 · 3 votes chacune », min, max, « Consensus ! », ou « Pas de résultat chiffré ».
- PC 1280 × 650 sans défilement avec 13 participants (7 places par rangée) ; téléphone < 600 px avec tiroir de 2 × 5 cartes qui se replie à la révélation.

## Cross-Story Dependencies

- 1.1 (contrat) précède toute story de code ; toute modification ultérieure d'un message se fait dans le même changement que le code des deux côtés.
- 1.2 amorce `backend/`, `frontend/`, CI et déploiement ; elle doit brancher la validation du contrat dans la CI et des tests de validation des exemples des deux côtés.
- 1.3 → 1.4 → 1.5 (premier WebSocket, test de charge) → 1.6 → 1.7 → 1.8.
- Epic 2 (présence, reconnexion, reprise, expiration) et Epic 3 (`hide`, `changeRole`, thème) s'appuient sur les messages déjà définis par le contrat de 1.1.
