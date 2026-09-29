---
title: "Réconciliation d'entrée : PRD → spine d'architecture"
reviewed: ARCHITECTURE-SPINE.md (état du 2026-09-29 13:59) et .memlog.md
input: prds/prd-planning-poker-2026-09-29/prd.md et addendum.md
date: 2026-09-29
---

# Réconciliation d'entrée : PRD → spine d'architecture

Méthode : chaque FR et chaque NFR du PRD (§4, §5) et chaque piste de l'addendum a été confrontée aux AD-1 à AD-12, aux Consistency Conventions, à la Capability Map et au `.memlog.md`. Une exigence est « couverte » si une règle de la spine empêche deux agents de l'implémenter différemment. Elle est « hors compétence » si elle relève seulement du rendu ou d'une règle de domaine locale, sans risque de divergence entre composants.

## 1. Couvert

| Exigence | Gouvernée par | Remarque |
| --- | --- | --- |
| FR-1 Créer une session | AD-2, AD-7, AD-11 | Création via REST, `sessionId` 128 bits. Voir le manque M-9 sur l'enchaînement créer → rejoindre. |
| FR-3 Lien invalide ou expiré | Conventions « Erreurs » (`SESSION_NOT_FOUND`) et « Codes de fermeture » (`4404`) | Même traitement pour lien inconnu et expiré, conforme au PRD. |
| FR-4 Expiration à 24 h | AD-8 (balayeur, `Clock`), AD-9 | Suppression de la session dans `SessionStore`. Voir M-4 pour les données qui survivent hors du store. |
| FR-6 Liste des participants | AD-5 (`hasVoted`, filtrage), glossaire (`connected`, `role`) | |
| FR-7 Reconnexion automatique | AD-7 (jeton en `localStorage` partagé entre onglets), AD-10, codes `4401` / `4404` | Voir M-1 (déconnexion explicite) et M-6 (téléphone en veille). |
| FR-9 Retrait après 5 min | AD-8, AD-3, code `4401` | |
| FR-10 Choisir une carte | AD-4 (`vote`, `card: null` pour retirer), AD-5, convention « Cartes » | Voir M-7 pour le cas d'un vote refusé. |
| FR-11 Vote verrouillé | AD-1 (règle dans `domain`) | |
| FR-12 Révéler | AD-4, AD-5 | |
| FR-13 Masquer | AD-4 (`hide`), AD-1 | |
| FR-14 Synthèse | AD-1, AD-5 (calcul par le domaine), AD-10 (front = formatage), convention « Nombres » | Voir M-8 sur le mode d'arrondi. |
| FR-15 Effacer | AD-4 (`clear` + `roundId`) | |
| FR-16 Diffusion < 1 s ; détection brutale ≤ 15 s | AD-3, AD-5, AD-8 (heartbeat 5 s, seuil 15 s) | Voir M-1 pour la déconnexion **explicite**. |
| FR-17 Actions simultanées | AD-2 (un seul canal), AD-3 (verrou par session, `version`), AD-4, AD-5 (le client ignore les versions anciennes) | |
| NFR-1 Fiabilité en séance | AD-3, AD-9 (mémoire, instance unique, perte au redémarrage acceptée) | |
| NFR-1b Pas de veille en séance | AD-8 (heartbeat applicatif JSON), `.memlog` + recherche : Render compte les messages WebSocket entrants depuis le 24/02/2026 | Dépend de l'onglet actif côté client, voir M-6. |
| NFR-2 Démarrage à froid | AD-2 (`GET /api/health`), site statique Render jamais en veille, diagramme de séquence | Le délai de 3 min est un délai d'interface ; AD-8 ne le cite pas dans sa liste, sans risque réel. |
| NFR-3 Réactivité | via FR-16 | |
| NFR-4 Capacité | Convention « Tests » (test de charge dès la première story WebSocket), AD-9, repli d'hébergeur en Deferred | |
| NFR-9 Évolutivité | AD-1, AD-9, AD-12, Deferred (PostgreSQL, multi-instances, Jira) | |
| Addendum : persistance en mémoire, interface de stockage, identifiant ≥ 128 bits, jeton en stockage local, heartbeat 5 s / 15 s, page de réveil statique | AD-9, AD-7, AD-8, Structural Seed | Toutes les pistes de l'addendum sont reprises. |

## 2. Manques

### M-1 — Déconnexion explicite non diffusée en moins d'une seconde

