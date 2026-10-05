---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/prd.md
  - _bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-planning-poker-2026-09-29/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md
---

# planning-poker : découpage en epics

## Vue d'ensemble

Ce document découpe en epics et en stories implémentables les exigences du PRD, du contrat UX (DESIGN.md et EXPERIENCE.md) et de la spine d'architecture du Planning Poker pour ateliers d'affinage.

## Inventaire des exigences

### Exigences fonctionnelles

- **FR1 :** Toute personne crée une session depuis l'accueil, sans compte, en donnant seulement un pseudo et un rôle (votant ou observateur). Elle entre directement dans la session, sans droit particulier, et le lien de session se copie en un clic.
- **FR2 :** Toute personne qui a le lien rejoint la session en un seul écran, avec le rôle « votant » présélectionné.
  - Le pseudo est obligatoire, fait 20 caractères au plus, et les espaces en début et en fin sont ignorés.
  - L'unicité ne tient pas compte des majuscules.
  - Un pseudo déjà pris par un participant connecté est refusé, avec un message explicite.
  - Une personne qui arrive pendant un tour caché peut voter sur ce tour.
- **FR3 :** Un lien inconnu ou expiré affiche un message clair qui propose de créer une nouvelle session.
- **FR4 :** Une session expire 24 h après sa création. Elle n'est alors plus accessible, et ses données sont supprimées.
- **FR5 :** Un participant peut passer de votant à observateur, et inversement.
  - Un votant qui devient observateur pendant un tour caché perd son vote.
  - Pendant un tour révélé, son vote reste affiché. Il est retiré au masquage (FR13) ou à l'effacement.
  - Un observateur qui devient votant pendant un tour révélé vote dès que le tour redevient caché, après un masquage ou un effacement.
- **FR6 :** Chaque participant voit la liste des participants, avec pour chacun : pseudo, rôle, présence, et « a voté ou non » pendant un tour caché, sans jamais voir la carte des autres.
- **FR7 :** Reconnexion automatique dans le même navigateur, après une coupure ou un rafraîchissement.
  - Le participant garde son pseudo, son rôle et son vote.
  - Les autres le voient déconnecté pendant la coupure.
  - La page affiche l'état « Reconnexion… ».
  - Plusieurs onglets du même navigateur forment un seul participant.
  - Si la session n'existe plus, la page affiche le message de FR3.
  - Un participant retiré pour absence est remis à sa place automatiquement à son retour, si son pseudo est encore libre.
  - L'inactivité et un onglet en arrière-plan ne déconnectent jamais. Si le système suspend la page (téléphone verrouillé), le participant peut apparaître déconnecté, mais son retour est transparent, même après un retrait.
  - Si le pseudo a été repris entre-temps, la page affiche l'écran Rejoindre avec le pseudo prérempli.
- **FR8 :** On peut reprendre le pseudo d'un participant déconnecté depuis un autre appareil, avec son rôle et son vote. Le pseudo d'un participant connecté est refusé, et l'appareil d'origine perd ce participant. Reprendre le pseudo d'un autre est un risque accepté.
- **FR9 :** Un participant déconnecté depuis plus de 5 min est retiré de la liste, et son vote du tour en cours est supprimé. Son pseudo redevient libre. S'il revient et que son pseudo est libre, il est remis à sa place automatiquement.
- **FR10 :** Un votant choisit une carte parmi `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕` pendant un tour caché. Un observateur devenu votant pendant un tour révélé vote dès que le tour redevient caché (FR5).
  - Il peut la changer ou la retirer à volonté.
  - Sa carte n'est visible que par lui jusqu'à la révélation.
  - Un observateur n'a pas de cartes.
- **FR11 :** Une fois le tour révélé, aucun vote n'est modifiable. Pour revoter, il faut effacer.
- **FR12 :** Tout participant peut révéler le tour à tout moment, même si des votants n'ont pas voté. Les votes deviennent visibles nominativement, et un votant sans vote apparaît comme « n'a pas voté ».
- **FR13 :** Tout participant peut masquer un tour révélé. Le tour redevient caché, et tous les votants peuvent de nouveau choisir ou modifier leur carte, y compris ceux arrivés ou devenus votants pendant la révélation (FR2, FR5). Le vote d'un participant devenu observateur pendant la révélation est retiré au masquage.
- **FR14 :** Une fois le tour révélé, l'outil affiche :
  - la moyenne, arrondie au dixième et au format français ;
  - le consensus, si tous les votes numériques sont identiques et qu'il y en a au moins deux ;
  - la valeur la plus votée et son nombre de votes, avec toutes les valeurs en cas d'égalité ;
  - la valeur minimale et la valeur maximale.

  Les cartes `?` et `☕` sont exclues de ces calculs. Sans vote numérique, aucun chiffre ne s'affiche.
- **FR15 :** Tout participant peut effacer le tour, qu'il soit caché ou révélé. Tous les votes sont supprimés, un nouveau tour caché démarre, et aucun historique n'est conservé. Il n'y a ni confirmation ni garde-fou.
- **FR16 :** Tout changement (arrivée, départ, rôle, vote, révéler, masquer, effacer) apparaît chez tous sans recharger la page. Les délais se mesurent de bout en bout :
  - cas général : moins d'une seconde ;
  - déconnexion explicite : 6 s au plus, car Render met environ 5 s à signaler la fermeture d'une connexion (décision d'équipe du 2026-10-03, test de charge dans `deploy/README.md`) ;
  - déconnexion brutale : détectée en 15 s au plus, puis diffusée en moins d'une seconde.
- **FR17 :** En cas d'actions quasi simultanées, la dernière reçue s'applique, et tous les participants aboutissent au même état final.

### Exigences non fonctionnelles

- **NFR1 :** Tant que le serveur fonctionne, une session ne perd jamais son état, quelles que soient les coupures côté participant. La perte d'une session lors d'un plantage ou d'un redémarrage du serveur est un risque accepté.
- **NFR1b :** L'application ne doit jamais être mise en veille tant qu'une session a des participants connectés.
- **NFR2 :** Au démarrage à froid, le chargement peut prendre jusqu'à 2 min, pendant lesquelles la page affiche « Réveil du serveur… », sans erreur technique. Au-delà de 3 min, elle affiche un message d'indisponibilité avec un bouton pour réessayer.
- **NFR3 :** Tout changement est propagé dans le délai fixé par FR16.
- **NFR4 :** Au moins 13 participants par session et 5 sessions simultanées, soit au moins 65 connexions temps réel, plus une marge.
- **NFR5 :** L'interface fonctionne sur PC et sur téléphone, avec les deux dernières versions majeures de Chrome, Edge, Firefox et Safari (iOS et Android compris). Elle reste utilisable dès 360 px de large, avec des zones tactiles d'au moins 44 × 44 px.
- **NFR6 :** Sécurité et confidentialité :
  - lien impossible à deviner ;
  - HTTPS partout ;
  - aucune donnée personnelle hors du pseudo ;
  - ni publicité ni traceur ;
  - données supprimées à l'expiration.

  L'accès par lien, sans contrôle d'accès ni expulsion, est un risque accepté.
- **NFR7 :** L'interface est entièrement en français.
- **NFR8 :** Ni installation ni compte, et aucun élément sans rapport avec le vote.
- **NFR9 :** Changer d'hébergement ou de stockage ne touche que la configuration et la partie stockage, jamais la logique du vote. Jira et l'adaptation du déroulé doivent pouvoir s'ajouter plus tard.
- **NFR10 :** Aucun coût récurrent en V1, et des choix techniques simples et courants.

### Exigences supplémentaires (architecture)

**Pas de starter imposé.** Le projet est un monodépôt créé de zéro : `contract/`, `backend/` (Maven, Spring Boot 4.1.1, Java 25) et `frontend/` (Angular 22, Node ≥ 24.15). L'epic 1 commence donc par l'**amorçage du dépôt** et par **le contrat**.

- **AR1 (AD-6) :** **la première story livre le contrat complet** avant toute story de code :
  - `contract/openapi.yaml` (OpenAPI 3.2) et `contract/asyncapi.yaml` (AsyncAPI 3.1) ;
  - les charges utiles en JSON Schema, avec un exemple de chaque message ;
  - des tests de validation des exemples, des deux côtés.
