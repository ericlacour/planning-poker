---
title: "PRD : Planning Poker pour ateliers d'affinage"
status: final
created: 2026-09-29
updated: 2026-09-29
---

# PRD : Planning Poker pour ateliers d'affinage

*Titre de travail. Le nom du produit reste à choisir.*

## 0. Objet du document

Ce PRD traduit le brief du 29/09/2026 (`_bmad-output/planning-artifacts/briefs/brief-planning-poker-2026-09-29/`) en exigences testables. Il servira de base à la conception UX, à l'architecture, puis au découpage en epics et stories.

Le vocabulaire est fixé par le glossaire (§3). Les exigences fonctionnelles (FR) sont numérotées globalement et regroupées par fonctionnalité. Le §10 fait le point sur les hypothèses. Les choix techniques n'apparaissent pas ici : ils sont dans `addendum.md`.

## 1. Vision

Nous voulons un outil de planning poker **qui appartienne à l'équipe** : sans publicité, sans abonnement, et que nous pouvons faire évoluer. Il remplace Scrum Poker Online pendant nos ateliers d'affinage, à distance ou en hybride.

L'outil fait une seule chose, et doit la faire de façon fiable : permettre à 3 à 13 personnes de voter à l'aveugle, de révéler les votes, d'en discuter, puis de recommencer pour le ticket suivant. Une coupure réseau ou un changement d'appareil ne doit jamais faire perdre sa place ou son vote. Seul un plantage ou un redémarrage du serveur peut faire perdre une session, et ce risque est accepté (NFR-1).

Il n'y a **aucun rôle privilégié**. N'importe qui peut lancer une session, révéler les votes, les masquer ou les effacer. L'atelier ne dépend donc de personne. Ce choix repose sur un principe : **l'équipe se fait confiance**. C'est cette confiance qui rend acceptables l'accès par simple lien et l'absence de garde-fou contre les fausses manœuvres (FR-15, §7.2).

Le projet est aussi le terrain d'apprentissage de la méthode BMAD, suivie de bout en bout.

## 2. Utilisateurs

### 2.1 Jobs To Be Done

- **Fonctionnel :** estimer rapidement une story en équipe, sans que les premiers votes influencent les autres.
- **Contextuel :** voter depuis le PC où tourne la visio, ou depuis son téléphone à côté.
- **Social :** lancer l'atelier même en l'absence du scrum master.
- **Émotionnel :** un outil sobre et sérieux, qui ne distrait pas avec de la publicité et qui ne lâche personne en pleine séance.

### 2.2 Parcours clés

- **UJ-1. Eric lance l'affinage du jeudi.**
  Eric, scrum master, ouvre l'outil sur son PC dix minutes avant l'atelier. Il crée une session, choisit le pseudo « Eric » et se déclare **observateur**, car il anime et ne vote pas. Il colle le **lien de session** dans le chat de la visio. Les sept membres de l'équipe arrivent un par un, et leurs noms apparaissent dans la liste des **participants**.

  Eric présente le premier **ticket** à l'écran partagé. Les votants choisissent une **carte**, et la liste montre au fur et à mesure qui a voté. Quand tout le monde a voté, Eric clique sur **Révéler**. Tout le monde voit les votes nominatifs et la **moyenne**, mais aucun **consensus** n'est signalé (un 3 et un 13). Les deux concernés s'expliquent, puis Eric clique sur **Effacer** et l'équipe revote. Cette fois, c'est 5 partout, et le consensus s'affiche. Eric reporte 5 dans Jira et passe au ticket suivant.

  **Cas limite :** si l'outil a été mis en veille par l'hébergeur, la première ouverture affiche « Réveil du serveur… » pendant une à deux minutes au lieu d'une erreur.