- **Source :** PRD FR-16, 2e puce : « Une déconnexion **explicite** (onglet fermé, départ volontaire) est diffusée dans ce même délai. »
- **Ce qui manque :** AD-8 ne fait passer un participant à `connected=false` qu'après 15 s sans message. Rien ne dit que la fermeture d'un WebSocket le déconnecte immédiatement. Avec plusieurs onglets pour un même participant (FR-7), il faut aussi dire quand il est déconnecté : à la fermeture de sa **dernière** connexion, pas de la première. Un agent qui s'en tient à AD-8 affichera l'onglet fermé comme connecté pendant 15 s.
- **Correction proposée :** ajouter à AD-8 : « La fermeture de la dernière connexion WebSocket d'un participant le fait passer à `connected=false` immédiatement, via AD-3. La présence d'un participant est : au moins une connexion ouverte **et** un message reçu depuis moins de 15 s. » Dire aussi si « départ volontaire » correspond à une intention (`leave`, absente d'AD-4 et de la convention « Messages WebSocket ») ou seulement à la fermeture de l'onglet. EXPERIENCE ne prévoit pas de bouton « Quitter » : la fermeture suffit, mais il faut l'écrire.

### M-2 — Reprise du pseudo (FR-8) : le transfert d'identité n'est pas spécifié

- **Source :** PRD FR-8 (« Elle reprend alors ce participant, avec son rôle et son vote […] L'appareil d'origine perd ce participant ») ; addendum « Jeton de participant » et « Jeton refusé ».
- **Ce qui manque :** AD-7 cite FR-8 mais ne dit pas ce que fait « rejoindre » quand le pseudo appartient à un participant **déconnecté** :
  - le participant existant est-il réutilisé (même `participantId`, même rôle, même vote), ou en crée-t-on un nouveau ?
  - l'ancien `participantToken` est-il révoqué et remplacé par un nouveau ?
  - les connexions encore ouvertes de l'ancien jeton (connexion à moitié ouverte, heartbeat en retard) sont-elles fermées avec `4401` ?
  - le rôle choisi dans le formulaire de reprise l'emporte-t-il sur le rôle repris ?
  
  Sans règle, un agent peut laisser l'ancien jeton valide : l'appareil d'origine continuerait à piloter le même participant, contrairement à FR-7 et FR-8.
- **Correction proposée :** ajouter à AD-7 une puce « Reprise (FR-8) » : « Rejoindre avec le pseudo d'un participant `connected=false` réutilise ce participant (même `participantId`, vote conservé), **émet un nouveau `participantToken`**, invalide l'ancien et ferme en `4401` toute connexion qui le porte, le tout sous le verrou d'AD-3. Le rôle conservé est [celui du participant repris / celui choisi dans le formulaire]. » Le choix du rôle est à trancher avec Eric : le PRD dit « avec son rôle », mais le formulaire présélectionne « votant ».

### M-3 — Changement de rôle sur un tour révélé : forme de l'instantané et cas de « Masquer »

- **Source :** PRD FR-5, puces 2 et 3 ; FR-13.
- **Ce qui manque :**
  1. Pendant un tour révélé, un votant devenu observateur **garde son vote affiché**. L'instantané d'AD-5 doit donc porter un vote sur un participant `role: OBSERVER`. Si le contrat attache le vote au rôle `VOTER`, le front et le back divergeront. Il faut aussi dire si ce vote compte dans la synthèse (FR-14).
  2. Un observateur devenu votant pendant un tour révélé « vote à partir du tour suivant ». Faut-il l'afficher « n'a pas voté » (FR-12) dans le tour révélé en cours ? Et que peut-il faire si quelqu'un **masque** ce tour (FR-13) : voter tout de suite ?
  3. Symétriquement, si l'on masque un tour après qu'un votant est devenu observateur, son vote verrouillé redevient-il un vote d'observateur dans un tour caché ? FR-5, puce 1, dit qu'un observateur perd son vote dans un tour caché.
- **Correction proposée :** ajouter à AD-5 (ou à une convention « Vote ») : « Le vote appartient au tour et au `participantId`, pas au rôle. La synthèse porte sur tous les votes présents dans le tour révélé. » Et trancher en règle de domaine, à inscrire dans le contrat : « Au masquage, les votes des participants devenus observateurs sont supprimés ; un participant devenu votant pendant le tour révélé peut voter dès que le tour redevient caché. » Ces deux arbitrages relèvent du PRD : à confirmer avec Eric, puis à reporter dans FR-5.

### M-4 — NFR-6 : données qui survivent à l'expiration, et HTTPS non écrit

- **Source :** PRD NFR-6 : « Tout le trafic passe en HTTPS […] Aucune publicité ni aucun traceur tiers n'est présent. Toutes les données d'une session sont supprimées à son expiration (FR-4). »
- **Ce qui manque :**
  - **Journaux :** la convention « Journalisation » interdit le jeton et les votes cachés, mais pas le **pseudo**. Des journaux JSON conservés par Render ou OpenShift garderaient les pseudos au-delà de 24 h.
  - **Navigateur :** le `participantToken` est rangé dans le `localStorage` « sous une clé propre à la session » (AD-7), et rien ne prévoit de l'effacer. Chaque session laisse une entrée pour toujours. Le pseudo retenu pour le pré-remplissage (EXPERIENCE) est un choix de l'utilisateur, acceptable, mais les jetons par session ne le sont pas.
  - **Traceurs tiers :** aucun AD ni aucune convention n'interdit une ressource tierce (CDN, polices, analytics). DESIGN.md impose déjà la police système, mais la spine ne verrouille pas ce point pour les agents.
  - **HTTPS / WSS :** la spine ne l'écrit nulle part. Render le fournit, mais `config.json` pourrait contenir une URL `http://` ou `ws://`.
- **Correction proposée :** compléter les conventions :
  - « Journalisation » : « Ne journaliser ni pseudo, ni jeton, ni valeur de vote. Désigner une session ou un participant par un identifiant tronqué. »
  - nouvelle ligne « Données côté navigateur » : « Une seule clé `localStorage` par session, avec sa date d'expiration. Le `SessionService` la supprime sur fermeture `4404`, et purge au démarrage les clés expirées. Le dernier pseudo saisi est la seule autre donnée conservée. »
  - nouvelle ligne « Ressources tierces » : « Aucune ressource chargée depuis un autre domaine que le site statique et l'API : ni CDN, ni police web, ni analytics. En-tête `Content-Security-Policy` limité à `'self'` et à l'origine de l'API. »
  - AD-11 : « `config.json` ne contient que des URL `https://` ; le client dérive `wss://` de l'URL de l'API. TLS est terminé par la plateforme (Render, route OpenShift). »

### M-5 — NFR-10 : le coût zéro n'est gardé par aucune règle

- **Source :** PRD NFR-10 : « la V1 ne génère aucun coût récurrent, puisqu'elle tourne sur un hébergeur gratuit. »
- **Ce qui manque :** la spine choisit Render Free mais n'en fait pas une contrainte. Or la recherche (`research-stack-hosting.md`, §5) note que Render Free donne **750 h d'instance par mois et par workspace**, avec suspension au-delà. Une instance permanente consomme environ 744 h : un second web service gratuit (préproduction, aperçu de PR) épuiserait le quota et suspendrait l'outil en séance, ce qui violerait aussi NFR-1b. Rien n'interdit non plus d'ajouter un service payant (base gérée, monitoring). Enfin, le repli Oracle Always Free exige une carte bancaire (`.memlog`).
- **Correction proposée :** ajouter une convention « Coût (NFR-10) » : « V1 : un seul web service Render Free par workspace, plus le site statique. Aucun environnement de préproduction, aucun aperçu de PR sur Render, aucun service ou dépendance payant. CI limitée aux minutes gratuites de GitHub Actions. Tout ajout d'infrastructure passe par un nouvel AD. » Mentionner dans Deferred que le repli Oracle demande une carte bancaire, sans coût attendu.

### M-6 — NFR-5 : navigateurs cibles et comportement des téléphones en veille

- **Source :** PRD NFR-5 (deux dernières versions de Chrome, Edge, Firefox, Safari, iOS et Android) ; FR-7 et FR-16 (« téléphone en veille »).
- **Ce qui manque :** la spine ne cite ni la liste des navigateurs, ni le test associé. Le vrai risque d'architecture est Safari iOS : il suspend les timers et coupe le WebSocket d'un onglet en arrière-plan. Le heartbeat s'arrête, le participant passe déconnecté (normal), mais au retour au premier plan la reconnexion doit être **immédiate**, sans attendre le prochain essai du backoff. Ce comportement n'est confié à personne. AD-10 dit seulement que `SessionService` relance le WebSocket.
- **Correction proposée :**
  - Stack : « Navigateurs : `browserslist` par défaut d'Angular 22, qui couvre NFR-5 ; ne pas l'élargir ni le restreindre. »
  - AD-10 : « `SessionService` tente une reconnexion immédiate sur `visibilitychange` (retour au premier plan) et sur l'événement `online`, en plus de son backoff. »
  - Convention « Tests » : « Un test de bout en bout (Playwright) tourne au moins sur Chromium, Firefox et WebKit. »

### M-7 — Normalisation du pseudo (FR-2) : longueur et casse ambiguës

- **Source :** PRD FR-2 : « ne dépasse pas 20 caractères. Les espaces en début et en fin sont ignorés. […] identiques s'ils ne diffèrent que par les majuscules ».
- **Ce qui manque :** la convention « Pseudo » reprend la règle, mais pas sa définition technique. Un agent Java utilisera `String.length()` (unités UTF-16 : un emoji compte 2) et `toLowerCase()` (dépendant de la locale : « I » turc). Un agent Angular utilisera `maxlength="20"`, qui compte aussi en UTF-16 mais peut différer après normalisation Unicode. « Élodie » saisi en forme décomposée (NFD) sur un Mac et en forme composée (NFC) sur un PC donnerait deux pseudos distincts. Le pseudo vide après retrait des espaces est couvert par `INVALID_PSEUDO`.
- **Correction proposée :** préciser la convention « Pseudo » : « Normalisation par le domaine : NFC, puis retrait des blancs Unicode (`strip()`) en début et en fin. Longueur comptée en points de code (≤ 20). Comparaison d'unicité sur `toLowerCase(Locale.ROOT)` de la forme normalisée. Le pseudo affiché garde la casse saisie. `contract/openapi.yaml` porte `maxLength: 20` ; le front applique la même règle pour activer le bouton, mais seul le serveur fait foi. »

### M-8 — Intentions non applicables et arrondi : deux zones de divergence mineures

- **Source :** PRD FR-10, FR-11 (vote refusé après révélation, observateur sans cartes) ; FR-14 (« arrondie à une décimale »).
- **Ce qui manque :**
  - AD-4 traite les intentions **déjà satisfaites**, mais pas les intentions **impossibles** : `vote` reçu juste après une révélation, `vote` d'un observateur, carte inconnue. Un agent renverra une erreur, un autre l'ignorera. La convention « Erreurs » ne liste aucun code WebSocket.
  - « `double` arrondi au dixième » ne fixe pas le mode : 21 / 4 = 5,25 donne 5,3 avec `Math.round` et 5,2 avec `HALF_EVEN`.
- **Correction proposée :** AD-4 : « Une intention non applicable dans l'état courant (vote sur un tour révélé, vote d'un observateur) est ignorée sans erreur ; l'instantané suivant fait foi. Seul un message invalide au regard du contrat donne `{ "type": "error", "code": "INVALID_MESSAGE" }`. » Convention « Nombres » : « arrondi `HALF_UP` au dixième, via `BigDecimal` ».