- **AR2 (AD-1) :** webservice hexagonal : `domain` en Java pur, puis `application`, `adapter.in.rest`, `adapter.in.ws`, `adapter.out.memory` et `config`. Un test ArchUnit (1.5.1) fait échouer le build si une dépendance interdite apparaît.
- **AR3 (AD-2) :** surface réseau fermée : `GET /api/health`, `POST /api/sessions`, `GET /api/sessions/{id}` (204 ou 404), `POST /api/sessions/{id}/participants`, et le WebSocket brut `/ws/sessions/{id}` (sans STOMP).
- **AR4 (AD-3) :** toute modification d'une session passe par un point unique, sous le verrou de cette session : charger, appliquer la règle, incrémenter `version` si l'état observable change, `save`, puis `publish`. `publish` n'est jamais bloquant : chaque connexion a sa file d'envoi bornée (`ConcurrentWebSocketSessionDecorator`, 2 s et 64 Ko).
- **AR5 (AD-4) :** les actions sont des intentions nommées et idempotentes : `vote {roundId, card|null}`, `reveal`, `hide`, `clear {roundId}` et `changeRole`.
  - Une intention qui porte un `roundId` périmé est ignorée.
  - Une intention interdite renvoie `error` avec l'un des codes `ROUND_REVEALED`, `NOT_A_VOTER` ou `INVALID_CARD`.
- **AR6 (AD-5) :** le serveur envoie un instantané `sessionState` complet, filtré pour chaque destinataire, dont le squelette est normatif : `selfParticipantId`, `round`, `participants` triés, `progress`, `summary` et `lastChange`. Il l'envoie à chaque changement de `version` et à chaque nouvelle connexion. La moyenne est arrondie avec `HALF_UP`.
- **AR7 (AD-7) :** trois identifiants : `sessionId` (128 bits), `participantId` (UUID public) et `participantToken` (secret de 128 bits, jamais dans une URL ni dans un journal).
  - Poignée de main : un premier message `hello` dans les 5 s. La session est vérifiée d'abord (fermeture `4404`), puis le jeton (fermeture `4401`).
  - Retour transparent d'un participant retiré.
  - Une reprise FR8 émet un nouveau jeton et révoque l'ancien.
  - Le jeton est stocké dans `localStorage` sous la clé `pp.token.{sessionId}`.
- **AR8 (AD-8) :** la présence ne dépend que du réseau.
  - Le serveur envoie un ping de protocole toutes les 5 s, et une connexion est morte au bout de 15 s sans réponse.
  - Le serveur envoie aussi un `tick` applicatif toutes les 5 s, et le client déclare la perte de connexion après 12 s sans message.
  - Le client envoie un `heartbeat` toutes les 5 s pour que Render reste éveillé.
  - Un balayeur tourne chaque seconde (retrait après 5 min, expiration à 24 h).
  - Le client se reconnecte avec des délais croissants (1, 2, 4, 8 s, puis 10 s), et aussi sur les événements `online` et `visibilitychange`.
  - Toutes les heures passent par `java.time.Clock` en UTC.
- **AR9 (AD-9) :** le port `SessionStore` offre `find`, `save`, `delete` et `all`, et toute écriture suit la séquence charger → modifier → save. En V1, le stockage est en mémoire, sur une seule instance.
- **AR10 (AD-10) :** côté Angular, un seul `SessionService` gère le WebSocket et expose l'état sous forme de `Signal` en lecture seule. Aucun calcul métier côté front. `LOCALE_ID` vaut `fr`. Les jetons DESIGN deviennent des propriétés CSS, et les jetons `-dark` redéfinissent ces mêmes propriétés.
- **AR11 (AD-11) :** `/config.json` (`apiBaseUrl`) est généré au build Render à partir de `API_BASE_URL`. `ALLOWED_ORIGINS` s'applique au CORS et au WebSocket. CSP `default-src 'self'`, HTTPS et WSS uniquement.
- **AR12 (AD-12) :** l'image Docker part de `eclipse-temurin:25-jre` avec une étiquette épinglée. Elle tourne en utilisateur non root, avec le groupe 0 et `chmod g=u`. Port `${PORT:8080}` (`PORT=8080` sur Render). Configuration par variables d'environnement, et `/api/health` comme sonde.
- **AR13 (AD-13) :** déploiement sur Render Free, décrit par un blueprint `deploy/render.yaml` (un web service Docker et un site statique).
  - Pas de déploiement automatique sur push : on déploie sur une étiquette `v*`, le webservice avant le front.
  - Le contrat n'évolue que par ajout.
  - Un seul web service.
- **AR14 :** conventions :
  - code, JSON et API en anglais ;
  - Jackson 3 (`tools.jackson`), sans `jackson2` ;
  - erreurs REST au format `problem+json` avec un `code` ;
  - normalisation du pseudo (NFC, suppression des espaces aux extrémités, 1 à 20 points de code, comparaison en `Locale.ROOT`) ;
  - journaux JSON, sans jeton, sans vote caché ni pseudo.
- **AR15 :** CI V1 sur GitHub Actions : build et tests du backend, du frontend et du contrat. Environnement de développement local documenté (`mvn spring-boot:run` avec `ng serve`).
- **AR16 :** tests :
  - domaine en JUnit 5 avec une `Clock` fixe ;
  - ArchUnit ;
  - validation du contrat ;
  - Vitest ;
  - Playwright sur Chromium et WebKit pour UJ-1 à UJ-3, dont un onglet en arrière-plan pendant 20 min ;
  - **test de charge** (13 participants, 65 connexions, sur Render) dans la première story qui ouvre le WebSocket.

### Exigences de conception UX

- **UX-DR1 :** mettre en place les jetons de DESIGN.md sous forme de propriétés CSS globales, en thème clair et en thème sombre.
  - Couleurs : `primary #CF3F4A`, `card-back`, `card-face`, `card-ink`, `card-frame`, `success`, `warning`, `danger`, `presence-*`, et leurs versions `-dark`.
  - Typographie en police système : `display`, `title`, `body`, `label`, `card-value`, `card-corner`, `result-value`, `result-stat`.
  - Arrondis : `rounded`.
  - Espacements : `spacing`, dont `touch-min` 44 px, `panel-narrow` 400 px, `seat-card-width-pc` 44 px, `hand-card-width-pc` 60 px et `session-min-height-pc` 650 px.
- **UX-DR2 :** thème automatique, qui suit le système, avec un choix forcé clair ou sombre dans le menu du participant, mémorisé sous la clé `pp.theme`.
- **UX-DR3 :** composant **carte à jouer** (`poker-card`).
  - Face blanche, liseré intérieur `card-frame`, grande valeur centrale, et index dans les coins supérieur gauche et inférieur droit (celui-ci retourné à 180°).
  - Proportion 2:3, largeur minimale de 44 px.
  - Les cartes `?` et `☕` ont la même anatomie, et `☕` est rendu en texte.
  - Carte choisie (`poker-card-selected`) : contour rouge épais de 3 px (`card-ink-dark` en thème sombre) et soulèvement de 12 px en 150 ms.
- **UX-DR4 :** **dos de carte** (`seat-card-back`) : marge blanche et croisillons `card-back-pattern` sur `card-back`. Ce dos sert aussi de logo et d'animation de réveil.
- **UX-DR5 :** **place d'un participant** :
  - trois aspects de carte : vide en pointillés (`muted-foreground`), dos, face ;
  - pastille de présence ;
  - mentions « (toi) », « observe », « n'a pas voté », « déconnecté », « visible par toi seul » et « votera au prochain tour » ;
  - un participant déconnecté s'affiche en gris lisible, sans changement d'opacité.
- **UX-DR6 :** **table des participants** : les votants d'abord, puis les observateurs (toujours à la fin), chaque groupe dans l'ordre d'arrivée, avec ma place en tête de son groupe. Grille de 7 places au plus sur PC, 5 places entre 600 et 899 px, 3 places sur téléphone.
- **UX-DR7 :** **main de cartes** : barre d'outils nommée « Ta carte », faite de boutons bascule (`aria-pressed`).
  - Un nouvel appui sur la carte choisie retire le vote.
  - On navigue avec les flèches, et on choisit avec Entrée ou Espace.
  - L'indication « Choisis ta carte » s'affiche tant qu'aucune carte n'est choisie.
  - La main est grisée quand le tour est révélé.
  - Un observateur voit à la place « Tu observes » et le lien « Je veux voter ».
- **UX-DR8 :** **barre d'action** : compteur « N votes sur M », ou « Aucun votant ».
  - Un seul bouton principal selon l'état : « Révéler les votes » ou « Nouveau tour ».
  - Un bouton secondaire : « Effacer les votes » ou « Masquer ».
  - Les boutons sont désactivés pendant 1 s après un REVEAL, un HIDE ou un CLEAR fait par un autre participant.
  - Aucune confirmation n'est demandée.
  - Pas de raccourci clavier pour ces actions.