- **UJ-2. Sofia vote depuis son téléphone et perd le réseau.**
  Sofia, développeuse, suit la visio sur son PC mais vote sur son téléphone. Elle ouvre le lien reçu par chat, saisit « Sofia » et rejoint la session en tant que **votante**. En plein **tour**, son wifi tombe. Pour les autres, elle apparaît comme déconnectée. Trente secondes plus tard, la page se reconnecte d'elle-même : elle est toujours « Sofia », et la carte qu'elle avait choisie est toujours là.

  **Cas limite :** si elle passe sur son PC alors que son téléphone est encore connecté, le pseudo « Sofia » est refusé. Elle ferme l'onglet du téléphone, et le pseudo redevient disponible.

- **UJ-3. Karim lance la session à la place d'Eric.**
  Eric est en congé. Karim, développeur, ouvre l'outil, crée une nouvelle session et partage le lien. L'atelier se déroule exactement comme d'habitude : Karim n'a eu besoin d'aucune autorisation ni d'aucun compte. Au même moment, une autre équipe mène son propre affinage dans une autre session, sans aucune interférence.

## 3. Glossaire

- **Session** : espace de vote éphémère, créé pour un atelier. Chaque session a un seul lien de session et regroupe 0 à N participants. Elle expire 24 h après sa création.
- **Lien de session** : URL unique, longue et impossible à deviner. C'est le seul moyen d'accéder à une session.
- **Participant** : personne présente dans une session, identifiée par un pseudo. Un participant est soit votant, soit observateur.
- **Pseudo** : nom affiché d'un participant. Il est unique parmi les participants d'une même session.
- **Votant** : participant qui peut choisir une carte.
- **Observateur** : participant qui ne vote pas. Il a les mêmes droits d'action que tous les autres (révéler, masquer, effacer).
- **Carte** : valeur possible d'un vote, parmi `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`.
- **Vote** : carte choisie par un votant pendant le tour en cours.
- **Ticket** : story discutée pendant l'atelier. Elle est présentée en visio, et l'outil ne la connaît pas.
- **Tour** : cycle de vote sur un ticket. Il commence caché, peut être révélé ou masqué, et se termine par un effacement.
- **Tour caché** : état d'un tour où les votes sont invisibles et encore modifiables.
- **Tour révélé** : état d'un tour où les votes sont visibles par tous et verrouillés.
- **Révéler** : action qui rend les votes visibles pour tous les participants.
- **Masquer** : action qui cache de nouveau les votes d'un tour révélé.
- **Effacer** : action qui supprime tous les votes et démarre un nouveau tour caché.
- **Présence** : état d'un participant, connecté ou déconnecté.
- **Moyenne** : moyenne des votes numériques d'un tour révélé. Les cartes `?` et `☕` en sont exclues.
- **Consensus** : situation où tous les votes numériques d'un tour révélé portent sur la même carte.

## 4. Fonctionnalités

### 4.1 Création d'une session et accès

**Description :** n'importe qui crée une session depuis la page d'accueil, sans compte. Il obtient un lien de session à partager, puis tout le monde rejoint la session avec un pseudo, comme votant ou observateur. Chaque atelier crée sa propre session, et plusieurs sessions coexistent sans interférer. Réalise UJ-1 et UJ-3.

#### FR-1 : Créer une session
Toute personne peut créer une session depuis la page d'accueil. Réalise UJ-1 et UJ-3.
- La création ne demande ni compte, ni mot de passe, ni autre information que le pseudo et le choix votant ou observateur.
- Le créateur est placé directement dans la session. Il n'a aucun droit supplémentaire par rapport aux autres participants.
- Le lien de session s'affiche et se copie en un clic.

#### FR-2 : Rejoindre une session
Toute personne qui a le lien de session peut rejoindre la session en saisissant un pseudo et en choisissant votant ou observateur. Réalise UJ-1 et UJ-2.
- Le pseudo est obligatoire et ne dépasse pas 20 caractères. Les espaces en début et en fin sont ignorés.
- Deux pseudos sont considérés comme identiques s'ils ne diffèrent que par les majuscules (« sofia » et « Sofia »).
- Un pseudo déjà utilisé par un participant **connecté** de la session est refusé, avec un message explicite.
- On rejoint la session en un seul écran : saisir le pseudo, puis valider. Le rôle « votant » est présélectionné.
- Une personne qui arrive en cours de tour peut voter sur ce tour s'il est caché.