### M-9 — FR-1 : le créateur est « placé directement dans la session »

- **Source :** PRD FR-1, puce 2.
- **Ce qui manque :** AD-2 liste « créer » et « rejoindre » comme deux appels REST, et le diagramme de séquence ne montre que « rejoindre ». On ne sait pas si `POST /api/sessions` reçoit le pseudo et le rôle et renvoie directement le `participantToken`, ou si le front enchaîne deux appels. Dans le second cas, une session peut être créée sans participant. C'est sans gravité, mais les deux côtés doivent faire le même choix.
- **Correction proposée :** AD-2 : « `POST /api/sessions` prend le pseudo et le rôle et renvoie `sessionId`, `participantId` et `participantToken` en une seule réponse. » (Ou l'inverse, pourvu que ce soit écrit.)

### Remarque sur NFR-7 (français)

NFR-7 est couvert par la convention « Langue du code » (textes d'interface en français, textes d'erreur produits par le front) et par AD-10 (formatage « 5,9 »). Il manque seulement deux détails d'exécution, à ajouter à AD-10 si l'on veut éviter l'oubli : `<html lang="fr">` et l'enregistrement de la locale `fr` d'Angular (`LOCALE_ID`) pour le formatage des nombres. Ce n'est pas un manque de décision.

## 3. Hors compétence de l'architecture

| Exigence | Pourquoi |
| --- | --- |
| FR-2 : écran unique, rôle « votant » présélectionné | Rendu, fixé par EXPERIENCE (`entry-form`). |
| FR-2 : arrivée en cours de tour caché | Règle de domaine locale, découle d'AD-1 et d'AD-5 ; aucune divergence possible entre composants. |
| FR-5, puce 1 : perte du vote en tour caché | Règle de domaine locale (AD-1). Les cas du tour révélé, eux, touchent le contrat : voir M-3. |
| FR-12 : libellé « n'a pas voté » | Rendu à partir de `hasVoted` ; texte fixé par EXPERIENCE. |
| FR-14 : égalités de la valeur la plus votée, consensus à partir de deux votes | Règles de calcul du domaine, déjà confiées à `domain` par AD-1 ; à couvrir par des tests unitaires. |
| FR-15 : pas de confirmation, pas d'historique | Absence de fonctionnalité ; AD-5 (instantané sans historique) ne crée rien de plus. |
| NFR-5 : 360 px, zones tactiles de 44 × 44 px | Mise en page, fixée par DESIGN.md. Le volet navigateurs, lui, est traité en M-6. |
| NFR-7 : formulations et ton | EXPERIENCE › Voice and Tone. |
| NFR-8 : sobriété, aucun élément sans rapport avec le vote | Contenu d'interface (EXPERIENCE, DESIGN). Le volet « aucune ressource tierce » est traité en M-4. |
| Addendum : « ne pas redéployer pendant un atelier » | Consigne d'exploitation, pas une règle de code. Elle pourrait figurer dans le README de déploiement. |