- **UX-DR9 :** **panneau de résultat** :
  - sur PC, il est intégré à la barre d'action, sur une rangée : Moyenne (28 px), Plus votée « 5 · 4 votes » avec égalités, Min, Max, et le badge « Consensus ! » ;
  - sur téléphone, il tient sur une ligne condensée, qui passe sur deux lignes si elle déborde ;
  - sans vote numérique, il affiche « Pas de résultat chiffré ».
- **UX-DR10 :** **révélation animée** : les cartes se retournent l'une après l'autre, en 400 ms au total. L'animation est supprimée avec `prefers-reduced-motion`. Pas de son, pas de confettis, pas de fenêtre modale.
- **UX-DR11 :** **barre du haut** (56 px) : logo en dos de carte, nom de l'outil, bouton « Copier le lien » (« Lien copié » pendant 2 s ; partage natif sur téléphone), et menu du participant (pseudo, « Je vote » / « J'observe », thème).
- **UX-DR12 :** **formulaire d'entrée**, pour l'accueil comme pour rejoindre :
  - panneau de 400 px ;
  - champ « Ton pseudo », avec le dernier pseudo prérempli (`pp.pseudo`) ;
  - rôle choisi par deux boutons segmentés, groupés sous « Ton rôle » ;
  - bouton sur toute la largeur, désactivé si le pseudo est vide ;
  - « Connexion… » pendant l'envoi ;
  - erreurs affichées sous le champ avec une icône : « Ce pseudo est déjà pris dans cette session. », « Impossible de joindre le serveur. ».
- **UX-DR13 :** **écrans d'état** (`state-screen`) :
  - « Réveil du serveur… Ça peut prendre jusqu'à 2 minutes. », avec l'animation de cartes, pendant 0 à 3 min ;
  - « Le serveur ne répond pas. » avec « Réessayer » ;
  - « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. » avec « Créer une session ».
- **UX-DR14 :** **états de la session** :
  - chargement : places vides en attente, sans sablier plein écran ;
  - session vide : « Partage le lien pour inviter ton équipe », avec « Copier le lien » comme bouton principal et la barre d'action masquée ;
  - bandeau ambre « Reconnexion… » après 2 s de coupure, avec les actions désactivées ;
  - retour transparent après une longue absence ;
  - écran Rejoindre avec « Ta place a été reprise depuis un autre appareil. » quand le pseudo a été repris.
- **UX-DR15 :** **mise en page PC sans défilement** avec 13 participants, tour révélé compris, dans une fenêtre utile de 1280 × 650. Si la fenêtre est trop basse, seule la table défile.
- **UX-DR16 :** **mise en page téléphone** (< 600 px) :
  - barre du haut compacte ;
  - main en tiroir fixe de 2 × 5 cartes ;
  - barre d'action au-dessus du tiroir, le compteur sur une ligne et les boutons en dessous ;
  - le tiroir se replie quand le tour est révélé, et le résultat condensé prend sa place.
- **UX-DR17 :** **accessibilité** (WCAG 2.2 AA) :
  - une région `aria-live` polie pour la révélation (moyenne, plus votée, min, max), le nouveau tour et les arrivées ;
  - le compteur annoncé au plus toutes les 5 s ;
  - focus visible en `primary`, focus conservé après une révélation ;
  - l'information n'est jamais transmise par la couleur seule ;
  - zoom à 200 % sans défilement horizontal dès 360 px.
- **UX-DR18 :** **libellés fixes et ton** : tutoiement, et libellés exactement conformes à EXPERIENCE › Voice and Tone (boutons, champs, messages).

### Carte de couverture des FR

- FR1 : Epic 1, créer une session
- FR2 : Epic 1, rejoindre une session (pseudo, rôle, unicité)
- FR3 : Epic 1, lien invalide ou expiré
- FR4 : Epic 2, expiration au bout de 24 h
- FR5 : Epic 3, changer de rôle en séance
- FR6 : Epic 1, liste des participants et « a voté » (la présence en direct est en Epic 2)
- FR7 : Epic 1 pour le retour après un rafraîchissement ; Epic 2 pour la reconnexion automatique, les onglets multiples et le retour transparent
- FR8 : Epic 2, reprise du pseudo depuis un autre appareil
- FR9 : Epic 2, retrait des absents au bout de 5 min
- FR10 : Epic 1, choisir ou retirer sa carte
- FR11 : Epic 1, vote verrouillé après révélation
- FR12 : Epic 1, révéler
- FR13 : Epic 3, masquer
- FR14 : Epic 1, synthèse (moyenne, plus votée, min, max, consensus)
- FR15 : Epic 1, effacer ou nouveau tour
- FR16 : Epic 1 pour la diffusion des changements ; Epic 2 pour les déconnexions explicites et brutales
- FR17 : Epic 1, actions simultanées (intentions idempotentes, verrou de session)

## Liste des epics

### Epic 1 : Un premier atelier de bout en bout
L'équipe mène un vrai affinage avec l'outil déployé sur Render :
- créer une session et partager le lien ;
- rejoindre la session comme votant ou comme observateur ;
- voter à l'aveugle et voir qui a voté ;
- révéler les votes, avec la moyenne, la plus votée, le min, le max et le consensus ;
- effacer pour passer au ticket suivant ;
- retrouver sa place après un rafraîchissement.

Le tout sur PC (sans défilement avec 13 personnes) et sur téléphone, avec l'écran de réveil et l'écran « Session introuvable ». La story 1.1 livre le contrat, et la première story WebSocket porte le test de charge sur Render.

**FRs covered:** FR1, FR2, FR3, FR6, FR7 (retour après rafraîchissement), FR10, FR11, FR12, FR14, FR15, FR16 (diffusion), FR17

### Epic 2 : Personne ne perd sa place
Une coupure n'a plus de conséquence :
- reconnexion automatique avec le bandeau « Reconnexion… » ;
- présence en direct ;
- l'inactivité ou un onglet en arrière-plan ne déconnectent jamais ;
- retrait au bout de 5 min, puis retour transparent ;
- reprise du pseudo depuis un autre appareil ;
- plusieurs onglets comptent comme un seul participant ;
- la session expire au bout de 24 h ;
- des plafonds protègent le service public contre l'épuisement de ses ressources.