#### FR-3 : Lien de session invalide ou expiré
Une personne qui ouvre un lien de session inconnu ou expiré voit un message clair qui lui propose de créer une nouvelle session.

#### FR-4 : Expiration de la session
Une session expire 24 h après sa création. Ensuite, elle n'est plus accessible et ses données (pseudos, votes) sont supprimées.

#### FR-5 : Changer de rôle
Un participant peut passer de votant à observateur, et inversement, pendant la session.
- Un votant qui devient observateur pendant un tour caché perd son vote de ce tour.
- Pendant un tour révélé, le vote reste affiché jusqu'au prochain effacement, puisqu'il est verrouillé (FR-11).
- Un observateur qui devient votant pendant un tour révélé vote à partir du tour suivant.

### 4.2 Présence et reconnexion

**Description :** chacun voit qui est là et qui a voté. Une coupure réseau ou un rafraîchissement de page ne fait perdre ni sa place ni son vote. Réalise UJ-2.

#### FR-6 : Liste des participants
Chaque participant voit la liste de tous les participants de la session, avec pour chacun :
- son pseudo ;
- son rôle (votant ou observateur) ;
- sa présence (connecté ou déconnecté) ;
- pour un votant, pendant un tour caché, s'il a voté ou non, sans jamais voir la carte choisie.

#### FR-7 : Reconnexion automatique
Dans le même navigateur, un participant qui perd sa connexion ou rafraîchit la page retrouve automatiquement sa place dans la session. Réalise UJ-2.
- Il garde son pseudo, son rôle et son vote du tour en cours.
- Pendant la coupure, les autres participants le voient comme déconnecté.
- La page tente de se reconnecter d'elle-même, sans action de l'utilisateur, et affiche clairement son état (« Reconnexion… »).
- Plusieurs onglets du même navigateur ouverts sur la même session représentent un seul et même participant.
- Si la session n'existe plus (serveur redémarré ou session expirée), la page n'insiste pas : elle affiche le message de FR-3, qui propose de créer une nouvelle session.
- Un participant retiré pour absence (FR-9) qui revient, par exemple en rallumant son téléphone après 20 minutes, est **remis automatiquement à sa place**, sous le même pseudo, sans repasser par l'écran pour rejoindre. Seul son vote éventuel du tour en cours a été perdu.
- Rester inactif, sans rien toucher, ou laisser l'onglet en arrière-plan pendant l'explication d'une story ne déconnecte jamais un participant, quelle qu'en soit la durée.
- Si son pseudo a entre-temps été repris depuis un autre appareil (FR-8), ou pris par quelqu'un d'autre après son retrait, la page ne tente pas de reconnexion. Elle affiche l'écran pour rejoindre la session, avec le pseudo prérempli.

#### FR-8 : Reprendre son pseudo depuis un autre appareil
Une personne peut rejoindre la session depuis un autre appareil ou navigateur avec le pseudo d'un participant **déconnecté**. Elle reprend alors ce participant, avec son rôle et son vote. Réalise UJ-2.
- Si ce pseudo est encore utilisé par un participant connecté, il est refusé (FR-2).
- L'appareil d'origine perd ce participant (FR-7).
- Rien n'empêche de reprendre le pseudo d'un participant déconnecté qui n'est pas soi. Ce risque est accepté au nom de la confiance d'équipe (§1, NFR-6).

#### FR-9 : Retrait des participants absents
Un participant déconnecté depuis plus de 5 minutes est retiré de la liste des participants, et son vote du tour en cours est supprimé. Son pseudo redevient libre. S'il revient avec le même navigateur alors que son pseudo est encore libre, il est remis à sa place automatiquement (FR-7).

