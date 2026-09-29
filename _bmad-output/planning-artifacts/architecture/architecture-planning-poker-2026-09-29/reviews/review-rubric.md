---
reviewer: rubric-walker
target: ARCHITECTURE-SPINE.md
date: 2026-09-29
verdict: 'À corriger avant le découpage en epics : aucun défaut critique, 4 élevés, 9 moyens, 8 faibles'
---

# Revue par grille : spine d'architecture du Planning Poker

## Verdict

La spine est **solide et bien centrée** sur le bon problème : état détenu par le serveur, mutation sérialisée par session, instantanés filtrés, intentions idempotentes, contrat unique. Les décisions tranchées par Eric (hexagonal, REST + WebSocket, Render Free, Maven, monodépôt, deux origines, codes 4401/4404, `roundId` sur `clear`, ArchUnit, test de charge précoce) sont respectées. Elles ne sont **pas** remises en cause ici.

Elle laisse cependant ouverts quelques **points de divergence réels entre un agent Java et un agent Angular** : la poignée de main WebSocket, la déconnexion explicite, le protocole (STOMP ou non), l'emplacement de la diffusion. Elle a aussi des trous dans l'**enveloppe opérationnelle** : environnement local, déclenchement des déploiements, mécanisme de `config.json`. Aucun de ces points n'est critique, mais les quatre points élevés doivent être corrigés avant d'écrire les stories.

## Synthèse des constats