Toute coupure de connexion, y compris un redémarrage du serveur, est visible et ne laisse partir aucun clic dans le vide (rétrospective de l'epic 1, constat F1).

**FRs covered:** FR4, FR7 (robustesse complète), FR8, FR9, FR16 (déconnexions), NFR4 (plafonds au-delà des minimums, rétrospective de l'epic 1, constat F2)

### Epic 3 : Des séances souples et soignées
L'outil est complet et agréable :
- changer de rôle en séance ;
- masquer un tour révélé pour revoter ;
- thème sombre ;
- révélation animée ;
- accessibilité vérifiée (WCAG 2.2 AA) ;
- tests Playwright de bout en bout des trois parcours, y compris un onglet laissé 20 min en arrière-plan.

**FRs covered:** FR5, FR13

## Epic 1 : Un premier atelier de bout en bout

L'équipe mène un vrai affinage avec l'outil déployé sur Render :
- créer une session et partager le lien ;
- rejoindre la session comme votant ou comme observateur ;
- voter à l'aveugle et voir qui a voté ;
- révéler les votes, avec la moyenne, la plus votée, le min, le max et le consensus ;
- effacer pour passer au ticket suivant ;
- retrouver sa place après un rafraîchissement.

Le tout sur PC et sur téléphone.

### Story 1.1 : Le contrat d'échange front / webservice

En tant que développeur (agent) du front ou du webservice,
je veux un contrat unique et complet de tous les échanges,
afin que le front et le webservice, construits séparément, se comprennent du premier coup (AD-6).

**Critères d'acceptation :**

**Étant donné** un dépôt sans code applicatif
**Quand** la story est livrée
**Alors** `contract/openapi.yaml` (OpenAPI 3.2.0) décrit exactement les quatre endpoints d'AD-2 : `GET /api/health`, `POST /api/sessions`, `GET /api/sessions/{sessionId}` (204 ou 404) et `POST /api/sessions/{sessionId}/participants`.
**Et** les erreurs REST sont en `application/problem+json`, avec une propriété `code` valant `PSEUDO_TAKEN`, `INVALID_PSEUDO` ou `SESSION_NOT_FOUND`.

**Étant donné** le canal `/ws/sessions/{sessionId}`
**Quand** on lit `contract/asyncapi.yaml` (AsyncAPI 3.1.0)
**Alors** on y trouve tous les messages de la convention, avec l'enveloppe `{type}` :
- du client vers le serveur : `hello`, `heartbeat`, `vote`, `reveal`, `hide`, `clear`, `changeRole` ;
- du serveur vers le client : `sessionState`, `tick`, `error`.

**Et** `sessionState` suit exactement le squelette normatif d'AD-5 : `selfParticipantId`, `round {roundId, status}`, `participants[]` (avec `joinOrder`, `hasVoted`, `vote`, `canVoteThisRound`), `progress`, `summary` et `lastChange`.
**Et** les codes d'erreur WebSocket (`ROUND_REVEALED`, `NOT_A_VOTER`, `INVALID_CARD`, `INVALID_MESSAGE`) et les codes de fermeture (`4401`, `4404`) sont décrits.
**Et** les cartes sont les chaînes `"0"` à `"21"`, `"?"` et `"coffee"`.

**Étant donné** le dossier `contract/examples/`
**Quand** le script de validation du contrat s'exécute
**Alors** chaque message et chaque réponse REST ont au moins un exemple, qui est valide contre son JSON Schema.
**Et** il y a au moins un exemple de `sessionState` pour un tour caché (le vote des autres à `null`) et un pour un tour révélé (synthèse avec une égalité sur la plus votée).
**Et** la commande de validation est documentée dans `contract/README.md`.

### Story 1.2 : Ouvrir l'outil, même quand le serveur dort

En tant que membre de l'équipe,
je veux ouvrir l'adresse de l'outil et voir une page qui me fait patienter pendant le réveil du serveur,
afin de ne jamais tomber sur une erreur technique avant un atelier (NFR-2).

**Critères d'acceptation :**

**Étant donné** le monodépôt
**Quand** la story est livrée
**Alors** `backend/` contient :
- un projet Maven 3.9.16, en Spring Boot 4.1.1 sur Java 25 ;
- les paquets `domain`, `application`, `adapter.in.rest`, `adapter.in.ws`, `adapter.out.memory` et `config` ;
- un test ArchUnit 1.5.1 qui fait échouer le build si `domain` importe Spring, Jackson ou `jakarta` (AD-1).

**Et** `frontend/` est un projet Angular 22 (Node ≥ 24.15), avec `LOCALE_ID` à `fr` et `<html lang="fr">`.
**Et** le `README` décrit le lancement local : `mvn spring-boot:run` sur le port 8080, avec `ALLOWED_ORIGINS=http://localhost:4200`, et `ng serve`.

**Étant donné** le webservice démarré
**Quand** on appelle `GET /api/health`
**Alors** il répond 200, conformément au contrat.
**Et** CORS et l'ouverture du WebSocket n'acceptent que les origines de `ALLOWED_ORIGINS` (AD-11).
**Et** le port vaut `${PORT:8080}`.
**Et** les journaux sont en JSON sur la sortie standard.

**Étant donné** l'image Docker du webservice
**Quand** on la construit
**Alors** elle part de `eclipse-temurin:25-jre`, avec une étiquette complète épinglée.
**Et** elle tourne sous un `USER` non root, dans le groupe 0, avec `chmod -R g=u` (AD-12).
**Et** elle démarre sous un UID arbitraire et n'écrit que dans `/tmp`.

**Étant donné** le front chargé
**Quand** il démarre
**Alors** il lit `/config.json` (`apiBaseUrl`), généré au build par `scripts/write-config.mjs` à partir de `API_BASE_URL`.
**Et** il interroge `/api/health` en affichant l'écran « Réveil du serveur… Ça peut prendre jusqu'à 2 minutes. », avec l'animation de dos de carte, qui s'arrête avec `prefers-reduced-motion` (UX-DR13).
**Et** au-delà de 3 minutes sans réponse, il affiche « Le serveur ne répond pas. » et le bouton « Réessayer ».
**Et** dès que le serveur répond, il affiche une page d'accueil provisoire.

**Étant donné** les jetons de DESIGN.md
**Quand** le front est construit
**Alors** toutes les couleurs, typographies, arrondis et espacements existent sous forme de propriétés CSS globales, avec les mêmes noms (UX-DR1).
**Et** le thème sombre redéfinit ces mêmes propriétés et suit `prefers-color-scheme`.
**Et** le front est servi avec la CSP `default-src 'self'; connect-src 'self' <API>` et ne charge aucune ressource tierce.

**Étant donné** le dépôt sur GitHub
**Quand** on pousse sur `main`
**Alors** GitHub Actions construit et teste le backend, le frontend et le contrat (AR15).
**Et** `deploy/render.yaml` décrit un web service Docker (plan free, `PORT=8080`, `healthCheckPath: /api/health`) et un site statique (réécriture SPA, en-têtes CSP).
**Et** aucun déploiement ne se déclenche sur un push. Le déploiement se fait sur une étiquette `v*`, le webservice avant le front (AD-13).
**Et** une étiquette `v0.1` déploie l'application sur Render, et l'écran de réveil y est observé après une mise en veille.

### Story 1.3 : Créer une session et en partager le lien

En tant qu'animateur habituel ou remplaçant,
je veux créer une session avec mon pseudo et mon rôle,
afin d'obtenir un lien à partager avec l'équipe (FR1, UJ-1, UJ-3).

**Critères d'acceptation :**

**Étant donné** l'écran d'accueil
**Quand** je l'ouvre
**Alors** je vois le formulaire d'entrée (UX-DR12) :
- un panneau de 400 px ;
- le champ « Ton pseudo », prérempli avec `pp.pseudo` s'il existe ;
- le groupe « Ton rôle » avec « Je vote » et « J'observe », « Je vote » étant sélectionné ;
- le bouton « Créer une session » sur toute la largeur.

**Et** le bouton reste désactivé tant que le pseudo est vide ou ne contient que des espaces.

**Étant donné** un pseudo valide
**Quand** je clique sur « Créer une session »
**Alors** le bouton affiche « Connexion… », et `POST /api/sessions` crée la session et m'y fait entrer.
**Et** la réponse contient `sessionId` (128 bits, en base64url), `participantId` (UUID) et `participantToken` (128 bits, `SecureRandom`) (AD-7).
**Et** le jeton est rangé sous `pp.token.{sessionId}`, et le pseudo sous `pp.pseudo`.
**Et** j'arrive à l'adresse de la session, qui affiche le lien et « Copier le lien ». « Lien copié » s'affiche pendant 2 s, et le partage natif s'ouvre sur téléphone (UX-DR11).

**Étant donné** le domaine
**Quand** un pseudo est soumis
**Alors** il est normalisé en NFC, ses espaces de début et de fin sont retirés, et il doit compter entre 1 et 20 points de code. Sinon, la réponse est `INVALID_PSEUDO` (AR14).
**Et** ces règles sont couvertes par des tests JUnit du domaine, sans Spring.
**Et** le jeton n'apparaît dans aucun journal.

**Étant donné** que le serveur est injoignable pendant l'envoi
**Quand** l'appel échoue
**Alors** « Impossible de joindre le serveur. » s'affiche sous le bouton, avec une icône.
**Et** la saisie est conservée, et le bouton redevient actif.

**Étant donné** tous les textes de l'interface
**Quand** on les compare à EXPERIENCE › Voice and Tone
**Alors** ils tutoient l'utilisateur et reprennent **mot pour mot** les libellés fixes (boutons, champs, messages). Cette règle vaut pour toutes les stories qui ajoutent du texte d'interface (UX-DR18).

### Story 1.4 : Rejoindre une session par son lien

En tant que membre de l'équipe,
je veux rejoindre la session en un seul écran avec le lien reçu,
afin d'être prêt à voter en quelques secondes (FR2, FR3, UJ-2).

**Critères d'acceptation :**

**Étant donné** un lien de session
**Quand** je l'ouvre
**Alors** le front appelle d'abord `GET /api/sessions/{sessionId}`.
**Et** si la réponse est 404, il affiche l'écran « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. », avec le bouton « Créer une session » (FR3, UX-DR13).
**Et** si la réponse est 204, il affiche l'écran Rejoindre : le même formulaire que l'accueil, avec « Je vote » présélectionné et le bouton « Rejoindre ».

**Étant donné** l'écran Rejoindre
**Quand** je valide un pseudo libre
**Alors** `POST /api/sessions/{sessionId}/participants` renvoie `participantId` et `participantToken`, que le navigateur range comme dans la story 1.3.
**Et** j'entre dans la session.

**Étant donné** un pseudo déjà utilisé par un participant de la session, en ignorant les majuscules et les espaces de début et de fin
**Quand** je valide
**Alors** la réponse est un 409 `PSEUDO_TAKEN`.
**Et** « Ce pseudo est déjà pris dans cette session. » s'affiche sous le champ, et ma saisie est conservée (FR2).

**Étant donné** que le domaine gère les participants
**Quand** quelqu'un rejoint la session
**Alors** il reçoit un `joinOrder` croissant, conservé par la session.
**Et** toute écriture passe par `SessionStore` (`find`, puis modification, puis `save`), sous le verrou de la session (AD-3, AD-9).

### Story 1.5 : Voir la table en direct

En tant que participant,
je veux voir la table des participants se remplir en direct et retrouver ma place si je rafraîchis la page,
afin de savoir qui est là avant de commencer (FR6, FR7 pour le rafraîchissement, FR16).

**Critères d'acceptation :**

**Étant donné** que je viens d'entrer dans une session
**Quand** la page de la session s'ouvre
**Alors** `SessionService` est le seul à ouvrir `/ws/sessions/{sessionId}` (AD-10).
**Et** il envoie `hello {participantToken}` dans les 5 s, puis reçoit un `sessionState` construit pour moi seul (AD-5, AD-7).
**Et** tant qu'aucun instantané n'est arrivé, la table affiche des places vides en attente, sans sablier plein écran (UX-DR14).

**Étant donné** que le serveur reçoit un `hello`
**Quand** la session n'existe pas, ou que le jeton est inconnu
**Alors** la connexion est fermée en `4404` ou en `4401`, dans cet ordre de vérification.
**Et** le client affiche l'écran « Session introuvable » (`4404`) ou l'écran Rejoindre avec le pseudo prérempli (`4401`), puis efface le jeton stocké.

**Étant donné** l'instantané
**Quand** la table s'affiche
**Alors** les participants apparaissent dans l'ordre du serveur : les votants, puis les observateurs, chaque groupe par `joinOrder`. Ma place remonte en tête de son groupe, avec la mention « (toi) » (UX-DR5, UX-DR6).
**Et** chaque place affiche le pseudo et une pastille de présence. Un observateur a la mention « observe » à la place de sa carte.

**Étant donné** une deuxième personne qui rejoint la session
**Quand** elle entre
**Alors** sa place apparaît chez tous les participants en moins d'une seconde (FR16).
**Et** chaque diffusion passe par une file d'envoi bornée pour chaque connexion (`ConcurrentWebSocketSessionDecorator`, 2 s et 64 Ko), sans aucun envoi bloquant sous le verrou (AD-3).

**Étant donné** que je suis seul dans la session
**Quand** la table s'affiche
**Alors** elle montre « Partage le lien pour inviter ton équipe », avec « Copier le lien » comme bouton principal, et la barre d'action est masquée (UX-DR14).

**Étant donné** que je rafraîchis la page
**Quand** la page se recharge
**Alors** le jeton `pp.token.{sessionId}` est réutilisé, et je retrouve ma place, mon pseudo et mon rôle, sans repasser par l'écran Rejoindre.

**Étant donné** une connexion ouverte
**Quand** le temps passe
**Alors** le client envoie `heartbeat` toutes les 5 s, et le serveur envoie `tick` toutes les 5 s (AD-8).
**Et** un **test de charge** sur l'instance Render fait tenir 5 sessions de 13 participants (65 connexions) pendant 10 min, avec une diffusion en moins d'une seconde (6 s au plus pour un départ, décision du 2026-10-03). Le résultat est consigné dans la story. S'il échoue, on applique le repli d'hébergement de la spine (Deferred).

### Story 1.6 : Voter à l'aveugle

En tant que votant,
je veux choisir une carte en secret, la changer ou la retirer,
afin d'estimer sans être influencé par les autres (FR10, FR6).

**Critères d'acceptation :**

**Étant donné** que je suis votant et que le tour est caché
**Quand** l'écran de session s'affiche
**Alors** je vois ma main de 10 vraies cartes : face blanche, liseré, valeur au centre, index dans deux coins opposés (dont un retourné), proportion 2:3, au moins 44 px de large. `☕` est rendu en texte (UX-DR3).
**Et** la main est une barre d'outils nommée « Ta carte », faite de boutons bascule (`aria-pressed`). On y navigue avec les flèches, on choisit avec Entrée ou Espace, et « Choisis ta carte » s'affiche tant que je n'ai pas voté (UX-DR7).

**Étant donné** que je choisis la carte 8
**Quand** je clique dessus
**Alors** le client envoie `vote {roundId, card: "8"}`, et la carte prend un contour rouge de 3 px et se soulève de 12 px en 150 ms.
**Et** ma place montre la face 8, avec la mention « visible par toi seul ».
**Et** chez les autres, ma place montre un dos de carte à croisillons (UX-DR4), et l'instantané qu'ils reçoivent contient `hasVoted: true` et `vote: null`.

**Étant donné** que ma carte 8 est choisie
**Quand** je clique sur 5, puis de nouveau sur 5
**Alors** mon vote passe à 5, puis il est retiré (`card: null`), et ma place redevient vide en pointillés chez tous les participants.

**Étant donné** la barre d'action pendant un tour caché
**Quand** des votes arrivent
**Alors** le compteur « N votes sur M » vient de `progress` : M compte tous les votants, déconnectés compris. S'il n'y a aucun votant, il affiche « Aucun votant » (UX-DR8).
**Et** la barre d'action reste masquée tant que je suis seul dans la session, conformément à la story 1.5 (UX-DR14).

**Étant donné** un observateur, un vote sur un tour révélé ou une carte inconnue
**Quand** l'intention `vote` arrive au serveur
**Alors** rien ne change, et le client reçoit `error` avec le code `NOT_A_VOTER`, `ROUND_REVEALED` ou `INVALID_CARD` (AD-4).
**Et** un `vote` qui porte un `roundId` périmé est ignoré silencieusement.
**Et** les règles de vote sont couvertes par des tests du domaine.

### Story 1.7 : Révéler, lire le résultat, passer au ticket suivant

En tant que participant, votant ou observateur,
je veux révéler les votes, lire immédiatement la synthèse, puis effacer pour le ticket suivant,
afin de mener la discussion sur les écarts et d'enchaîner les tickets (FR11, FR12, FR14, FR15, FR17, UJ-1).

**Critères d'acceptation :**

**Étant donné** un tour caché
**Quand** je clique sur « Révéler les votes », le bouton principal
**Alors** le client envoie `reveal {roundId}`, et tous les participants voient les faces de toutes les cartes, avec les pseudos, en moins d'une seconde. Une place sans vote affiche « n'a pas voté » (FR12).
**Et** la main est grisée et n'accepte plus de vote (FR11).
**Et** le bouton principal devient « Nouveau tour », et le bouton secondaire « Masquer » s'affiche, inactif jusqu'à l'epic 3.

**Étant donné** le tour révélé
**Quand** la synthèse s'affiche (UX-DR9)
**Alors** elle vient **uniquement** du `summary` calculé par le domaine :
- la moyenne, au dixième, arrondie avec `HALF_UP`, affichée au format français (« 5,9 ») ;
- la plus votée, avec son nombre de votes, et toutes les valeurs en cas d'égalité (« 5 et 8 · 3 votes chacune ») ;
- le min et le max ;
- le badge « Consensus ! », si tous les votes numériques sont identiques et qu'il y en a au moins deux.

**Et** `?` et `☕` sont exclus de ces calculs. Sans vote numérique, le panneau affiche « Pas de résultat chiffré ».
**Et** ces calculs sont couverts par des tests du domaine : égalités, un seul vote, uniquement des `?`, et 5,25 qui donne 5,3.

**Étant donné** un tour révélé ou caché
**Quand** je clique sur « Nouveau tour » ou sur « Effacer les votes »
**Alors** le client envoie `clear {roundId}`, tous les votes sont supprimés, et un nouveau tour caché démarre, avec un nouveau `roundId` pour tous (FR15).
**Et** aucune confirmation n'est demandée, et aucun raccourci clavier n'existe pour ces actions.

**Étant donné** que deux participants envoient `clear` ou `reveal` presque en même temps
**Quand** le serveur traite leurs intentions une par une, sous le verrou de la session
**Alors** une intention déjà satisfaite, ou qui porte un `roundId` périmé, ne change rien et n'incrémente pas `version`.
**Et** tous les participants aboutissent au même état final (FR17, AD-3, AD-4).

**Étant donné** qu'un **autre** participant révèle, masque ou efface
**Quand** je reçois l'instantané, avec `lastChange.byParticipantId` différent du mien
**Alors** les boutons de la barre d'action restent inactifs pendant 1 s (UX-DR8).
**Et** une région `aria-live` polie annonce « Votes révélés. Moyenne 5,9. Plus votée 5, 6 votes. Min 3, max 13. » ou « Nouveau tour » (UX-DR17).

### Story 1.8 : Un écran de séance qui tient sur PC et sur téléphone

En tant que participant sur PC ou sur téléphone,
je veux voir la table, le résultat et mes cartes sans faire défiler l'écran,
afin de suivre la séance d'un coup d'œil, même à 13 (UX-DR15, UX-DR16, NFR-5).

**Critères d'acceptation :**

**Étant donné** une fenêtre de PC de 1280 × 650 px utiles et 13 participants
**Quand** le tour est caché, puis révélé
**Alors** la page ne défile pas. La table a 7 places au plus par rangée (cartes de 44 × 66 px), la barre d'action fait environ 72 px, et la main a des cartes de 60 × 90 px sur une ligne.
**Et** le résultat, une fois révélé, est intégré à la barre d'action sur une seule rangée, à gauche des boutons (UX-DR9).
**Et** si la fenêtre est plus basse, seule la table défile, dans sa zone.

**Étant donné** un écran de 600 à 899 px de large
**Quand** la session s'affiche
**Alors** la table a au plus 5 places par rangée, et la main reste sur une ligne, avec des cartes d'au moins 44 px.

**Étant donné** un téléphone de moins de 600 px de large (à partir de 360 px)
**Quand** le tour est caché
**Alors** la barre du haut est compacte, la main forme un tiroir fixe de 2 lignes de 5 cartes, et la barre d'action se place juste au-dessus (compteur sur une ligne, boutons en dessous).
**Et** quand le tour est révélé, le tiroir se replie, et le résultat condensé (« Moy. 5,9 · Plus votée 5 (6) · Min 3 · Max 13 ») s'affiche au-dessus de la barre d'action. S'il déborde, il passe sur deux lignes.

**Étant donné** la suite Playwright (Chromium et WebKit)
**Quand** elle s'exécute sur PC (1280 × 650) et sur téléphone (390 × 844) avec 13 participants simulés
**Alors** elle vérifie l'absence de défilement de page sur PC, la présence de la main et du résultat à l'écran, le repli du tiroir sur téléphone, et l'absence de défilement horizontal à 360 px.

**Étant donné** tous les critères de l'Epic 1 validés
**Quand** on pose l'étiquette `v1.0` en dehors d'un atelier
**Alors** le webservice, puis le front, sont déployés sur Render, et un atelier réel peut s'y tenir (SM-1).

## Epic 2 : Personne ne perd sa place

Une coupure n'a plus de conséquence :
- reconnexion automatique ;
- présence en direct ;
- l'inactivité ou un onglet en arrière-plan ne déconnectent jamais ;
- retrait au bout de 5 min, puis retour transparent ;
- reprise du pseudo depuis un autre appareil ;
- plusieurs onglets comptent comme un seul participant ;
- la session expire au bout de 24 h ;
- des plafonds protègent le service public contre l'épuisement de ses ressources.

### Story 2.1 : Voir qui est vraiment là

En tant que participant,
je veux voir à tout moment qui est connecté et qui ne l'est plus,
afin de savoir si l'on peut révéler ou s'il faut attendre quelqu'un (FR6, FR16, AD-8).

**Critères d'acceptation :**

**Étant donné** un participant qui a ouvert la session dans deux onglets du même navigateur
**Quand** les deux onglets sont connectés
**Alors** le domaine compte un seul participant, qui porte deux connexions.
**Et** ce participant reste `connected: true` tant qu'au moins une de ses connexions est ouverte et vivante.
**Et** l'ouverture et la fermeture de chaque connexion passent par le verrou de la session (AD-3).

**Étant donné** que ce participant ferme son dernier onglet
**Quand** la connexion se ferme proprement
**Alors** il passe à `connected: false` chez tous les autres en moins d'une seconde après que le serveur a constaté la fermeture, soit 6 s au plus de bout en bout derrière Render, avec `lastChange.action: PRESENCE` (FR16, décision du 2026-10-03).

**Étant donné** une connexion ouverte
**Quand** le serveur la surveille
**Alors** il lui envoie un ping de protocole WebSocket toutes les 5 s.
**Et** si ni pong ni message n'arrive pendant 15 s, le balayeur ferme la connexion. Si c'était la dernière du participant, celui-ci passe à `connected: false`, et le changement est diffusé en moins d'une seconde (FR16).
**Et** la mise à jour de la dernière activité d'une connexion n'incrémente pas `version` et ne diffuse rien (AD-3).

**Étant donné** un participant déconnecté
**Quand** la table s'affiche
**Alors** son pseudo passe en `muted-foreground`, avec une pastille grise et la mention « déconnecté ». Son opacité ne change pas (UX-DR5).
**Et** sa carte garde son aspect : dos, vide ou face.
**Et** il reste compté dans le M de « N votes sur M ».

**Étant donné** le balayeur
**Quand** il tourne, une fois par seconde
**Alors** il lit l'heure uniquement par `java.time.Clock` en UTC.
**Et** un test du domaine, avec une horloge fixe, vérifie le seuil de 15 s.

### Story 2.2 : Se reconnecter tout seul après une coupure

En tant que participant,
je veux que la page se reconnecte d'elle-même après une coupure de réseau,
afin de retrouver ma place et mon vote sans rien faire (FR7, UJ-2).

**Critères d'acceptation :**

**Étant donné** une connexion ouverte
**Quand** aucun message du serveur (`tick`, `sessionState` ou autre) n'est arrivé depuis 12 s
**Alors** `SessionService` considère la connexion comme perdue. Il la ferme et tente de se reconnecter aussitôt, puis au bout de 1, 2, 4 et 8 s, puis toutes les 10 s (AD-8).
**Et** il retente immédiatement sur les événements `online` et `visibilitychange` (retour au premier plan).
**Et** chaque reconnexion rejoue `hello`, avec le jeton de `pp.token.{sessionId}`.

**Étant donné** une connexion ouverte
**Quand** elle se ferme avec un code autre que `4401` ou `4404` : fermeture par le serveur (`1001`, redémarrage ou redéploiement), coupure (`1006`), débordement de la file d'envoi (`4500`), message refusé (`1008`, `1009`) ou tout autre code
**Alors** `SessionService` considère la connexion comme perdue **immédiatement**, sans attendre les 12 s, et applique la même séquence de reconnexion (rétrospective de l'epic 1, F1).
**Et** aucune fermeture ne laisse la page figée sans retour : soit la reconnexion est en cours, soit un écran d'état est affiché.

**Étant donné** une connexion perdue
**Quand** la perte est constatée
**Alors** la main et les boutons de la barre d'action sont désactivés **aussitôt**, avant même l'apparition du bandeau. Aucun clic ne part dans le vide, et aucun ne donne l'illusion d'avoir été pris en compte (F1).
**Et** une intention envoyée juste avant la coupure, et que le serveur n'a pas reçue, n'apparaît pas comme prise en compte : après la reconnexion, la main et la table montrent l'état du premier `sessionState`, sans mise à jour optimiste.

**Étant donné** une coupure en cours
**Quand** elle dure plus de 2 s
**Alors** le bandeau ambre « Reconnexion… » apparaît sous la barre du haut. La table reste visible, et les boutons d'action et la main restent désactivés (UX-DR14).
**Et** une coupure de moins de 2 s ne fait apparaître aucun bandeau, mais la main et les boutons restent désactivés tant que la connexion n'est pas rétablie.

**Étant donné** que la connexion revient pendant le même tour
**Quand** le premier `sessionState` arrive
**Alors** le client l'accepte, quelle que soit sa `version` (AD-5), et le bandeau disparaît.
**Et** mon pseudo, mon rôle et mon vote du tour en cours sont intacts (FR7).

**Étant donné** un participant qui ne touche à rien pendant 20 minutes, avec l'onglet de l'outil en arrière-plan derrière la visio
**Quand** le navigateur ralentit les minuteries de cet onglet
**Alors** le participant reste `connected: true` pendant toute la durée, puisque la vivacité repose sur le ping de protocole du serveur (FR7, AD-8).
**Et** un test Playwright simule un onglet caché pendant 20 minutes (temps accéléré ou horloge simulée) et vérifie qu'aucune déconnexion n'est diffusée.

**Étant donné** que la session n'existe plus au moment de la reconnexion
**Quand** le serveur ferme en `4404`
**Alors** la page n'insiste pas : elle affiche « Session introuvable » et supprime le jeton (FR7).

**Étant donné** un redémarrage du webservice pendant une séance, ce qui perd les sessions en mémoire (NFR1)
**Quand** le webservice est arrêté puis relancé
**Alors** chaque participant voit d'abord la main et les boutons désactivés, puis « Reconnexion… », puis l'écran « Session introuvable » dès que le webservice répond `4404` (F1).
**Et** un test vérifie ce parcours de bout en bout. La rétrospective de l'epic 1 l'a observé à la main : la table restait figée sans message, et un clic sur une carte ne faisait rien.

### Story 2.3 : Revenir après une longue absence

En tant que participant dont le téléphone s'est verrouillé pendant l'explication d'une story,
je veux retrouver ma place automatiquement en le rallumant,
afin de ne pas être sorti de l'atelier (FR7, FR9).

**Critères d'acceptation :**

**Étant donné** un participant sans aucune connexion depuis 5 minutes
**Quand** le balayeur passe
**Alors** le participant est retiré de la table, son vote du tour en cours est supprimé, et son pseudo redevient libre (FR9).
**Et** son jeton **reste valable** jusqu'à l'expiration de la session (AD-7).
**Et** le retrait est diffusé à tous, avec `lastChange.action: LEAVE`.

**Étant donné** ce participant qui rallume son téléphone
**Quand** son navigateur se reconnecte avec son jeton et que son pseudo est encore libre
**Alors** il est remis à sa place, avec le même `participantId`, le même pseudo et le même rôle, et reçoit un nouveau `joinOrder`. Il ne passe par aucun écran intermédiaire, seulement par « Reconnexion… » (FR7, UX-DR14).
**Et** son arrivée est diffusée à tous, avec `lastChange.action: JOIN`.

**Étant donné** que son pseudo a été pris par quelqu'un d'autre entre-temps
**Quand** son navigateur se reconnecte
**Alors** le serveur ferme la connexion en `4401`, et le client affiche l'écran Rejoindre, avec le pseudo prérempli, puis supprime le jeton.

**Étant donné** les délais du balayeur
**Quand** on les teste avec une horloge fixe
**Alors** un participant est retiré à 5 min, et pas avant.
**Et** un participant resté connecté avec l'onglet en arrière-plan n'est jamais retiré.

### Story 2.4 : Reprendre sa place depuis un autre appareil

En tant que participant qui passe de son téléphone à son PC,
je veux reprendre mon pseudo sur l'autre appareil,
afin de continuer à voter sans perdre mon vote (FR8, UJ-2).

**Critères d'acceptation :**

**Étant donné** un participant **déconnecté**, en attente de retrait ou non
**Quand** quelqu'un rejoint la session depuis un autre appareil avec son pseudo, en ignorant les majuscules et les espaces
**Alors** `POST /api/sessions/{sessionId}/participants` reprend ce participant, avec le même `participantId`, son rôle et son vote (FR8).
**Et** le serveur émet un **nouveau** `participantToken`, révoque l'ancien, et ferme en `4401` toutes les connexions qui utilisaient encore l'ancien jeton (AD-7).

**Étant donné** l'ancien appareil
**Quand** il reçoit la fermeture `4401`, ou qu'il tente de se reconnecter avec le jeton révoqué
**Alors** il affiche l'écran Rejoindre avec le pseudo prérempli et le message « Ta place a été reprise depuis un autre appareil. », puis supprime le jeton (UX-DR14).

**Étant donné** un pseudo utilisé par un participant **connecté**
**Quand** quelqu'un tente de le reprendre
**Alors** la réponse est un 409 `PSEUDO_TAKEN`, et rien ne change (FR8).

**Étant donné** la reprise
**Quand** elle a lieu
**Alors** aucun jeton, ancien ou nouveau, n'apparaît dans un journal, une URL ou un instantané (AD-7).

### Story 2.5 : Une session qui s'efface d'elle-même

En tant que membre de l'équipe,
je veux que chaque session et ses données disparaissent au bout de 24 h,
afin qu'il ne reste aucune trace de nos ateliers (FR4, NFR6).

**Critères d'acceptation :**

**Étant donné** une session créée à l'instant T
**Quand** le balayeur passe à T + 24 h (une `Duration` calculée par `java.time.Clock` en UTC)
**Alors** la session est supprimée du `SessionStore`, avec ses pseudos, ses votes et ses jetons.
**Et** toutes ses connexions sont fermées en `4404`.

**Étant donné** un participant de cette session
**Quand** son navigateur reçoit `4404`, ou qu'il rouvre le lien après l'expiration
**Alors** il voit l'écran « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. », avec le bouton « Créer une session » (FR3).
**Et** la clé `pp.token.{sessionId}` est supprimée du navigateur.

**Étant donné** l'expiration
**Quand** on la teste
**Alors** un test avec une horloge fixe vérifie qu'une session vit à T + 23 h 59 et n'existe plus à T + 24 h.
**Et** aucun journal ne conserve de pseudo, de jeton ou de valeur de vote de la session (NFR6).

### Story 2.6 : Un service qui tient face aux abus

En tant qu'équipe qui tient ses ateliers sur un service public et gratuit,
je veux que le webservice refuse ce qui dépasse un usage normal,
afin qu'un client anonyme ne puisse pas épuiser sa mémoire et faire tomber nos ateliers en cours (NFR4, NFR6, rétrospective de l'epic 1, F2).

Plafonds retenus par Eric le 2026-10-03 : de 2 à 4 fois au-dessus des minimums de NFR4. Ils sont réglables par configuration, avec ces valeurs par défaut.

**Critères d'acceptation :**

**Étant donné** une requête `POST /api/sessions` ou `POST /api/sessions/{sessionId}/participants`
**Quand** son corps dépasse 2 Ko
**Alors** elle est refusée en `413`, sans que le corps soit lu en entier.

**Étant donné** un message WebSocket
**Quand** il dépasse 4 Ko
**Alors** la connexion est fermée en `1009`, et le client applique la reconnexion de la story 2.2.

**Étant donné** 50 sessions déjà présentes en mémoire
**Quand** quelqu'un crée une session
**Alors** la réponse est un `503` en `application/problem+json`, avec le code `SESSION_LIMIT_REACHED`, et aucune session n'est créée.
**Et** le front affiche « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. » sous le bouton. La saisie est conservée, et le bouton redevient actif.
**Et** les sessions expirées (story 2.5) libèrent leur place.

**Étant donné** une même adresse IP cliente
**Quand** elle crée plus de 10 sessions en une minute
**Alors** les créations suivantes reçoivent un `429` en `application/problem+json`, avec le code `TOO_MANY_REQUESTS` et un en-tête `Retry-After`.
**Et** le front affiche « Trop de sessions créées depuis ton réseau. Patiente une minute. » sous le bouton.
**Et** l'adresse prise en compte est celle du client transmise par le proxy de Render (`X-Forwarded-For`, configuration explicite et testée), et non celle du proxy.
**Et** les compteurs par adresse ne vivent qu'en mémoire, sont purgés au bout d'une minute, et aucune adresse IP n'apparaît dans un journal (NFR6).

**Étant donné** une session qui compte déjà 30 participants
**Quand** quelqu'un tente de la rejoindre
**Alors** la réponse est un `409` en `application/problem+json`, avec le code `SESSION_FULL`, et rien ne change.
**Et** le front affiche « Cette session est complète. » sous le champ, et la saisie est conservée.
**Et** un participant retiré au bout de 5 min (story 2.3) libère sa place.

**Étant donné** le contrat
**Quand** la story est livrée
**Alors** `openapi.yaml` décrit les réponses `413`, `429` et `503` et les codes `SESSION_FULL`, `SESSION_LIMIT_REACHED` et `TOO_MANY_REQUESTS`, avec un exemple chacun. Le contrat n'évolue que par ajout (AD-13).
**Et** `asyncapi.yaml` décrit la fermeture `1009`.
**Et** les nouveaux libellés, validés par Eric le 2026-10-03, figurent dans EXPERIENCE › Voice and Tone et State Patterns. L'interface les reprend mot pour mot (UX-DR18).

**Étant donné** les plafonds
**Quand** on les teste
**Alors** des tests du domaine, sans Spring, vérifient le refus à 31 participants et à 51 sessions, et l'acceptation juste en dessous.
**Et** le test de charge de la story 1.5 (5 sessions de 13 participants) passe toujours, sans aucun refus.

## Epic 3 : Des séances souples et soignées

L'outil est complet et agréable :
- changer de rôle en séance ;
- masquer un tour révélé pour revoter ;
- thème sombre ;
- révélation animée ;
- accessibilité vérifiée ;
- tests de bout en bout des trois parcours.

### Story 3.1 : Changer de rôle en pleine séance

En tant que participant,
je veux passer de votant à observateur, et inversement, sans quitter la table,
afin de m'adapter au déroulé de l'atelier (FR5).

**Critères d'acceptation :**

**Étant donné** le menu du participant dans la barre du haut
**Quand** je l'ouvre
**Alors** il affiche mon pseudo et me propose « Je vote » ou « J'observe », mon rôle actuel étant sélectionné (UX-DR11).
**Et** mon choix envoie `changeRole` avec le champ `role` (AD-4). Choisir le rôle que j'ai déjà ne change rien.

**Étant donné** que je suis votant, que j'ai voté et que le tour est caché
**Quand** je passe observateur
**Alors** mon vote est retiré, ma main est remplacée par « Tu observes » et « Je veux voter », et ma place passe dans le groupe des observateurs, à la fin de la table (FR5, UX-DR6).

**Étant donné** que je suis votant, que j'ai voté et que le tour est révélé
**Quand** je passe observateur
**Alors** mon vote reste affiché, puisqu'il est verrouillé (FR11), et il reste compté dans la synthèse, jusqu'au masquage (FR13) ou à l'effacement du tour.

**Étant donné** que je suis observateur et que le tour est révélé
**Quand** je passe votant
**Alors** l'instantané porte `canVoteThisRound: false` pour moi, ma place affiche « votera au prochain tour », et ma main reste grisée jusqu'à ce que le tour redevienne caché, par un masquage ou un `clear` (FR5, FR13).

**Étant donné** un changement de rôle
**Quand** il est traité
**Alors** il est diffusé à tous en moins d'une seconde, avec `lastChange.action: ROLE` (FR16).
**Et** M, dans « N votes sur M », est recalculé par le serveur.
**Et** les règles sont couvertes par des tests du domaine.

### Story 3.2 : Masquer pour revoter

En tant que participant,
je veux masquer un tour révélé,
afin que l'équipe puisse revoter après la discussion sans effacer les votes (FR13).

**Critères d'acceptation :**

**Étant donné** un tour révélé
**Quand** je clique sur « Masquer », le bouton secondaire, désormais actif
**Alors** le client envoie `hide {roundId}`, et le tour redevient caché pour tous en moins d'une seconde. Les faces redeviennent des dos, et la synthèse disparaît (FR13).
**Et** les votants peuvent de nouveau changer ou retirer leur carte, et la main redevient active.
**Et** le `roundId` ne change pas.

**Étant donné** un participant devenu observateur pendant la révélation
**Quand** le tour est masqué
**Alors** son vote est retiré (FR13).
**Et** un observateur devenu votant pendant la révélation peut maintenant voter (`canVoteThisRound: true`).

**Étant donné** deux participants qui masquent en même temps, ou un `hide` sur un tour déjà caché
**Quand** le serveur traite ces intentions
**Alors** une intention déjà satisfaite ne change rien et n'incrémente pas `version` (AD-4).
**Et** quand c'est un **autre** participant qui masque, mes boutons d'action restent inactifs pendant 1 s (UX-DR8).

### Story 3.3 : Choisir son thème

En tant que participant,
je veux choisir entre le thème automatique, clair ou sombre,
afin d'être à l'aise quel que soit mon écran ou l'éclairage (UX-DR2).

**Critères d'acceptation :**

**Étant donné** le menu du participant
**Quand** je choisis le thème « Automatique », « Clair » ou « Sombre »
**Alors** le thème s'applique immédiatement, et le choix est mémorisé sous `pp.theme`, sans passer par le serveur.
**Et** « Automatique », la valeur par défaut, suit `prefers-color-scheme`.

**Étant donné** le thème sombre
**Quand** la session s'affiche
**Alors** toutes les propriétés CSS sont redéfinies avec les jetons `-dark` (AD-10).
**Et** les cartes gardent une face claire (`card-face-dark`), avec le liseré `card-frame-dark`, et la carte choisie a un contour en `card-ink-dark` (UX-DR3).
**Et** les ombres sont remplacées par des surfaces plus claires.

**Étant donné** les deux thèmes
**Quand** on mesure les contrastes des couples texte / fond et des éléments graphiques
**Alors** ils respectent le niveau AA : 4,5:1 pour le texte, 3:1 pour les grands textes et les éléments graphiques (DESIGN › Colors).

### Story 3.4 : Une révélation qui se voit

En tant que participant,
je veux voir les cartes se retourner au moment de la révélation,
afin que ce moment clé soit agréable et bien perçu par tous (UX-DR10).

**Critères d'acceptation :**

**Étant donné** un tour caché avec des votes
**Quand** le tour est révélé
**Alors** les cartes de la table se retournent l'une après l'autre, en environ 400 ms au total, puis la synthèse apparaît.
**Et** l'animation ne retarde pas la réception de l'instantané : l'état est déjà à jour, seul l'affichage est animé.

**Étant donné** un utilisateur qui a activé `prefers-reduced-motion`
**Quand** le tour est révélé
**Alors** les faces apparaissent directement, sans aucun mouvement.

**Étant donné** l'interface
**Quand** on la parcourt
**Alors** aucune autre animation n'est ajoutée : ni son, ni vibration, ni confettis, ni fenêtre modale (EXPERIENCE › Interaction Primitives).

### Story 3.5 : Un outil accessible à tous

En tant que participant qui utilise un clavier ou un lecteur d'écran,
je veux pouvoir mener toute une séance sans souris et être informé des événements importants,
afin de participer pleinement à l'estimation (UX-DR17, NFR5).

**Critères d'acceptation :**

**Étant donné** tous les écrans (accueil, rejoindre, session cachée et révélée, écrans d'état) dans les deux thèmes
**Quand** l'audit automatisé axe s'exécute dans Playwright
**Alors** il ne relève aucune violation WCAG 2.2 AA.

**Étant donné** un utilisateur au clavier
**Quand** il mène une séance complète (rejoindre, voter, révéler, lire le résultat, effacer, changer de rôle)
**Alors** tout est possible avec Tab, les flèches, Entrée et Espace, et le focus est toujours visible (contour `primary`).
**Et** après une révélation déclenchée par un autre participant, le focus reste où il était.

**Étant donné** un lecteur d'écran
**Quand** la séance se déroule
**Alors** la région `aria-live` polie annonce la révélation (moyenne, plus votée, min, max), le nouveau tour et les arrivées.
**Et** le compteur « N votes sur M » est annoncé au plus toutes les 5 s, et les votes des autres ne sont jamais annoncés un par un.
**Et** l'information n'est jamais portée par la couleur seule : la présence a un libellé, et le consensus un texte.

**Étant donné** un zoom à 200 %, ou un écran de 360 px de large
**Quand** on affiche chaque écran
**Alors** il n'y a aucun défilement horizontal, et tous les éléments actionnables mesurent au moins 44 × 44 px (NFR5).

### Story 3.6 : Les trois parcours garantis de bout en bout

En tant qu'équipe,
je veux que les trois parcours clés soient testés automatiquement à chaque changement,
afin de livrer des versions sans régression avant nos ateliers (AR16, UJ-1, UJ-2, UJ-3).

**Critères d'acceptation :**

**Étant donné** la suite Playwright, sur Chromium et WebKit, dans la CI GitHub Actions
**Quand** le parcours UJ-1 s'exécute
**Alors** Eric crée une session comme observateur et copie le lien, sept votants rejoignent et votent, Eric révèle (synthèse attendue sans consensus), efface, et l'équipe revote jusqu'au consensus.

**Étant donné** le parcours UJ-2, sur un gabarit de téléphone
**Quand** il s'exécute
**Alors** Sofia rejoint et vote 8. Sa connexion est coupée puis rétablie : elle voit « Reconnexion… » puis retrouve son vote.
**Et** Sofia reprend ensuite sa place depuis un second navigateur, et le premier affiche « Ta place a été reprise depuis un autre appareil. ».

**Étant donné** le parcours UJ-3
**Quand** il s'exécute
**Alors** Karim crée une session sans aucun droit particulier, pendant qu'une seconde session est active en parallèle.
**Et** aucune donnée ne passe d'une session à l'autre.

**Étant donné** tous les critères des epics 1 à 3 validés
**Quand** on pose l'étiquette de version en dehors d'un atelier
**Alors** le webservice, puis le front, sont déployés sur Render (AD-13), et la version est prête pour mesurer SM-1 : trois ateliers consécutifs menés uniquement avec l'outil.