### 4.3 Vote

**Description :** chaque votant choisit une carte en secret et peut la changer tant que le tour n'est pas révélé. Réalise UJ-1 et UJ-2.

#### FR-10 : Choisir une carte
Un votant peut choisir une carte parmi `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕` pendant un tour caché.
- Il peut changer de carte ou retirer son vote autant de fois qu'il veut, tant que le tour est caché.
- Sa carte reste visible pour lui seul jusqu'à la révélation.
- Un observateur n'a pas de cartes.

#### FR-11 : Vote verrouillé après révélation
Une fois le tour révélé, aucun votant ne peut modifier son vote. Pour revoter, il faut effacer (FR-15).

### 4.4 Révélation, masquage et résultat

**Description :** n'importe quel participant révèle les votes au moment qu'il juge opportun. L'outil affiche alors les votes nominatifs et une synthèse. Réalise UJ-1.

#### FR-12 : Révéler
Tout participant, votant ou observateur, peut révéler le tour en cours, à tout moment, même si certains votants n'ont pas voté.
- Tous les participants voient alors le vote de chaque votant, avec son pseudo.
- Un votant qui n'a pas voté apparaît comme « n'a pas voté ».

#### FR-13 : Masquer
Tout participant peut masquer un tour révélé. Le tour redevient caché pour tous : les votes ne sont plus visibles, et les votants peuvent de nouveau modifier leur carte. Le vote d'un participant devenu observateur pendant la révélation (FR-5) est retiré au masquage.

#### FR-14 : Synthèse du tour révélé
Quand un tour est révélé, tous les participants voient :
- la **moyenne**, arrondie à une décimale et affichée au format français (par exemple « 5,3 »), sans les cartes `?` et `☕`. Elle ne s'affiche pas s'il n'y a aucun vote numérique ;
- l'indication de **consensus** quand tous les votes numériques portent sur la même carte, avec au moins deux votes numériques ;
- la **valeur la plus votée** parmi les votes numériques, avec son nombre de votes. En cas d'égalité, toutes les valeurs à égalité sont affichées ;
- la **valeur minimale** et la **valeur maximale** parmi les votes numériques.

Les cartes `?` et `☕` sont exclues de tous ces calculs. S'il n'y a aucun vote numérique, aucun de ces chiffres ne s'affiche.

### 4.5 Nouveau tour

**Description :** n'importe quel participant efface le tour pour revoter ou passer au ticket suivant. Réalise UJ-1.

#### FR-15 : Effacer
Tout participant peut effacer le tour en cours, qu'il soit caché ou révélé. Réalise UJ-1.
- Tous les votes sont supprimés, et un nouveau tour caché démarre pour tous.
- Aucun historique des tours précédents n'est conservé.
- Il n'y a ni confirmation ni garde-fou. Ce risque est accepté parce que l'équipe se fait confiance (§1) : en cas d'erreur, on revote.

### 4.6 Cohérence partagée

**Description :** tous les participants voient à chaque instant le même état de la session, même quand plusieurs personnes agissent en même temps.

#### FR-16 : Diffusion en temps réel
Toute modification de l'état de la session apparaît chez tous les participants connectés en moins d'une seconde, sans recharger la page. Cela concerne l'arrivée ou le départ d'un participant, un changement de rôle, le dépôt ou le retrait d'un vote, et les actions révéler, masquer et effacer.
- Une déconnexion **explicite** (onglet fermé, départ volontaire) est diffusée dans ce même délai.
- Une déconnexion **brutale** (réseau coupé, téléphone en veille) est détectée en 15 s au plus, puis diffusée en moins d'une seconde.

