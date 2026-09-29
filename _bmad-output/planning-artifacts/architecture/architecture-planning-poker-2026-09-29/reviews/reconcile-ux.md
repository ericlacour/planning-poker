---
title: "Réconciliation d'entrée : spine d'architecture face à EXPERIENCE.md et DESIGN.md"
spine: ../ARCHITECTURE-SPINE.md
inputs:
  - _bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/DESIGN.md
date: 2026-09-29
---

# Réconciliation UX → spine

Question posée : chaque comportement d'interface qui dépend du serveur ou du contrat est-il rendu possible par la spine, sans que deux agents (un Java, un Angular) puissent l'interpréter différemment ?

Réponse courte : les grands choix tiennent (serveur qui fait autorité, instantanés complets filtrés, intentions idempotentes, codes 4401/4404, heartbeat, `/api/health`). En revanche, **la forme de l'instantané n'est pas fixée** : plusieurs données dont l'interface a besoin n'y figurent pas, ou y figurent sans définition. Tant que `contract/asyncapi.yaml` n'existe pas, c'est la spine qui doit trancher, sinon l'agent Java et l'agent Angular inventeront chacun leur champ.

## 1. Couvert

| Comportement UX | Source | Rendu possible par |
|---|---|---|
| « visible par toi seul » : face de ma carte pendant un tour caché, dos pour les autres | EXPERIENCE › Table des participants | AD-5 : le destinataire reçoit la valeur de son propre vote, les autres seulement `hasVoted` |
| Dos de carte dès qu'un participant vote, compteur à jour en moins d'1 s | State Patterns › Tour caché, votes en cours | AD-3 + AD-5 : diffusion à chaque modification |
| Participant déconnecté affiché, puis retiré après 5 min | State Patterns › Participant déconnecté | AD-8 : `connected=false` à 15 s, retrait à 5 min, diffusé via AD-3 |
| M inclut les votants déconnectés | Barre d'action | Possible : les déconnectés restent dans l'instantané jusqu'au retrait (AD-8). La définition exacte de M reste à fixer, voir Manque 3 |
| Retrait du vote par nouvel appui sur la carte | Main de cartes, FR-10 | AD-4 : `vote` avec `card: null` |
| Intentions nommées, intention déjà satisfaite sans effet | Barre d'action › clics croisés | AD-4 (`reveal`, `hide`, `clear` avec `roundId`) |
| « Nouveau tour » et « Effacer les votes » = même action | Barre d'action | AD-4 : une seule intention `clear` |
| Arrivée pendant un tour révélé : faces et résultat visibles | State Patterns | AD-5 : l'instantané révélé contient votes et synthèse |
| « n'a pas voté » au tour révélé | State Patterns › Tour révélé | AD-5 (vote absent pour un votant) |
| Calculs moyenne, plus votée, min, max, consensus faits par le serveur | Panneau de résultat, FR-14 | AD-1, AD-5, AD-10 ; arrondi au dixième dans Conventions |
| Cartes `?` et `☕` | Main de cartes | Conventions › Cartes (`"?"`, `"coffee"`, le front affiche `☕`) |
| Session introuvable sur une session disparue en cours de route ou au rafraîchissement | FR-3, FR-7 | Code de fermeture `4404` |
| Participant repris ailleurs ou retiré → écran Rejoindre | State Patterns, FR-7 | Code de fermeture `4401`, le client ne se reconnecte pas |
| Pseudo refusé, pseudo invalide | Formulaire d'entrée, FR-2 | Conventions › Erreurs : `PSEUDO_TAKEN`, `INVALID_PSEUDO` ; normalisation par le domaine |
| Réveil jusqu'à 3 min, puis « Le serveur ne répond pas. » | Réveil du serveur, NFR-2 | `GET /api/health` (AD-2, AD-12), site statique jamais en veille (memlog), seuils 2/3 min (memlog) |
| Reconnexion avec conservation du vote | Flux 2, FR-7 | AD-7 (jeton dans `localStorage`), AD-5 (instantané complet à la reconnexion), AD-8 (retrait seulement à 5 min) |
| Plusieurs onglets = un seul participant | FR-7 | AD-7 : jeton dans `localStorage`, partagé entre onglets |
| Textes d'interface côté front, codes stables côté serveur | Voice and Tone | Conventions › Erreurs (« Le texte affiché vient du front ») |
| Blocage de 1 s et bandeau à 2 s restent des délais d'interface | Interaction Primitives | AD-8, dernière puce (mais voir Manques 2 et 5 pour leur faisabilité) |
| Jetons visuels en propriétés CSS | DESIGN.md | AD-10, dernière puce (voir aussi section 3) |