| # | Sévérité | Emplacement | Constat |
| --- | --- | --- | --- |
| R-1 | **Élevée** | AD-2, AD-7, diagramme de séquence | Poignée de main WebSocket non fixée (URL, transport du jeton) ; le jeton risque de finir dans une URL journalisée |
| R-2 | **Élevée** | AD-8 | Déconnexion explicite (FR-16, < 1 s) et présence sur plusieurs onglets non traitées |
| R-3 | **Élevée** | AD-2, Stack | Le choix « WebSocket brut, JSON maison, sans STOMP ni SockJS » (memlog) n'est pas dans la spine, alors que le compagnon recommande STOMP |
| R-4 | **Élevée** | Enveloppe opérationnelle | Processus de déploiement absent : auto-déploiement sur push (memlog) contre « ne pas redéployer pendant un atelier » (addendum) ; décalage de version front/back |
| R-5 | Moyenne | Paradigm, AD-5 | `SessionBroadcaster` placé dans `adapter.out.memory`, alors que le registre des connexions vit côté WebSocket |
| R-6 | Moyenne | AD-6, Deferred | Contrat : propriété et première story non fixées ; génération de types laissée aux stories ; outillage OpenAPI 3.2 / AsyncAPI 3.1 non vérifié |
| R-7 | Moyenne | AD-5, AD-6 | Contenu minimal de l'instantané non amorcé (moi, ordre d'arrivée, éligibilité au vote, synthèse) |
| R-8 | Moyenne | AD-4, Conventions › Erreurs | Intentions interdites (vote après révélation, vote d'observateur…) : ni ignorées ni codées ; aucun code d'erreur WebSocket listé |
| R-9 | Moyenne | AD-2, FR-3, EXPERIENCE | Écran « Session introuvable » à l'ouverture du lien impossible sans endpoint de lecture, que AD-2 interdit |
| R-10 | Moyenne | AD-11, Structural Seed, AD-12 | Mécanisme de production de `config.json` par environnement non défini ; image front absente du seed |
| R-11 | Moyenne | Enveloppe opérationnelle | Environnement de développement local non décrit |
| R-12 | Moyenne | Conventions › Tests, AD-8 | Test de charge sans cible ni seuil ; démarrage à froid de la JVM sur 0,1 CPU non mesuré contre NFR-2 |
| R-13 | Moyenne | AD-3, AD-10 | Diffusion sous verrou sans garde-fou d'envoi ; le front ne sait pas distinguer un changement « venu d'un autre » (blocage de 1 s) |
| R-14 | Faible | AD-8 | La liste « seuls les délais d'interface » est exhaustive et oublie le délai de réveil de 3 min |
| R-15 | Faible | AD-7, AD-8 | Reprise (FR-8) : rotation du jeton et fermeture des anciennes connexions non explicites ; état `connected` à la création via REST ; fermeture 4404 à l'expiration |
| R-16 | Faible | Conventions › Pseudo, Nombres | Longueur du pseudo (unités UTF-16 contre points de code), casse dépendante de la locale, mode d'arrondi |
| R-17 | Faible | Stack | Jackson 3 (`tools.jackson`) sous Spring Boot 4 non signalé ; Node à préciser (≥ 24.15) |
| R-18 | Faible | AD-9, Deferred | Stratégie `Recreate` à fixer pour OpenShift, sinon deux pods coexistent pendant un déploiement |
| R-19 | Faible | Enveloppe opérationnelle | Secrets, sauvegarde et supervision non déclarés explicitement (même si la réponse est « aucun » ou « N/A ») |
| R-20 | Faible | Capability Map | NFR-3, NFR-5, NFR-7, NFR-8 et NFR-10 absents de la carte |
| R-21 | Faible | Structural Seed | `deploy/render.yaml` : l'emplacement hors racine est à vérifier chez Render |

---

## Constats détaillés

### R-1 — Poignée de main WebSocket non fixée [Élevée]

**Emplacement :** AD-2, AD-7, diagramme de séquence (« ouverture avec participantToken »).

**Problème :** la spine dit que le jeton est « présenté à l'ouverture du WebSocket », sans dire **comment**. L'API `WebSocket` du navigateur ne permet pas d'ajouter d'en-tête. Il reste trois options incompatibles entre elles :
- un paramètre d'URL (`/ws?token=…`) : c'est ce que choisira spontanément un agent. Le jeton finit alors dans les journaux d'accès de Render et du futur routeur OpenShift, ce qui **contredit AD-7** (« jamais dans un journal ») ;
- le sous-protocole (`Sec-WebSocket-Protocol`) ;
- un premier message applicatif (`hello` / `auth`).

L'URL elle-même n'est pas fixée non plus : `/ws`, `/ws/{sessionId}`, ou `sessionId` dans le message ? Or le code 4404 (« session inexistante ») suppose que le serveur connaisse la session demandée **indépendamment** du jeton. Un agent Java et un agent Angular ont ici toutes les chances de diverger.

**Correction :** ajouter à AD-2 ou AD-7 une règle du type :
> Le client ouvre `wss://<api>/ws/sessions/{sessionId}` sans jeton dans l'URL. Son premier message est `{ "type": "hello", "participantToken": "…" }`. Tant que ce message n'est pas reçu et valide (délai de 5 s), le serveur n'envoie rien. Jeton inconnu : fermeture 4401. Session inconnue : fermeture 4404. Le serveur répond par un premier `sessionState`.

Ajouter `hello` à la liste des messages client vers serveur (Conventions › Messages WebSocket).

### R-2 — Déconnexion explicite et présence multi-onglets [Élevée]

**Emplacement :** AD-8.

**Problème :**
- FR-16 exige qu'une déconnexion **explicite** (onglet fermé) soit diffusée **en moins d'une seconde**. AD-8 ne traite que la détection par délai (15 s). Un agent qui s'en tient à la lettre d'AD-8 laissera un participant « connecté » 15 s après la fermeture de son onglet. Or c'est justement le parcours UJ-2 : Sofia ferme l'onglet du téléphone et doit pouvoir reprendre « Sofia » sur son PC sans attendre.
- FR-7 fait de plusieurs onglets **un seul participant**, donc plusieurs connexions par participant. La spine ne dit pas que la présence se calcule **sur l'ensemble des connexions** du participant. Fermer un onglet ne doit pas déconnecter un participant qui a encore un autre onglet ouvert.

**Correction :** compléter AD-8 :
> Un participant est `connected=true` tant qu'au moins une de ses connexions est ouverte et a émis un message depuis moins de 15 s. À la fermeture de sa **dernière** connexion (fermeture propre ou erreur de transport), il passe à `connected=false` **immédiatement**, via AD-3. Le délai de 15 s ne couvre que les coupures silencieuses.

### R-3 — Protocole WebSocket : « pas de STOMP » absent de la spine [Élevée]

**Emplacement :** AD-2, Stack.

**Problème :** le memlog note une décision tranchée : « WebSocket simple avec messages JSON maison, pas de STOMP [ADOPTED] ». La spine ne la reprend nulle part. L'enveloppe `{ "type": … }` la suggère seulement. Or le compagnon `research-stack-hosting.md`, cité dans `companions`, conclut que « STOMP avec le broker simple en mémoire colle au modèle ». Un agent qui lit le compagnon peut partir sur `@EnableWebSocketMessageBroker` côté Java et `@stomp/stompjs` côté Angular, ou pire, un seul des deux côtés. C'est la divergence front/back la plus coûteuse possible.

**Correction :** ajouter à AD-2 :
> WebSocket brut (`WebSocketHandler` de Spring, `WebSocket` natif ou `rxjs/webSocket` côté navigateur), trames texte JSON. Ni STOMP, ni SockJS, ni sous-protocole applicatif.

Dans le compagnon, marquer le verdict STOMP comme « non retenu (voir AD-2) ».

### R-4 — Processus de déploiement et décalage de versions [Élevée]

**Emplacement :** enveloppe opérationnelle (absente) ; Structural Seed (`deploy/render.yaml`) ; Deferred.

**Problème :**
- Le memlog adopte le « déploiement auto Render sur push », mais la spine ne dit rien du déclenchement. L'addendum pose pourtant : « ne pas redéployer pendant un atelier, puisqu'un redéploiement efface les sessions ». Avec l'auto-déploiement sur `main`, **n'importe quel merge d'un agent** pendant l'affinage du jeudi efface la séance. SM-2 compte cet incident, et NFR-1 ne le couvre pas, puisque c'est un redémarrage volontaire.
- Le front (site statique) et le webservice se déploient **indépendamment**. Si une modification du contrat est incompatible, il existe une fenêtre où l'un tourne en version n et l'autre en version n+1. Rien ne dit dans quel ordre déployer, ni si le contrat doit rester rétrocompatible.

**Correction :** ajouter une section « Exploitation » ou un AD-13 :
> - Déploiement : `autoDeploy: false` dans `render.yaml` ; le déploiement se lance à la main (bouton ou deploy hook), jamais pendant un créneau d'atelier. Autre option : auto-déploiement depuis une branche `release` uniquement.
> - Ordre : le webservice d'abord, puis le front. Une modification du contrat doit rester rétrocompatible pendant au moins un déploiement (champ ajouté optionnel, jamais de retrait ni de renommage en un seul temps).
> - CI GitHub Actions : les tests doivent passer avant tout déploiement.

### R-5 — Emplacement de `SessionBroadcaster` [Moyenne]

**Emplacement :** Design Paradigm (tableau des couches), AD-5.

**Problème :** le tableau place l'implémentation de `SessionBroadcaster` dans `adapter.out.memory`. Or diffuser un instantané, c'est écrire sur des `WebSocketSession` Spring, qui naissent dans `adapter.in.ws`. Le registre des connexions (session → participant → connexions) doit vivre quelque part. Un agent le mettra dans `adapter.in.ws`, un autre dans `adapter.out.memory`, et l'un des deux fera échouer ArchUnit ou dupliquera le registre. Le registre sert aussi à la présence (R-2) et aux fermetures 4401/4404.

**Correction :** créer `adapter.out.ws`, ou dire explicitement que `adapter.in.ws` implémente aussi `SessionBroadcaster`. Fixer que le **registre des connexions** vit dans cet adaptateur, pas dans `SessionStore`. Écrire la règle ArchUnit correspondante (par exemple : `adapter.in.*` et `adapter.out.*` ne dépendent pas l'un de l'autre, sauf exception nommée).

### R-6 — Contrat : propriété, génération de types et outillage [Moyenne]

**Emplacement :** AD-6, Deferred (« génération éventuelle de types à partir du contrat… laissé aux stories »), Stack.

**Problème :**
- La spine ne dit pas **quelle story crée le contrat** et avant quoi. Si plusieurs stories Java et Angular démarrent en parallèle, chacune invente sa partie de `asyncapi.yaml`.
- Le choix entre **génération de types** et **types écrits à la main** touche toutes les stories des deux côtés. Le laisser aux stories est précisément un Deferred qui permet à deux unités de diverger. Par exemple, une story génère des `record` Java depuis OpenAPI, et une autre écrit des DTO à la main dans `adapter.in.ws`.
- « Les tests des deux côtés valident des exemples contre ces schémas » : l'outillage n'est pas vérifié. En Java, il n'existe pas de validateur AsyncAPI mûr. Pour OpenAPI 3.2, le support des analyseurs et validateurs (swagger-parser, openapi-generator, validateurs de requêtes) est encore partiel en 2026. La version de la spécification est à jour, mais **l'outillage ne l'est pas forcément**.

**Correction :**
- Ajouter à AD-6 : « Le contrat complet de la V1 (tous les messages connus à ce jour) est livré par la **première story**, avant toute story qui en consomme. »
- Trancher : **pas de génération de code** en V1. Les types TypeScript vivent dans `frontend/src/app/contract/`, et les DTO Java sont des `record` dans l'adaptateur concerné. Tous se conforment au contrat par des tests sur les exemples. Autre option, trancher dans l'autre sens, mais trancher.
- Fixer la mécanique : les schémas de charge utile sont des fichiers JSON Schema (`contract/schemas/*.json`), référencés par `$ref` depuis `openapi.yaml` et `asyncapi.yaml`. Ils sont validés par `networknt/json-schema-validator` en Java et par `ajv` en TypeScript, sur les mêmes fichiers `contract/examples/*.json`. Vérifier que l'outil retenu lit OpenAPI 3.2, et sinon, descendre en 3.1.1.

### R-7 — Contenu minimal de l'instantané non amorcé [Moyenne]

**Emplacement :** AD-5, AD-6.

**Problème :** l'instantané est l'objet le plus partagé du système, et presque toutes les stories front le lisent. La spine fixe `version`, `roundId`, `hasVoted` et « la synthèse », mais pas plusieurs champs dont l'UX a besoin et que le front n'a **pas le droit de calculer** (AD-10) :
- l'identité du destinataire (« (toi) », ma place en premier) ;
- l'**ordre d'arrivée** (tri des places, EXPERIENCE › Table des participants) ;
- l'**éligibilité au vote pour ce tour** (« votera au prochain tour », FR-5 et arrivée pendant un tour révélé). C'est une règle métier, donc elle relève du domaine ;
- la forme de la synthèse : valeurs à égalité pour la plus votée, types (chaîne de carte ou nombre).

**Correction :** amorcer dans AD-5 la liste des champs obligatoires, le détail restant au contrat :
> `version`, `sessionId`, `you` (`participantId`), `round` (`roundId`, `status`), `participants[]` (`participantId`, `pseudo`, `role`, `connected`, `joinedSeq`, `hasVoted`, `canVoteThisRound`, `card` uniquement si visible pour ce destinataire), `summary` (`average`, `consensus`, `mostVoted[]` avec `card` et `count`, `min`, `max`, tous absents s'il n'y a aucun vote numérique), `expiresAt`.

### R-8 — Intentions interdites et codes d'erreur WebSocket [Moyenne]

**Emplacement :** AD-4, Conventions › Erreurs.

**Problème :** AD-4 traite l'intention **déjà satisfaite**, qui ne fait rien, sans erreur. Elle ne traite pas l'intention **interdite dans l'état courant** : `vote` sur un tour révélé (FR-11), `vote` d'un observateur, `vote` d'un votant arrivé pendant la révélation, carte hors jeu, `changeRole` vers le rôle courant. Aucun code d'erreur WebSocket n'est listé. Côté Java, un agent renverra `error`, alors que côté Angular, un autre n'attendra rien, ou l'inverse.

**Correction :** ajouter à AD-4 :
> Une intention **interdite dans l'état courant** est ignorée **sans erreur**, sans incrémenter `version`, et le serveur renvoie l'instantané courant à l'émetteur, ce qui resynchronise le client. `error` est réservé aux messages **malformés** ou non conformes au contrat.

Lister les codes : `MALFORMED_MESSAGE`, `UNKNOWN_TYPE`, `INVALID_CARD`.

### R-9 — « Session introuvable » dès l'ouverture du lien [Moyenne]

**Emplacement :** AD-2, FR-3, EXPERIENCE › Information Architecture.

**Problème :** l'UX indique qu'on arrive sur « Session introuvable » **par un lien inconnu ou expiré**, avant toute saisie. AD-2 limite REST à créer, rejoindre et santé, si bien que le front ne peut pas savoir qu'une session n'existe pas avant de soumettre le formulaire Rejoindre. Un agent ajoutera `GET /api/sessions/{id}`, en violation d'AD-2. Un autre affichera Rejoindre, puis l'erreur. Les deux comportements divergent.

**Correction :** choisir, et l'écrire dans AD-2 :
- soit ajouter à la liste blanche `HEAD` ou `GET /api/sessions/{id}` (existence seule : 204 ou 404, aucune donnée de session) ;
- soit préciser que « Session introuvable » s'affiche **après** l'échec de rejoindre (`SESSION_NOT_FOUND`), et aligner EXPERIENCE.

La première option respecte mieux l'UX.

### R-10 — `config.json` par environnement : mécanisme absent ; image front [Moyenne]

**Emplacement :** AD-11, AD-12, Structural Seed (`frontend/public/config.json`).

**Problème :**
- AD-11 dit que `config.json` « varie d'un environnement à l'autre, alors que le build reste le même ». Mais le seed le place dans `public/`, donc versionné avec **une seule valeur**. Sur Render, le site statique est construit à partir du dépôt, et rien ne dit comment l'URL de l'API y est injectée. Sur OpenShift, rien ne dit comment le conteneur front la produit. L'agent de la story de déploiement et celui de la story front vont inventer deux mécanismes différents.
- AD-12 impose que « chaque image » soit compatible OpenShift dès la V1, mais le seed n'a **pas** de `frontend/Dockerfile` : en V1, le front est un site statique Render, sans image.

**Correction :**
- Fixer dans AD-11 : `public/config.json` contient la valeur de développement local (`http://localhost:8080`). Sur Render, la commande de build du site statique réécrit `dist/…/browser/config.json` à partir de la variable `API_URL`. Dans l'image front, un script d'entrée génère `config.json` depuis `API_URL` au démarrage. Il faut aussi que `config.json` ne soit jamais mis en cache (`Cache-Control: no-store`).
- Soit ajouter `frontend/Dockerfile` au seed (nginx non privilégié sur 8080), soit préciser dans AD-12 que l'image front est différée au passage OpenShift.

### R-11 — Environnement de développement local non décrit [Moyenne]

**Emplacement :** enveloppe opérationnelle (absente).

**Problème :** rien ne dit comment un agent lance l'application en local. Il faut savoir quelle commande utiliser, sur quels ports, avec quelle valeur de `ALLOWED_ORIGINS` (`http://localhost:4200`), avec quel `config.json`, et s'il y a un proxy `ng serve` ou non. Chaque agent de build va improviser. Certains ajouteront un proxy Angular (même origine), d'autres le CORS, et les tests e2e divergeront.

**Correction :** ajouter une ligne aux Conventions ou une section Exploitation :
> Local : `./mvnw spring-boot:run` (port 8080, `ALLOWED_ORIGINS=http://localhost:4200` par défaut dans le profil `local`) et `ng serve` (port 4200, `config.json` → `http://localhost:8080`). Pas de proxy `ng serve` : on reproduit en local les deux origines de la production (AD-11). Optionnel : `docker compose` qui lance les deux images.

### R-12 — Test de charge sans seuil ; démarrage à froid non mesuré [Moyenne]

**Emplacement :** Conventions › Tests, AD-8, Deferred (hébergeur de repli).

**Problème :**
- Le test de charge est le **critère de bascule d'hébergeur**, mais il n'a ni environnement cible, ni seuil de réussite. Exécuté en local, il ne prouve rien sur 512 Mo et 0,1 CPU.
- NFR-2 laisse 2 minutes pour réveiller le service. Render annonce environ 1 min de réveil, auquel s'ajoute le démarrage de Spring Boot 4 sur **0,1 CPU**, qui peut lui aussi approcher ou dépasser une minute. Personne n'est chargé de le mesurer.

**Correction :** préciser dans les Conventions :
> Test de charge (outil au choix de la story : k6 ou Gatling), exécuté **contre l'instance Render**. 5 sessions, 13 participants chacune, 65 connexions plus 20 % de marge, heartbeats actifs, 10 minutes. Critères : diffusion p95 < 1 s (FR-16), aucune déconnexion parasite, mémoire < 450 Mo. La même story mesure le démarrage à froid (< 2 min, du premier `GET /api/health` à la réponse 200). En cas d'échec : réglages JVM (`-XX:MaxRAMPercentage`, cache AOT/CDS de Java 25), puis bascule d'hébergeur.

### R-13 — Diffusion sous verrou ; « changement venu d'un autre » [Moyenne]

**Emplacement :** AD-3, AD-10 ; EXPERIENCE › Barre d'action (blocage de 1 s).

**Problème :**
- AD-3 diffuse **sous le verrou** de la session. Avec `WebSocketSession.sendMessage` bloquant et non thread-safe, un téléphone lent ou à moitié déconnecté bloque toute la session. Et deux envois concurrents vers une même connexion, par exemple un `error` hors verrou et un `sessionState`, lèvent une exception.
- Le blocage de 1 s ne s'applique qu'« après un changement fait par un **autre** participant ». L'instantané ne dit pas qui a agi, et le PRD exclut l'affichage de l'auteur. Le front n'a donc pas de règle pour distinguer ses propres changements de ceux des autres.

**Correction :**
- AD-3 : chaque connexion est enveloppée dans `ConcurrentWebSocketSessionDecorator` (par exemple, limite d'envoi de 5 s et tampon de 512 Kio). Au-delà, la connexion est fermée, ce qui déclenche R-2. Aucune écriture directe sur une `WebSocketSession`.
- AD-10 : « Le blocage de 1 s s'applique à tout changement de `round.status` ou de `roundId` que `SessionService` n'a pas lui-même demandé par une intention encore en attente. » Autre option : ajouter à l'instantané un champ `causedByYou` destiné au seul destinataire.

### R-14 — Liste exhaustive des délais client incomplète [Faible]

**Emplacement :** AD-8, dernier point.

**Problème :** « Seuls les délais d'interface restent côté client : 1 s et 2 s ». Le mot « seuls » exclut le délai de **3 min** du réveil (NFR-2), les 2 s de « Lien copié », les 5 s de l'annonce `aria-live` et le rythme de reconnexion. Un agent zélé pourrait penser qu'ils sont interdits.

**Correction :** remplacer par « Les délais de présentation (blocage de 1 s, bandeau à 2 s, réveil jusqu'à 3 min, retours visuels, cadence des annonces, stratégie de reconnexion) restent côté client. »

### R-15 — Reprise, création et expiration : cycle de vie des connexions [Faible]

**Emplacement :** AD-7, AD-8, Conventions › Codes de fermeture.

**Problème :**
- Reprise (FR-8) : la spine ne dit pas que « rejoindre » avec le pseudo d'un participant déconnecté **conserve le `participantId`**, émet un **nouveau jeton**, invalide l'ancien et ferme en 4401 les connexions qui lui restent (connexion à moitié ouverte).
- Entre la réponse de « rejoindre » et l'ouverture du WebSocket, le participant est-il `connected` ? Si non, un tiers peut le reprendre dans cette fenêtre.
- À l'expiration (24 h) ou au retrait (5 min), rien ne dit qu'on ferme les connexions encore ouvertes (4404 ou 4401). Le délai de 5 min court-il depuis le dernier message ou depuis le passage à `connected=false` ?

**Correction :** ajouter à AD-7 et AD-8 : reprise = même `participantId`, nouveau jeton, ancien jeton révoqué, connexions fermées en 4401. Un participant créé par REST est `connected=true`, avec `lastSeen=now`. Suppression de la session : fermeture 4404 de toutes ses connexions. Retrait au bout de 5 min après le passage à `connected=false`.

### R-16 — Pseudo et arrondi : précisions de portabilité Java/TS [Faible]

**Emplacement :** Conventions › Pseudo, Nombres et dates.

**Problème :** `maxlength="20"` côté Angular compte des unités UTF-16, alors que `String.length()` en Java compte aussi des unités UTF-16, mais un agent pourrait utiliser `codePointCount`. Un emoji compte alors 2 d'un côté et 1 de l'autre. `toLowerCase()` sans locale se comporte mal en turc. « Arrondi au dixième » ne précise pas le mode d'arrondi : 5,25 donne 5,2 ou 5,3 selon HALF_EVEN, HALF_UP ou `Math.round` sur un `double`.

**Correction :** « Pseudo : normalisé NFC, puis retrait des espaces de début et de fin. Longueur ≤ 20 **points de code**, contrôlée par le domaine, le front se contentant d'un contrôle indicatif. Comparaison par `toLowerCase(Locale.ROOT)`. Moyenne : `BigDecimal` en `RoundingMode.HALF_UP` à 1 décimale, transportée en nombre JSON. »

### R-17 — Stack : pièges de version pour les agents [Faible]

**Emplacement :** Stack.

**Problème :** les versions sont à jour et sourcées dans le compagnon : Java 25 LTS, Spring Boot 4.1.1, Angular 22, PostgreSQL 18, OpenAPI 3.2.0, AsyncAPI 3.1.0, Maven 3.9.16. Deux précisions manquent pourtant :
- Spring Boot 4 est livré avec **Jackson 3** (paquets `tools.jackson.*`). Des agents entraînés surtout sur Jackson 2 (`com.fasterxml.jackson.*`) importeront la mauvaise version.
- Angular 22 exige Node **≥ 24.15.0** dans la ligne 24. « 24 LTS » seul laisse passer une 24.x trop ancienne.
- Pour PostgreSQL, la 19 est peut-être sortie. C'est sans conséquence, puisque la base est différée.

**Correction :** ajouter les lignes « Jackson 3.x (`tools.jackson`, fourni par Spring Boot 4) » et « Node.js 24 LTS (≥ 24.15.0) ». Ajouter aussi le wrapper Maven (`mvnw`) au seed.

### R-18 — Une seule instance : stratégie de déploiement OpenShift [Faible]

**Emplacement :** AD-9, Deferred (manifests OpenShift).

**Problème :** avec `replicas: 1`, la stratégie par défaut `RollingUpdate` fait coexister deux pods pendant le déploiement. De nouvelles sessions naissent alors sur le nouveau pod pendant que l'ancien sert encore, ce qui éclate l'état et viole l'esprit d'AD-9. Les manifests sont différés, mais la règle doit être fixée dès maintenant.

**Correction :** ajouter à AD-9 : « Toute plateforme déploie le webservice en `replicas: 1` avec la stratégie `Recreate` (ou équivalent) : jamais deux instances simultanées. »

### R-19 — Secrets, sauvegarde et supervision : à déclarer explicitement [Faible]

**Emplacement :** enveloppe opérationnelle.

**Problème :** la grille demande que chaque dimension soit décidée, différée ou ouverte. La spine traite la journalisation (JSON sur stdout) et l'observabilité (différée). Elle ne dit rien des **secrets**, de la **sauvegarde** ni de la **supervision de disponibilité**. Les réponses sont triviales, mais elles doivent figurer, sinon un agent ajoutera un gestionnaire de secrets ou une sonde externe.

**Correction :** ajouter trois lignes :
> - Secrets : aucun en V1. `DATABASE_URL` passera plus tard par les variables secrètes de Render, puis un `Secret` OpenShift.
> - Sauvegarde : N/A, état en mémoire volontairement éphémère (NFR-1, FR-4).
> - Supervision : `/api/health` pour Render et les sondes OpenShift, plus les journaux Render. Aucun pinger externe, qui empêcherait la mise en veille et consommerait le quota de 750 h.

Fixer aussi le format des journaux : la sortie structurée native de Spring Boot (`logging.structured.format.console=ecs`), pour ne pas voir apparaître deux bibliothèques de journalisation.

### R-20 — Carte des capacités incomplète pour les NFR [Faible]

**Emplacement :** Capability → Architecture Map.

**Problème :** `binds` annonce NFR-1 à NFR-10, mais la carte omet NFR-3 (réactivité), NFR-5 (appareils), NFR-7 (langue), NFR-8 (sobriété) et NFR-10 (coût).

**Correction :** ajouter les lignes suivantes :
- NFR-3 → AD-3, AD-5 ;
- NFR-5, NFR-7, NFR-8 → `frontend`, AD-10, Conventions › Langue ;
- NFR-10 → Stack (Render Free), Deferred (hébergeur de repli).

### R-21 — Emplacement du blueprint Render [Faible]

**Emplacement :** Structural Seed (`deploy/render.yaml`).

**Problème :** les Blueprints Render sont historiquement lus à la **racine** du dépôt (`render.yaml`). Un chemin personnalisé est à confirmer dans la documentation actuelle de Render. Le seed doit aussi prévoir la réécriture SPA (`/*` → `/index.html`) du site statique, sans quoi le lien de session donne une 404.

**Correction :** vérifier le support d'un chemin personnalisé, et sinon placer `render.yaml` à la racine. Y déclarer la règle de réécriture SPA et `autoDeploy` (voir R-4).

---

## Parcours de la grille

| Critère | Évaluation |
| --- | --- |
| Fixe les vrais points de divergence, sans en manquer | **Largement oui.** L'état qui fait autorité, la sérialisation, les instantanés filtrés, les intentions idempotentes, les identifiants et le service unique côté front sont exactement les bons invariants. **Manquent :** la poignée de main WebSocket (R-1), le protocole brut (R-3), l'emplacement du diffuseur (R-5), le contenu minimal de l'instantané (R-7) et les intentions interdites (R-8). |
| Chaque règle est applicable et empêche la divergence annoncée | Oui pour AD-1 (ArchUnit), AD-4, AD-5, AD-7, AD-9, AD-11 et AD-12. AD-8 n'empêche pas la divergence sur la déconnexion explicite (R-2). AD-3 est applicable, mais fragile à l'envoi (R-13). AD-6 manque de mécanique de validation (R-6). |
| Rien dans Deferred ne permet une divergence | **Une exception :** la génération de types depuis le contrat (R-6), qui touche toutes les stories. Le client WebSocket Angular peut rester différé, puisque AD-10 le confine à un seul service. Les manifests OpenShift sont différés à juste titre, sous réserve de R-18. |
| Technologies vérifiées et à jour | Oui, avec des sources dans le compagnon. Réserves sur l'outillage OpenAPI 3.2 et AsyncAPI 3.1 (R-6), Jackson 3 et la version minimale de Node (R-17). |
| Couverture FR-1 à FR-17 et des NFR | Tous les FR sont rattachés. Trous de comportement : FR-3 à l'ouverture du lien (R-9), FR-16 déconnexion explicite (R-2), FR-5 et arrivée pendant la révélation (R-7), FR-8 reprise (R-15). NFR-3, 5, 7, 8 et 10 manquent dans la carte (R-20). NFR-2 : démarrage à froid non mesuré (R-12). |
| Enveloppe opérationnelle | Hébergement et stratégie fournisseur : **décidés** (Render, repli Northflank puis Oracle, cible OpenShift). Journalisation : **décidée**. Observabilité : **différée**. **Absents :** processus de déploiement (R-4), environnement local (R-11), secrets, sauvegarde N/A et supervision (R-19), mécanisme de configuration par environnement (R-10). |

## Points forts à conserver

- AD-4 (intentions nommées, `roundId` sur `clear`) règle proprement le clic croisé de l'UX. C'est rare de le voir traité à ce niveau.
- AD-5 (filtrage par destinataire, construit par le domaine) empêche à la fois la fuite des votes et la divergence de reconstruction côté client.
- AD-8 relie avec justesse le signal de vie applicatif à deux besoins, la détection en 15 s et NFR-1b sur Render, et écarte explicitement les ping/pong du protocole.
- AD-12 prépare la trajectoire OpenShift sans rien coûter en V1.
- La correspondance glossaire → identifiants et le transport des cartes en chaînes (`"coffee"`) suppriment une source classique d'écart entre Java et TypeScript.