#### FR-17 : Actions simultanées
Quand plusieurs participants agissent presque en même temps (par exemple, l'un révèle pendant qu'un autre efface), c'est la dernière action reçue qui s'applique. Tous les participants se retrouvent avec **le même état final**. Aucun participant ne voit durablement un état différent des autres.

## 5. Exigences non fonctionnelles transverses

- **NFR-1, fiabilité en séance :** tant que le serveur fonctionne, une session ne perd jamais son état (participants, votes, état du tour), quelles que soient les coupures côté participant (réseau, rafraîchissement, changement d'appareil). En revanche, **perdre la session lors d'un plantage ou d'un redémarrage du serveur est un risque accepté** : le planning poker n'est pas une activité critique. Dans ce cas, l'équipe crée une nouvelle session et revote le ticket en cours.
- **NFR-1b, pas de mise en veille en séance :** l'application ne doit jamais être mise en veille par l'hébergeur tant qu'au moins une session a des participants connectés. Contrairement à un plantage, une mise en veille en pleine séance n'est **pas** un risque accepté, parce qu'elle se reproduirait à chaque atelier. C'est un critère éliminatoire pour choisir l'hébergeur.
- **NFR-2, démarrage à froid :** si l'hébergeur a mis l'application en veille en dehors des séances, le premier chargement peut prendre jusqu'à 2 min (réveil de l'hébergeur gratuit puis démarrage du webservice). Pendant ce temps, la page affiche « Réveil du serveur… », et aucune erreur technique ne doit apparaître. Conseil d'usage : ouvrir l'outil quelques minutes avant l'atelier. Si le serveur ne répond toujours pas au bout de 3 min, la page affiche un message d'indisponibilité et un bouton pour réessayer.
- **NFR-3, réactivité :** en fonctionnement normal, tout changement d'état est propagé dans le délai de diffusion fixé par FR-16.
- **NFR-4, capacité :** une session accueille au moins 13 participants, et au moins 5 sessions tournent simultanément sans dégradation. Cela représente au moins 65 connexions temps réel simultanées, plus une marge pour les reconnexions et les onglets multiples.
- **NFR-5, appareils :** l'interface fonctionne sur PC et sur téléphone, dans les deux dernières versions majeures de Chrome, Edge, Firefox et Safari, iOS et Android compris. Elle reste utilisable dès 360 px de large, et chaque carte offre une zone tactile d'au moins 44 × 44 px.
- **NFR-6, sécurité et confidentialité :** le lien de session est impossible à deviner en pratique. Tout le trafic passe en HTTPS. Aucune donnée personnelle n'est collectée en dehors du pseudo. Aucune publicité ni aucun traceur tiers n'est présent. Toutes les données d'une session sont supprimées à son expiration (FR-4). **Risque accepté :** toute personne qui a le lien de session peut entrer dans la session. Il n'existe ni contrôle d'accès ni expulsion d'un participant, conformément au principe de confiance (§1).
- **NFR-7, langue :** l'interface est entièrement en français.
- **NFR-8, sobriété :** l'utilisation ne demande ni installation ni compte, et rien ne distrait des cartes : pas de bannière ni d'élément sans rapport avec le vote. L'absence de publicité est couverte par NFR-6.
- **NFR-9, évolutivité :** passer d'un hébergeur gratuit à une infrastructure d'entreprise, ou d'un état en mémoire à un stockage partagé, ne demande de modifier que la configuration et la partie stockage, jamais la logique du vote. Plus tard, il doit aussi être possible d'ajouter une intégration Jira ou d'adapter le déroulé du vote à notre façon de travailler (§7.2), sans refondre l'application.
- **NFR-10, coût et sobriété technique :** la V1 ne génère aucun coût récurrent, puisqu'elle tourne sur un hébergeur gratuit. Les choix techniques restent simples et courants : l'outil n'a pas besoin d'avancée technique, il a besoin de marcher.

## 6. Hors objectifs