## 2. Manques

### Manque 1 : « (toi) » impossible à établir après un rafraîchissement

- **Source :** EXPERIENCE › Table des participants (« ma propre place, marquée « (toi) », vient en premier ») ; Menu du participant (« affiche mon pseudo »).
- **Ce qui manque :** `participantId` n'est renvoyé que par « rejoindre » (séquence de la spine). AD-7 ne range que le jeton dans le `localStorage`. Après un rafraîchissement, un autre onglet ou une reprise, le client n'a que le jeton, qui n'apparaît jamais dans l'instantané : il ne peut pas savoir quelle place est la sienne. Un agent le stockera à côté du jeton, un autre le demandera, un troisième comparera les pseudos.
- **Correction proposée :** ajouter à AD-5 : « Chaque `sessionState` porte `selfParticipantId`, l'identifiant du destinataire. » Le front ne stocke que le jeton.

### Manque 2 : blocage de 1 s après un changement distant, sans moyen de savoir qui a changé l'état

- **Source :** EXPERIENCE › Barre d'action et Interaction Primitives (« les boutons restent inactifs pendant 1 s après un changement venu d'un autre participant », FR-17).
- **Ce qui manque :** l'instantané ne dit ni ce qui a changé, ni qui l'a fait. Le client ne peut pas le déduire de façon fiable : si j'envoie `reveal` pendant qu'un autre révèle, mon intention est ignorée (AD-4 : pas d'incrément, pas de réponse) et je reçois un instantané révélé que je crois avoir provoqué. À l'inverse, un agent qui bloque sur « tout instantané reçu » bloquerait les boutons à chaque vote ou heartbeat de présence, donc presque en permanence pendant le vote. La spine ne dit pas non plus **quels** changements déclenchent le blocage.
- **Correction proposée :** ajouter à AD-5 un champ `lastChange: { kind, byParticipantId }` dans `sessionState`, où `kind` ∈ `REVEAL | HIDE | CLEAR | VOTE | ROLE | JOIN | PRESENCE | REMOVE`, et `byParticipantId` vaut `null` pour le balayeur. Règle client dans AD-10 : bloquer la barre d'action 1 s **seulement** si `kind` ∈ `REVEAL | HIDE | CLEAR` et `byParticipantId ≠ selfParticipantId`. Variante minimale acceptable : `round.status` et `roundId` qui changent + `round.changedBy`.

### Manque 3 : forme de l'instantané non fixée pour les participants, l'ordre, l'éligibilité et le compteur

- **Source :** EXPERIENCE › Table des participants (ordre d'arrivée, votants puis observateurs), State Patterns › Arrivée pendant un tour révélé (« votera au prochain tour »), Barre d'action (« N votes sur M », « Aucun votant »), FR-2 et FR-5.
- **Ce qui manque :**
  - **Ordre d'arrivée :** aucune règle ne dit que la liste est ordonnée, ni ne fournit une date d'arrivée. Une `ConcurrentHashMap` (AD-9) ne garantit aucun ordre. Et que devient la position d'un participant repris depuis un autre appareil (FR-8) ou qui change de rôle ?
  - **« votera au prochain tour » :** aucune donnée ne dit qu'un votant ne peut pas voter sur le tour en cours. C'est une règle métier (FR-5), donc le front ne doit pas la déduire. Elle a aussi un cas ambigu : après « Masquer » (FR-13), le tour redevient caché ; FR-2 dit qu'on peut voter sur un tour caché, FR-5 dit « à partir du tour suivant ». Le serveur doit trancher.
  - **N et M :** le front ne calcule rien de métier (AD-10), mais personne ne dit qui compte. M inclut-il les votants non éligibles (arrivés pendant la révélation) ? Deux agents compteront différemment.
- **Correction proposée :** fixer dans la spine (Conventions, ou un AD-5 enrichi) le squelette de `sessionState` :
  - `participants[]` **triés par ordre d'arrivée** par le domaine (`joinedAt` inclus), l'ordre étant conservé lors d'une reprise (FR-8) et d'un changement de rôle ; le front ne fait que grouper (votants, puis observateurs) et remonter sa propre place en tête de son groupe ;
  - pour chaque participant : `participantId`, `pseudo`, `role`, `connected`, `hasVoted`, `vote` (valeur seulement si révélé ou si c'est soi), `canVoteThisRound` (booléen calculé par le domaine, qui porte « votera au prochain tour ») ;
  - `round: { roundId, status }` et `progress: { voted, expected }` calculés par le domaine, avec `expected` = votants non retirés, connectés ou non, et éligibles au tour ; « Aucun votant » quand `expected = 0` ;
  - trancher le cas « masquer après une arrivée pendant la révélation » dans le domaine (proposition : `canVoteThisRound` reste faux jusqu'au `clear`, conforme à FR-5).

### Manque 4 : forme de la synthèse (égalités, absence de résultat chiffré)

- **Source :** EXPERIENCE › Panneau de résultat (« 5 et 8 · 3 votes chacune », « Pas de résultat chiffré ») ; FR-14.
- **Ce qui manque :** la spine dit que la synthèse est calculée par le domaine, pas sa forme. Un agent Java peut renvoyer une seule valeur la plus votée (perte des égalités) ou des zéros quand il n'y a aucun vote numérique (le front afficherait « Moyenne 0,0 » au lieu de « Pas de résultat chiffré »).
- **Correction proposée :** fixer `summary` dans la spine : `summary: null` pendant un tour caché ; au tour révélé, `summary: { numericVoteCount, average, mostVoted: { values: string[], count }, min, max, consensus }`, où `values` liste **toutes** les valeurs à égalité dans l'ordre croissant, et où `average`, `mostVoted`, `min`, `max` valent `null` quand `numericVoteCount = 0` (le front affiche alors « Pas de résultat chiffré »). `consensus` vaut vrai seulement si `numericVoteCount ≥ 2` et une seule valeur.

### Manque 5 : bandeau « Reconnexion… » après 2 s impossible sur une coupure silencieuse

- **Source :** State Patterns › Reconnexion en cours (moi) ; Flux 2 (wifi du téléphone qui tombe).
- **Ce qui manque :** le heartbeat va du client au serveur, et le serveur n'envoie rien tant que l'état ne change pas. Sur une coupure silencieuse (wifi mobile, mise en veille du téléphone), le navigateur peut ne déclencher `close` qu'au bout de dizaines de secondes, voire jamais. Le client n'a donc aucun signal pour démarrer le compteur de 2 s. Les ping/pong du protocole sont invisibles côté JavaScript.
- **Correction proposée :** ajouter à AD-8 : « Le serveur répond à chaque `heartbeat` par un message `heartbeatAck` (ou renvoie la `version` courante). Le client considère la connexion perdue s'il ne reçoit aucun message pendant 7 s (plus d'un heartbeat manqué), ferme la socket et affiche le bandeau 2 s après. » Ajouter `heartbeatAck` à la liste Serveur → client des Conventions. Fixer aussi la politique de relance (par exemple 1 s, 2 s, 5 s puis toutes les 5 s) pour que les tests des deux côtés s'alignent.

### Manque 6 : « Session introuvable » à l'ouverture d'un lien, avant toute saisie

- **Source :** Information Architecture › Session introuvable (« par un lien inconnu ou expiré ») ; FR-3 (« Une personne qui ouvre un lien de session inconnu ou expiré voit un message clair »).
- **Ce qui manque :** AD-2 limite REST à créer, rejoindre et santé, et interdit toute autre lecture. Sans jeton, le client ne peut apprendre l'inexistence de la session qu'**après** avoir saisi un pseudo et envoyé « rejoindre » (`SESSION_NOT_FOUND`). Un agent affichera le formulaire Rejoindre puis l'erreur, un autre ajoutera un endpoint non prévu.
- **Correction proposée :** soit ajouter à AD-2 `GET /api/sessions/{sessionId}` (réponse 204 ou 404 `SESSION_NOT_FOUND`, sans aucune donnée de session, pour ne rien divulguer), appelé à l'arrivée sur Rejoindre ; soit écrire explicitement que Session introuvable n'apparaît qu'après la validation du formulaire. La première option respecte FR-3.

### Manque 7 : présentation du jeton à l'ouverture du WebSocket et effets de la reprise

- **Source :** State Patterns › Participant repris ailleurs ; Flux 2 (reprise depuis le PC) ; FR-8.
- **Ce qui manque :**
  - AD-7 dit que le jeton est « présenté à l'ouverture du WebSocket » sans dire comment. Un navigateur ne peut pas poser d'en-tête sur un WebSocket : paramètre de requête (visible dans les journaux du proxy Render, contraire à l'esprit d'AD-7), sous-protocole, ou premier message ? Deux agents choisiront différemment.
  - La reprise (FR-8) : « rejoindre » avec le pseudo d'un déconnecté renvoie-t-il un **nouveau** jeton, et l'ancien est-il invalidé ? Les sockets encore ouvertes (à moitié mortes) de l'ancien appareil sont-elles fermées activement en `4401` ?
  - Code HTTP de `PSEUDO_TAKEN` et `SESSION_NOT_FOUND` non fixé (le front ne doit se fier qu'au `code`, mais il faut le dire).
- **Correction proposée :** dans AD-7 : « URL `wss://…/ws/sessions/{sessionId}`, puis premier message client `{ "type": "hello", "participantToken": "…" }` ; le serveur ferme en `4401` si aucun `hello` valide n'arrive en 5 s. » Dans AD-7 ou AD-3 : « Une reprise émet un nouveau jeton, invalide l'ancien et ferme en `4401` toutes les connexions de l'ancien jeton. » Dans Conventions › Erreurs : 404 pour `SESSION_NOT_FOUND`, 409 pour `PSEUDO_TAKEN`, 400 pour `INVALID_PSEUDO` ; le front ne se fonde que sur `code`.

### Manque 8 (mineur) : erreurs WebSocket non énumérées

- **Source :** Main de cartes (grisée au tour révélé), Barre d'action.
- **Ce qui manque :** la spine prévoit `{ "type": "error", "code" }` sans liste de codes, et ne dit pas si un `vote` sur un tour révélé ou d'un observateur est ignoré silencieusement (comme AD-4) ou rejeté.
- **Correction proposée :** écrire « Toute intention impossible dans l'état courant (vote sur tour révélé, vote d'un observateur ou d'un non-éligible) est ignorée sans erreur ni incrément de version. `error` est réservé aux messages mal formés (`INVALID_MESSAGE`). » Cela aligne tout sur AD-4 et évite au front de gérer des erreurs qu'il ne peut de toute façon pas afficher.

## 3. Purement front et sans risque

Ces comportements ne demandent rien au serveur ni au contrat. Ils relèvent d'AD-10 et des stories front.

- **Thème** automatique, clair ou sombre, mémorisé dans le navigateur (`localStorage`, clé propre à l'application). Précision utile pour AD-10 : les jetons `*-dark` de `DESIGN.md` ne deviennent pas des propriétés séparées ; `--background` (et chaque jeton) est redéfini sous `prefers-color-scheme: dark` et sous un attribut `data-theme="dark"` posé sur `<html>`. Sans cette phrase, un agent créera `--background-dark` et l'autre non, mais l'effet reste interne au front.
- **Partage natif** : `navigator.share` quand il existe (sur téléphone), sinon `navigator.clipboard.writeText`, libellé « Lien copié » pendant 2 s. Le lien est l'URL du site statique contenant le `sessionId` ; le format de route (par exemple `/s/{sessionId}`) est une décision front, à fixer dans la première story front.
- **Jetons CSS** : propriétés personnalisées globales avec les noms de `DESIGN.md` (AD-10), pile de polices système.
- **Envoi en cours** (« Connexion… », bouton inactif) et **échec réseau** (« Impossible de joindre le serveur. », saisie conservée) : état local du formulaire autour de l'appel REST ; la distinction avec une réponse `problem+json` suffit (erreur réseau ou 5xx = échec réseau ; `code` = message dédié).
- **Réveil du serveur** : boucle d'appels à `/api/health` avec un délai par appel, message à 0 s, bascule sur « Le serveur ne répond pas. » à 3 min, bouton « Réessayer ». Tout est côté client ; le serveur n'a qu'à répondre à `/api/health` avec CORS (AD-11).
- **Pseudo pré-rempli** (dernier pseudo, et après un `4401`) : `localStorage`. Le front efface le jeton de la session à la réception d'un `4401` ou `4404`.
- **Arrivée directe sur la table** si un jeton existe déjà pour cette session dans le navigateur (onglet supplémentaire, rafraîchissement) : décision front.
- **Chargement de la session** (places vides en attente), **Session vide** (aucun autre participant), déplacement de la place quand le rôle change : dérivés de l'instantané, une fois le Manque 3 réglé.
- **Annonces `aria-live`** (« Sofia a rejoint la session », « Nouveau tour », compteur toutes les 5 s au plus) : différences entre deux instantanés successifs (nouveau `participantId`, nouveau `roundId`). Le champ `lastChange` du Manque 2 les simplifierait, sans être indispensable.
- **Formatage** : « 5,9 », « 5 et 8 · 3 votes chacune », « 1 vote » ou « N votes », `☕` pour `coffee`.
- **Animations** (retournement 400 ms, carte soulevée 150 ms, `prefers-reduced-motion`), tiroir de cartes sur téléphone, grilles responsives, accessibilité clavier.
- **Actions désactivées pendant la reconnexion** : état local de `SessionService`, une fois le Manque 5 réglé.
