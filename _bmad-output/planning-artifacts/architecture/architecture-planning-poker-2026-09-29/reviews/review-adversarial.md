---
type: review
lens: adversarial (paires d'unités conformes mais incompatibles)
target: ARCHITECTURE-SPINE.md (AD-1 à AD-12)
date: 2026-09-29
---

# Revue adversariale de la spine : paires d'unités incompatibles

**Méthode.** Pour chaque trou, on construit deux unités d'un niveau inférieur (des stories implémentées séparément par des agents, en Java hexagonal ou en Angular 22) qui respectent **chaque AD à la lettre** mais qui, une fois assemblées, ne fonctionnent pas ensemble. Chaque paire trouvée est un trou à fermer, par un nouvel AD ou par une Rule resserrée.

**Échelle de sévérité.**
- **Critique** : l'assemblage casse une exigence centrale (FR-16, FR-17, NFR-1, NFR-6) ou rend l'application inutilisable en séance.
- **Élevée** : un bogue visible en séance, ou une reprise coûteuse de plusieurs stories.
- **Moyenne** : un comportement divergent, qu'on peut rattraper localement.
- **Faible** : un risque de dérive, peu coûteux à corriger.

## Synthèse

| # | Trou | Sévérité | Correctif proposé |
| --- | --- | --- | --- |
| T1 | Le signal de vie est une « modification » : `version` augmente toutes les ~0,4 s, et le blocage de 1 s ne se lève jamais | Critique | AD-8 : `lastSeenAt` n'est pas un état observable ; seule une transition de `connected` incrémente `version` et diffuse |
| T2 | Forme de `sessionState` fixée par la première story venue, en parallèle des deux côtés | Critique | Nouvel AD-13 : story 0 « contrat seul » + squelette normatif de `sessionState` dans la spine |
| T3 | Poignée de main WebSocket : jeton dans l'URL, dans le sous-protocole ou dans un premier message ; pas d'instantané initial garanti ; ordre 4401/4404 | Critique | Nouvel AD-14 : message `hello` en premier, instantané initial obligatoire, session vérifiée avant jeton |
| T4 | Plusieurs onglets, reprise FR-8 et enregistrement des connexions hors verrou | Élevée | Nouvel AD-15 : compteur de connexions par participant, rotation du jeton à la reprise, enregistrement sous verrou |
| T5 | Envoi bloquant sous verrou, balayeur, suppression de session et sémantique de `SessionStore` | Élevée | AD-3 et AD-9 resserrés : diffusion = mise en file non bloquante ; `SessionStore` à sémantique charger-modifier-enregistrer ; fermeture 4404 à la suppression |
| T6 | Chemins REST : création en un ou deux appels ; FR-3 impossible sans lecture interdite par AD-2 | Élevée | AD-2 resserré : liste fermée des endpoints, dont `GET /api/sessions/{id}` |
| T7 | Blocage de 1 s : le client ne sait pas qu'un changement est distant | Élevée | AD-5 : champ `lastChange { by, action }` dans l'instantané ; règle de déclenchement côté front |
| T8 | `version` conservée d'une session à l'autre dans le `SessionService` singleton | Moyenne | AD-5 : `version` est comparée par `sessionId`, remise à zéro à chaque changement de session |
| T9 | `roundId` : entier ou UUID, nouveau ou non sur `hide` | Moyenne | AD-4 : `roundId` chaîne opaque, régénérée **uniquement** par `clear` ; `vote` porte aussi `roundId` |
| T10 | Santé du serveur pendant le réveil | Moyenne | AD-12 : réponse fixée, CORS, délais du front |
| T11 | Forme de `config.json` et dérivation de l'URL WebSocket | Moyenne | AD-11 : schéma de `config.json` fixé |
| T12 | Erreurs WebSocket : intentions invalides, messages mal formés, catalogue de codes | Moyenne | Conventions : catalogue fermé de codes WS dans `asyncapi.yaml` |
| T13 | Signal de vie d'un onglet en arrière-plan (limitation des minuteurs) | Moyenne | AD-8 : signal de vie émis par un Web Worker ; tolérance documentée |
| T14 | Port `Clock` : interface maison ou `java.time.Clock` ; calcul des 24 h | Faible | AD-8 : `java.time.Clock` injecté, `Instant` + `Duration.ofHours(24)` |

---

## T1 — Le signal de vie fait tourner `version` en boucle [Critique]

**Unité A (back, story « signal de vie et balayeur »).** Pour que le balayeur (AD-8) sache depuis quand aucun message n'est arrivé, l'agent ajoute `lastSeenAt` au `Participant` du domaine. Recevoir un `heartbeat` modifie donc un objet `Session`. AD-3 dit : « **Chaque** modification incrémente `version`, **puis** déclenche la diffusion ». L'agent applique : chaque signal de vie produit une nouvelle version et 13 instantanés.

**Unité B (front, story « barre d'action »).** Conformément à AD-8 (« blocage de 1 s après un changement distant ») et faute d'autre information, l'agent considère que tout instantané dont `version` a augmenté sans que j'aie envoyé d'intention est un changement distant, et bloque la barre d'action pendant 1 s.

**Pourquoi les deux sont conformes.** A applique AD-3 littéralement ; rien ne dit qu'un horodatage de présence n'est pas une « modification ». B applique AD-8 ; rien ne définit « changement distant ».

**Résultat assemblé.** 13 participants × 1 signal toutes les 5 s = une nouvelle version toutes les ~0,38 s en moyenne. La barre d'action reste **bloquée en permanence**. En plus : 13 × 13 / 5 ≈ 34 instantanés par seconde et par session, 170 par seconde pour 5 sessions, sur 0,1 CPU (NFR-4). Si A place au contraire `lastSeenAt` hors du domaine, dans l'adaptateur WS, le balayeur de `application` ne peut plus le lire via `SessionStore` : autre incompatibilité.

**Correctif (AD-8 resserré).**
- `lastSeenAt` vit dans le domaine, mais c'est une **métadonnée de vivacité non observable** : la mettre à jour se fait sous le verrou de session, **n'incrémente pas** `version` et **ne diffuse rien**.
- Seules les **transitions** observables (`connected` passe de `true` à `false` ou l'inverse, retrait, suppression) incrémentent `version` et diffusent.
- Tout message entrant (intention ou `heartbeat`) met à jour `lastSeenAt`.
- Le blocage de 1 s côté front se déclenche selon T7, jamais sur une simple hausse de `version`.

## T2 — Qui fixe la forme de `sessionState` ? [Critique]

**Unité A (back, première story WebSocket).** AD-6 impose de commencer par `contract/asyncapi.yaml`. L'agent écrit :
`{ type, version, round: { id, status }, participants: [{ id, pseudo, role, connected, vote }], stats: { avg, mode, min, max, consensus } }`, où `vote` vaut la carte pour soi, `"HIDDEN"` pour les autres votants qui ont voté, et `null` sinon.

**Unité B (front, story « table des participants », lancée en parallèle sur une autre branche).** Même règle : l'agent commence par le contrat, qu'il crée puisqu'il n'existe pas encore, avec le glossaire de la spine :
`{ type, version, roundId, round: { status }, me: { participantId, card }, participants: [{ participantId, pseudo, role, connected, hasVoted, card }], summary: { average, mostVoted: { values, count }, min, max, consensus } }`.

**Pourquoi les deux sont conformes.** AD-6 dit que le contrat est la source de vérité et que toute modification commence par lui, mais ne dit **pas qui le crée ni quand**. La spine ne cite que `hasVoted`, `version`, `roundId` et `connected` : tout le reste (`participantId` ou `id`, `card` ou `vote`, `summary` ou `stats`, emplacement de « moi ») est libre.

**Autres ambiguïtés du même trou.**
- **Qui suis-je ?** AD-7 range uniquement le jeton dans le `localStorage`. Après un rafraîchissement, le front ne connaît plus son `participantId` : sans champ « moi » dans l'instantané, il ne peut ni placer « (toi) » en premier ni afficher « visible par toi seul ».
- **Ordre des places.** EXPERIENCE impose l'ordre d'arrivée. Si le domaine range les participants dans une `HashMap`, l'ordre change d'un instantané à l'autre ; si le front trie lui-même, il lui faut une clé d'arrivée.
- **Synthèse.** Plus votée : valeurs en chaînes (`"5"`) ou en nombres ? Moyenne absente ou `null` quand il n'y a aucun vote numérique ?
- **Observateur devenu votant pendant un tour révélé** (FR-5) : comment le front sait-il qu'il « votera au prochain tour » ?

**Correctif (nouvel AD-13 — Contrat d'abord, par une story dédiée).**
- La **story 0** ne livre que `contract/openapi.yaml`, `contract/asyncapi.yaml` et leurs exemples validés. Aucune story back ou front qui touche un message ne démarre avant sa fusion. Ensuite, un changement de contrat est une story qui modifie le contrat et les deux côtés.
- La spine fixe le squelette normatif, que la story 0 détaille :
  - `sessionState` : `sessionId`, `version` (entier), `self: { participantId }`, `round: { roundId, status, summary | null }`, `participants[]` **dans l'ordre d'arrivée fixé par le serveur**, chaque élément `{ participantId, pseudo, role, connected, hasVoted, card | null, votesNextRound }`.
  - `card` n'est non nul que pour soi pendant un tour caché, et pour tous après la révélation.
  - `summary` : `{ average: number | null, mostVoted: { cards: string[], count: int } | null, min: string | null, max: string | null, consensus: boolean }`. Les cartes sont toujours des chaînes.
- Le front ne trie que par groupe (votants, puis observateurs, avec soi en tête). Il ne réordonne jamais l'ordre d'arrivée.

## T3 — Poignée de main WebSocket [Critique]

**Unité A (back, story « ouverture du WebSocket »).** Un navigateur ne peut pas ajouter d'en-tête à un WebSocket. AD-7 interdit le jeton dans « une URL partagée » et dans un journal. L'agent choisit donc le sous-protocole : `new WebSocket(url, ["pp.v1", "token." + token])`, lu dans un `HandshakeInterceptor`. Il n'envoie d'instantané qu'« après chaque modification » (AD-5) : si le participant est déjà connecté dans un autre onglet, l'ouverture ne change rien, donc aucun instantané n'est envoyé.

**Unité B (front, `SessionService`).** L'agent met le jeton dans la chaîne de requête, `wss://api/ws?sessionId=…&token=…` : cette URL n'est pas « partagée », elle n'est jamais affichée. Il attend un instantané après l'ouverture pour remplacer les places vides.

**Pourquoi les deux sont conformes.** AD-7 dit seulement « présenté à l'ouverture du WebSocket ». Le premier message applicatif est exclu par les Conventions, dont la liste client vers serveur est fermée (`vote`, `reveal`, `hide`, `clear`, `changeRole`, `heartbeat`). Il reste donc la chaîne de requête et le sous-protocole, et les deux respectent la lettre d'AD-7.

**Résultat assemblé.**
- Le back refuse la connexion : pas de sous-protocole, donc 4401, donc écran Rejoindre en boucle.
- Si B avait choisi le sous-protocole mais que A ne le renvoyait pas dans la réponse, Chrome ferme la connexion.
- La chaîne de requête finit dans les journaux d'accès du proxy Render et d'OpenShift : la fuite qu'AD-7 voulait empêcher.
- Pas d'instantané initial pour un deuxième onglet : places vides pour toujours.
- **Ordre des contrôles.** Après un redémarrage du serveur, jeton **et** session sont inconnus. Si A contrôle le jeton d'abord : 4401, donc écran Rejoindre, puis `SESSION_NOT_FOUND` au clic. FR-7 exige l'écran « Session introuvable » directement.

**Correctif (nouvel AD-14 — Poignée de main).**
- URL fixe : `{wsUrl}/ws/sessions/{sessionId}`. Aucun secret dans l'URL.
- Premier message client obligatoire, `{ "type": "hello", "participantToken": "…" }`, ajouté à la liste des Conventions. Le serveur ne traite rien d'autre avant lui, et ferme en 4401 s'il n'arrive pas dans les 5 s.
- Contrôles dans cet ordre : session inexistante → **4404** ; puis jeton inconnu, retiré ou repris → **4401**.
- Une poignée de main réussie envoie **toujours**, et immédiatement, un `sessionState` à **cette** connexion, que la version change ou non.
- Échec HTTP de la mise à niveau (502, 503, réseau) ou fermeture 1006 : erreur transitoire, reconnexion avec délai croissant et bandeau après 2 s. Seuls 4401 et 4404 arrêtent les tentatives.

## T4 — Plusieurs onglets, reprise FR-8 et enregistrement des connexions [Élevée]

**Unité A (back, story « reconnexion »).** Les Conventions associent 4401 à « repris ailleurs ». L'agent en déduit « une connexion par participant » : une nouvelle connexion avec le même jeton ferme l'ancienne en 4401. Sur fermeture d'un socket, le participant passe à `connected=false` (FR-16 : déconnexion explicite diffusée en moins d'1 s).

**Unité B (front, story « onglets multiples »).** FR-7 : « plusieurs onglets représentent un seul participant ». AD-7 : le jeton est partagé par le `localStorage`. Deux onglets ouvrent chacun leur WebSocket avec le même jeton.

**Résultat assemblé.** Les deux onglets se renvoient mutuellement à l'écran Rejoindre (4401). Même sans cette fermeture, fermer un seul onglet fait passer le participant « déconnecté » alors que l'autre onglet est ouvert. Le compte de NFR-4 (65 connexions) ne correspond plus à la présence.

**Variante : reprise FR-8 contre reconnexion.**
- *Story REST « rejoindre »* : à la reprise d'un pseudo déconnecté, elle renvoie le jeton **existant** du participant. Rien n'impose de le changer, et AD-7 dit seulement que le jeton est « renvoyé par rejoindre ». Résultat : un tiers obtient le secret, et l'appareil d'origine ne perd jamais sa place, contrairement à FR-8.
- *Story WS* : elle valide le jeton par une lecture de `SessionStore` hors verrou, puis enregistre la connexion dans un registre de l'adaptateur. Si une reprise change le jeton entre les deux, l'appareil d'origine reste branché et reçoit les instantanés filtrés du participant repris, y compris sa carte cachée.

**Deux propriétaires d'une même entité.** Le registre des connexions (quelle connexion représente quel participant) peut vivre dans `adapter.in.ws` (qui reçoit les ouvertures) ou dans l'implémentation de `SessionBroadcaster` (qui envoie). Les deux lectures respectent AD-1 et AD-9, et deux agents en construiront deux.

**Correctif (nouvel AD-15 — Connexions et présence).**
- Le domaine tient, par participant, un **compteur de connexions actives**. `connected = (compteur > 0) et (dernier message il y a moins de 15 s)`. L'ouverture et la fermeture d'une connexion sont des cas d'usage exécutés **sous le verrou de session** (AD-3).
- Plusieurs connexions avec le même jeton sont **normales**. Aucune n'en ferme une autre.
- La reprise (FR-8) crée un **nouveau jeton**, invalide l'ancien et ferme toutes les connexions de l'ancien jeton en 4401, sous le même verrou. Le jeton d'un participant n'est jamais renvoyé à un autre appel.
- L'unicité du pseudo est une règle du domaine. Elle est évaluée sous le verrou, avec la définition de `connected` ci-dessus, par « rejoindre » comme par toute autre voie.
- Un seul registre des connexions : l'implémentation de `SessionBroadcaster`. L'adaptateur entrant n'y accède que par ce port.

## T5 — Diffusion sous verrou, balayeur et `SessionStore` [Élevée]

**Unité A (back, `SessionBroadcaster` en mémoire).** AD-3 : « diffusion toujours sous ce même verrou ». L'agent appelle `WebSocketSession.sendMessage()` en boucle, de façon synchrone, sous le verrou.

**Unité B (back, balayeur).** Un seul fil planifié parcourt toutes les sessions chaque seconde et prend chaque verrou tour à tour (AD-8, AD-3).

**Résultat assemblé.**
- Un téléphone en réseau lent bloque l'envoi TCP, donc garde le verrou de sa session, donc bloque le balayeur pour **toutes** les sessions. La détection des 15 s dérive, au-delà de FR-16.
- Un message `error` envoyé à une seule connexion hors verrou, en même temps qu'un instantané sous verrou, déclenche `IllegalStateException` (Spring interdit les envois concurrents sur une même `WebSocketSession`).

**Variante `SessionStore`.**
- *Story « adaptateur mémoire »* : `find()` renvoie l'objet vivant, et le cas d'usage le modifie sans `save()`.
- *Story « cas d'usage voter »*, écrite pour la future persistance : elle appelle `save()` après la modification.
- Les deux fonctionnent en V1. Le jour où Postgres arrive, toutes les stories écrites sans `save()` perdent leurs écritures (NFR-9 violé).
- Où vit le verrou (dans l'objet `Session`, ou dans une table de verrous d'`application`) n'est pas dit non plus. Le balayeur qui supprime une session à 24 h peut aussi le faire pendant qu'un `vote` attend ce verrou : le vote s'applique ensuite à une session supprimée, puis diffuse.

**Correctif.**
- **AD-3 resserré.** « Diffuser » signifie **mettre en file** un message par connexion. L'envoi réel est asynchrone et borné (par exemple `ConcurrentWebSocketSessionDecorator`, 5 s d'envoi, 64 Ko de tampon ; au-delà, fermeture 1011). Aucune écriture réseau ne se fait sous un verrou de session. Tout envoi, `error` compris, passe par cette file.
- **AD-9 resserré.**
  - `SessionStore` expose `load(id)`, `save(session)`, `delete(id)`.
  - Toute modification suit « verrouiller → charger → modifier → `save` → incrémenter → mettre en file → déverrouiller », même en mémoire.
  - Les verrous vivent dans `application` (une table par `sessionId`) et sont retirés à la suppression.
  - Après avoir pris le verrou, un cas d'usage recharge la session et abandonne si elle a disparu.
- **AD-8 resserré.**
  - Le balayeur ne fait jamais d'entrée-sortie réseau lui-même.
  - Supprimer une session (24 h) ferme toutes ses connexions en **4404**.
  - Retirer un participant (5 min) ferme ses éventuelles connexions en **4401**.

## T6 — Chemins REST, création et vérification d'un lien [Élevée]

**Unité A (back, story « créer une session »).** FR-1 place le créateur directement dans la session. L'agent écrit `POST /api/sessions {pseudo, role}`, qui renvoie `{ sessionId, participantId, participantToken }`.

**Unité B (front, écran Accueil).** Le diagramme de séquence ne montre que `POST /api/sessions/{id}/participants`. L'agent enchaîne `POST /api/sessions` (sans corps, qui renvoie `sessionId`), puis `POST /api/sessions/{id}/participants`.

**Pourquoi les deux sont conformes.** AD-2 dit « créer » et « rejoindre », sans chemin ni forme de corps.

**Trou lié : FR-3.** Ouvrir un lien inconnu doit afficher « Session introuvable » **à l'ouverture**, avant toute saisie (EXPERIENCE : écran dédié). AD-2 dit que REST « ne sert qu'à » créer, rejoindre et vérifier la santé. Une story front qui ajoute `GET /api/sessions/{id}` viole AD-2. Une story qui s'en passe n'affiche l'erreur qu'après la saisie du pseudo, ce qui viole FR-3. Les deux lectures sont défendables, et elles divergent.

**Correctif (AD-2 resserré, liste fermée).**
- `GET /api/health`.
- `POST /api/sessions {pseudo, role}` → `201 { sessionId, participantId, participantToken }` (le créateur est inscrit dans le même appel).
- `GET /api/sessions/{sessionId}` → `204` ou `404 SESSION_NOT_FOUND` (existence seulement, aucune donnée).
- `POST /api/sessions/{sessionId}/participants {pseudo, role}` → `201 { participantId, participantToken }`, ou `409 PSEUDO_TAKEN`, `404 SESSION_NOT_FOUND`, `400 INVALID_PSEUDO`.
- Aucun autre endpoint REST.

## T7 — Blocage de 1 s : distant ou pas ? [Élevée]

**Unité A (front, « barre d'action »).** Un changement est distant s'il arrive plus de 300 ms après ma dernière intention.

**Unité B (front, « `SessionService` »).** Un changement est distant si `round.status` ou `roundId` diffère de l'instantané précédent. Pour lui, les votes des autres ne bloquent rien.

**Pourquoi les deux sont conformes.** AD-8 cite le délai sans le définir, et l'instantané (AD-5) ne dit pas qui a causé le changement. Les deux heuristiques échouent sur FR-17 : si je clique « Révéler » pendant que B efface, mon instantané de retour peut être causé par l'autre.
- Avec A, je ne bloque pas, et mon clic suivant tombe sur « Nouveau tour ».
- Avec B, **mon propre** onglet voisin (même participant) déclenche ou non le blocage, selon qu'on compare des participants ou des onglets.

**Correctif (AD-5 et AD-10 resserrés).**
- L'instantané porte `lastChange: { byParticipantId, action } | null`, où `action` vaut `reveal | hide | clear | vote | changeRole | join | leave | presence`.
- Côté front : blocage de 1 s de la **barre d'action** seulement si `action ∈ {reveal, hide, clear}` et `byParticipantId ≠ self.participantId`. Un autre onglet du même participant n'est pas distant.
- La règle est implémentée dans `SessionService` uniquement, et exposée par un signal `actionsLocked`.

## T8 — `version` d'une session à l'autre [Moyenne]

**Unité A (front, `SessionService` en `providedIn: 'root'`).** AD-5 : « ignorer tout instantané dont `version` est inférieure à celle détenue ». Le service garde `lastVersion = 57`.

**Unité B (front, écran « Session introuvable »).** Le bouton « Créer une session » renvoie à l'Accueil sans recharger la page (navigation Angular), puis ouvre une nouvelle session.

**Résultat assemblé.** La nouvelle session démarre à `version = 1`, inférieure à 57 : tous ses instantanés sont ignorés, et la table reste vide. Même effet pour un onglet qui passe d'un lien à un autre.

**Correctif (AD-5 resserré).** `version` est comparée **par `sessionId`**. `SessionService` remet son état et `lastVersion` à zéro à chaque changement de `sessionId`, et à chaque 4404. `version` commence à 1 à la création et ne décroît jamais pour une même session tant que le serveur vit.

## T9 — `roundId` [Moyenne]

**Unité A (domaine).** `roundId` est un entier incrémenté à chaque changement de tour. Pour l'agent, `hide` rouvre le tour, donc crée un nouveau tour.

**Unité B (front).** Il type `roundId: string` (identifiant, comme `sessionId`), et le compare par égalité stricte pour AD-4.

**Résultat assemblé.** Le JSON porte `3`, le front envoie `"3"`, et Jackson accepte ou refuse selon sa configuration. Si `hide` change `roundId`, un `clear` parti juste avant un `hide` est ignoré, alors que FR-15 dit qu'effacer s'applique au tour révélé comme au tour caché.

**Variante.** Un `vote` parti sur le tour R1 arrive après un `clear` : il s'applique au tour R2, que le votant n'a pas encore vu.

**Correctif (AD-4 resserré).**
- `roundId` est une chaîne opaque (UUID), générée par le domaine **uniquement** à la création de la session et par un `clear` effectif. `reveal` et `hide` ne la changent pas.
- `vote` porte aussi le `roundId` vu ; il est ignoré si ce n'est plus le tour en cours.
- `reveal` et `hide` restent sans `roundId` : la dernière action reçue s'applique (FR-17).

## T10 — Santé du serveur pendant le réveil [Moyenne]

**Unité A (back).** `/api/health` est l'Actuator de Spring, remappé : il renvoie `200 {"status":"UP"}`, mais aussi `503 {"status":"DOWN"}` tant qu'un indicateur n'est pas prêt.

**Unité B (front, écran Réveil).** « Réveillé » = `response.ok` et corps vide (l'agent imaginait un `204`). Le front appelle `fetch` sans délai par requête.

**Résultat assemblé.** Une requête bloquée par le proxy Render pendant le réveil ne se termine jamais, et le délai de 3 min (NFR-2) n'est jamais évalué. Si le front lit le corps en JSON, un `204` le fait échouer. De plus, `/api/health` est appelé depuis une autre origine : si A n'applique CORS qu'aux routes `/api/sessions/**`, le navigateur bloque la réponse et le réveil ne se termine jamais.

**Correctif (AD-12 resserré).**
- `GET /api/health` → `200 {"status":"UP"}` dès que le contexte Spring est prêt (même sémantique que la sonde *readiness* d'OpenShift), soumis à `ALLOWED_ORIGINS`, décrit dans `openapi.yaml`.
- Côté front : tout `2xx` = réveillé ; 10 s de délai par requête ; nouvelle tentative toutes les 2 s ; indisponible 3 min après la **première** tentative. Le réveil précède tout autre appel.

## T11 — `config.json` et URL WebSocket [Moyenne]

**Unité A (front).** `{"apiUrl": "https://pp-api.onrender.com"}`. Le front ajoute `/api` et calcule `wss://…/ws`.

**Unité B (déploiement, `render.yaml`).** Il produit `{"apiBaseUrl": "https://pp-api.onrender.com/api", "wsUrl": "wss://pp-api.onrender.com/ws"}`, parce qu'OpenShift pourrait exposer le WebSocket sur une autre route.

**Correctif (AD-11 resserré).** Schéma fixe de `/config.json` : `{ "apiBaseUrl": "<origine sans /api>", "wsBaseUrl": "<wss://…>" }`, validé au démarrage, avec un exemple dans `contract/`. Le chemin (`/api/...`, `/ws/sessions/{id}`) est ajouté par le front. `config.json` est écrit à la publication (commande de build Render, ou `ConfigMap` monté sur OpenShift) et n'est jamais mis en cache (`Cache-Control: no-store`).

## T12 — Erreurs WebSocket [Moyenne]

**Unité A (back).** `vote` pendant un tour révélé (FR-11) ou par un observateur → `{type:"error", code:"VOTE_LOCKED"}`. JSON mal formé → fermeture 1003.

**Unité B (front).** AD-4 : « une intention déjà satisfaite ne renvoie pas d'erreur ». L'agent en déduit qu'aucune erreur n'arrive jamais sur le WebSocket, et n'affiche rien pour `error`. Pour une fermeture 1003, il relance la connexion en boucle.

**Correctif (Conventions).** Catalogue fermé dans `asyncapi.yaml`.
- Intention **invalide** (vote d'un observateur, vote pendant un tour révélé, carte inconnue) : ignorée, sans erreur ni hausse de `version`. Le front ne peut de toute façon pas la provoquer.
- Message mal formé ou type inconnu : `error { code: "BAD_MESSAGE" }`, sans fermeture.
- `error` n'est pas affiché à l'utilisateur. Il est tracé dans la console.

## T13 — Signal de vie d'un onglet en arrière-plan [Moyenne]

**Unité A (front).** `setInterval(5000)` dans `SessionService` (AD-8, AD-10).

**Unité B (back).** Balayeur à 15 s (AD-8).

**Résultat assemblé.** Chrome et Safari limitent les minuteurs des onglets masqués (une exécution par minute après quelques minutes en veille intensive, ou suspension sur iOS). Un participant qui garde l'onglet en arrière-plan pendant la discussion passe « déconnecté », alors que son WebSocket est ouvert. Il sort du décompte des connectés, son pseudo peut être repris (FR-8), et Render peut s'endormir si tous les onglets sont masqués (NFR-1b).

**Correctif (AD-8 resserré).** Le signal de vie est émis depuis un Web Worker dédié, moins limité, et renvoyé immédiatement au retour de visibilité (`visibilitychange`). Le cas iOS (suspension) est accepté et documenté : l'appareil apparaît déconnecté, puis se reconnecte seul (FR-7).

## T14 — `Clock` et 24 h [Faible]

**Unité A (application).** Port maison `interface Clock { Instant now(); }`.

**Unité B (config ou tests).** Injecte un `java.time.Clock` en bean. Une autre story calcule l'expiration par `LocalDateTime.now(clock).plusDays(1)` dans le fuseau du serveur (UTC sur Render, `Europe/Paris` sur OpenShift) : 23 h ou 25 h aux changements d'heure.

**Correctif (AD-8 resserré).** Le port est `java.time.Clock` (autorisé dans le domaine, car c'est du JDK), fourni en UTC. Les instants sont des `Instant`. L'expiration vaut `createdAt + Duration.ofHours(24)`. Aucun `LocalDateTime` ni `ZoneId` hors du formatage.

---

## Paires examinées sans trou

- **Deux `clear` simultanés** : couverts par AD-4 (`roundId`) et AD-3 (sérialisation).
- **Fuite du vote caché par la synthèse** : AD-5 interdit toute valeur pendant un tour caché ; la synthèse n'existe qu'après la révélation.
- **Calcul de la moyenne en double** : AD-10 et les Conventions l'attribuent au domaine seul.