- Ce n'est **pas un outil de gestion de backlog** : il ne connaît ni les tickets, ni leurs titres, ni les estimations retenues.
- Ce n'est **pas un outil d'animation** : il n'a ni rôle d'animateur ni droits différenciés.
- Il ne conserve **aucun historique** : pas de comptes, pas d'archives de sessions, pas de statistiques d'équipe.
- Ce n'est **pas un produit public** : il n'y a ni monétisation, ni inscription, ni personnalisation par équipe.

## 7. Périmètre MVP

### 7.1 Inclus

FR-1 à FR-17, NFR-1, NFR-1b et NFR-2 à NFR-10.

### 7.2 Exclu de la V1

- Rôle d'animateur ou de modérateur : droits égaux pour tous, par choix.
- Liste de tickets, valeur retenue, statut « non estimé », récapitulatif copiable et export CSV : l'estimation est reportée à la main dans Jira.
- Historique des tours précédents lors d'un revote.
- Garde-fou contre un effacement ou une révélation par erreur, comme une confirmation ou l'affichage de l'auteur de l'action : risque accepté.
- Jeu de cartes configurable.
- Comptes utilisateurs, historique des sessions, lien d'équipe permanent.
- Contrôle d'accès (mot de passe) et expulsion d'un participant : risque accepté (NFR-6).
- **Prévu en V2/V3, si l'outil est adopté :** intégration Jira (import des tickets, renvoi des estimations).
- **Prévu si l'outil est adopté :** hébergement sur l'infrastructure de l'entreprise.

Ces éléments ne sont pas abandonnés : si l'équipe les réclame, ils pourront revenir dans une version ultérieure. Leur description détaillée se trouve dans l'idée forgée (`_bmad-output/forge/planning-poker-affinage/forged-idea.md`).

## 8. Mesures de succès

**Mesures principales**

- **SM-1, adoption :** l'équipe n'utilise plus Scrum Poker Online. Cible : trois ateliers d'affinage consécutifs menés uniquement avec l'outil. Valide le cycle de base : FR-1, FR-2, FR-10, FR-12, FR-15, NFR-5 et NFR-8.
- **SM-2, fiabilité :** zéro incident bloquant pendant un affinage **tant que le serveur fonctionne**. Par incident bloquant, on entend des votes perdus après une reconnexion ou des participants qui voient des états différents. Une perte de session due à un plantage ou à un redémarrage du serveur n'entre pas dans cette mesure (NFR-1), mais elle doit rester exceptionnelle : si elle se répète, il faut revoir l'hébergement. Une mise en veille en pleine séance, en revanche, **compte** comme un incident (NFR-1b). Valide FR-7, FR-16, FR-17, NFR-1 et NFR-1b.
- **SM-3, apprentissage :** un cycle BMAD complet a été mené, du brief jusqu'à l'outil livré et utilisé en atelier.

**Contre-mesure (à ne pas optimiser)**

- **SM-C1, nombre de fonctionnalités :** ajouter des fonctionnalités n'est pas un objectif. Chaque ajout accroît le risque de panne en séance, ce qui va contre SM-2. L'outil doit rester petit.

## 9. Questions ouvertes

1. Quel nom donner au produit ?
2. Quel hébergeur gratuit choisir pour respecter NFR-1b (pas de mise en veille en séance), NFR-2 et NFR-4 (65 connexions temps réel) ? À traiter dans l'architecture.

## 10. Index des hypothèses

Aucune hypothèse ouverte. Les sept hypothèses du premier jet ont été tranchées le 29/09/2026. Six ont été confirmées : pseudo limité à 20 caractères, changement de rôle, masquer qui rouvre le vote, consensus à partir de deux votes numériques, 5 sessions simultanées, adoption mesurée sur trois ateliers. La septième a conduit à redéfinir NFR-1 : la perte d'une session lors d'un plantage ou d'un redémarrage du serveur est acceptée. En revanche, une mise en veille en pleine séance ne l'est pas (NFR-1b).
