---
title: "EXPERIENCE : Planning Poker pour ateliers d'affinage"
status: final
created: 2026-09-29
updated: 2026-09-29
sources:
  - _bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/prd.md
  - _bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-planning-poker-2026-09-29/brief.md
---

# EXPERIENCE : Planning Poker pour ateliers d'affinage

## Foundation

- **Type d'application :** une seule application web responsive, utilisable sur PC et sur téléphone (NFR-5), sans installation ni compte (NFR-8).
- **Système d'interface :** aucun n'est imposé, le choix revient à l'architecture.
- **Apparence :** elle est décrite dans `DESIGN.md`, auquel ce document renvoie par ses jetons (`{colors.primary}`, etc.).
- **Vocabulaire :** celui du glossaire du PRD (§3) : session, participant, pseudo, votant, observateur, carte, vote, tour (caché ou révélé), révéler, masquer, effacer, présence, moyenne, consensus. Un seul terme propre à l'interface s'y ajoute : la **place**, c'est-à-dire l'emplacement d'un participant sur la table (pseudo, présence et carte).
- **Principe directeur :** **simple avant tout**. Quelqu'un qui ouvre le lien pour la première fois doit pouvoir voter sans explication. Chaque écran n'a qu'une action principale.

## Information Architecture

| Écran | On y arrive… | Rôle |
|---|---|---|
| **Accueil** | par l'adresse de l'outil | Créer une session : saisir un pseudo, choisir un rôle (FR-1) |
| **Rejoindre** | par un lien de session | Entrer dans la session en un seul écran : pseudo, rôle « votant » présélectionné (FR-2) |
| **Session** | après Accueil ou Rejoindre, ou par reconnexion (FR-7) | Voter, voir qui a voté, révéler, masquer, effacer, voir le résultat |
| **Session introuvable** | par un lien inconnu ou expiré, ou quand la session a disparu (FR-3, FR-7) | Expliquer ce qui s'est passé et proposer de créer une nouvelle session |
| **Réveil du serveur** | au premier chargement, quand l'hébergeur a mis l'application en veille (NFR-2) | Faire patienter pendant le réveil, qui prend jusqu'à 2 min. L'attente se prolonge jusqu'à 3 min ; au-delà, afficher « Le serveur ne répond pas. » avec le bouton « Réessayer » |

Il n'y a ni menu de navigation, ni fenêtre modale. Le changement de rôle (FR-5) et le choix du thème se font depuis la barre du haut de l'écran Session, sans quitter la table.

→ Maquettes (en cas de conflit, ce document fait foi) :
- `mockups/session-pc.html` : l'écran Session sur PC, vu par Eric (observateur) puis par Sofia (tour caché), puis le tour révélé sans consensus ;
- `mockups/session-telephone.html` : l'écran Session sur téléphone, en thème sombre, avec le tour caché, le tour révélé avec consensus et la reconnexion ;
- `mockups/rejoindre.html` : Rejoindre sur téléphone, le cas du pseudo refusé, et l'Accueil sur PC ;
- `mockups/etats.html` : Réveil du serveur, Serveur indisponible, Session introuvable et Session vide.

## Voice and Tone

Le texte de l'interface est court, direct et chaleureux, et **tutoie** l'utilisateur, comme on le ferait entre collègues. La voix de la marque est décrite dans `DESIGN.md`, section Brand & Style.

| À faire | À ne pas faire |
|---|---|
| « Choisis ta carte » | « Veuillez sélectionner une valeur d'estimation » |
| « 5 votes sur 7 » | « 5 participant(s) sur 7 ont soumis leur vote » |
| « Consensus ! » | « Félicitations, l'équipe est alignée 🎉🎉 » |
| « Lien copié » | « Le lien a été copié dans le presse-papiers avec succès » |
| « Ce pseudo est déjà pris dans cette session. » | « Erreur 409 : conflit d'identifiant » |
| « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. » | « Session not found » |
| « Réveil du serveur… Ça peut prendre jusqu'à 2 minutes. » | Une page blanche, ou une erreur technique |

Libellés fixes, à reprendre tels quels :
- **Boutons :** « Créer une session », « Rejoindre », « Copier le lien », « Révéler les votes », « Masquer », « Nouveau tour », « Effacer les votes », « Réessayer ».
- **Choix du rôle :** « Je vote », « J'observe », « Je veux voter ».
- **Champs et messages :** « Ton pseudo », « Ton rôle », « Choisis ta carte », « Tu observes », « Connexion… », « Partage le lien pour inviter ton équipe », « Aucun votant », « visible par toi seul », « votera au prochain tour », « Impossible de joindre le serveur. », « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. », « Trop de sessions créées depuis ton réseau. Patiente une minute. », « Cette session est complète. » (story 2.6, validés par Eric le 2026-10-03).

## Component Patterns

Ce tableau décrit le **comportement** des composants. Leur apparence est décrite dans `DESIGN.md`, section Components, sous les mêmes identifiants.

| Composant | Où | Règles de comportement |
|---|---|---|
| **Barre du haut** (`top-bar`) | Session | Elle contient le nom de l'outil, « Copier le lien » et le menu du participant. Elle reste fixe en haut de l'écran. |
| **Formulaire d'entrée** (`entry-form`) | Accueil, Rejoindre | Un champ « Ton pseudo » (20 caractères au maximum) et un groupe « Ton rôle » avec « Je vote / J'observe », sur « Je vote » par défaut. Le bouton reste inactif tant que le pseudo est vide ou ne contient que des espaces. La touche Entrée valide le formulaire. Le pseudo refusé (FR-2) s'affiche en erreur sous le champ, sans effacer la saisie. Le navigateur retient le dernier pseudo utilisé et le pré-remplit. |
| **Main de cartes** (`poker-card`, `poker-card-selected`) | Session (votant) | Un clic ou un appui choisit la carte. Un nouvel appui sur la même carte **retire** le vote (FR-10). Choisir une autre carte remplace le vote. La main est grisée et ne réagit plus quand le tour est révélé (FR-11). Sur téléphone, le tiroir de cartes (voir Responsive & Platform) se replie alors complètement, et il se redéploie au tour suivant. Tant que je n'ai pas voté, l'indication « Choisis ta carte » s'affiche au-dessus de la main. Un observateur ne voit pas la main, mais le message « Tu observes » et un lien « Je veux voter ». |
| **Table des participants** (`seat-card-empty`, `seat-card-back`, `seat-card-face`, `presence-dot`) | Session | Une place par participant : pseudo, présence, et carte (vide, dos ou face) (FR-6). Ordre des places : d'abord les votants, puis les **observateurs, toujours à la fin**. Au sein de chaque groupe, ma propre place, marquée « (toi) », vient en premier, et les autres suivent par ordre d'arrivée. Quand un participant change de rôle (FR-5), sa place change de groupe. Pendant un tour caché, ma place montre la **face** de ma carte pour moi seul, avec la mention « visible par toi seul », et son dos pour les autres. |
| **Barre d'action** (`action-bar`, `button-primary`, `button-secondary`) | Session | Un compteur « N votes sur M ». M compte tous les votants, y compris ceux qui sont déconnectés, tant qu'ils n'ont pas été retirés (FR-9). Un seul bouton principal, selon l'état : « Révéler les votes » pour un tour caché, « Nouveau tour » pour un tour révélé. En bouton secondaire : « Effacer les votes » pour un tour caché, « Masquer » pour un tour révélé. « Nouveau tour » et « Effacer les votes » déclenchent tous deux l'action **effacer** (FR-15). « Révéler les votes » reste actif même si tout le monde n'a pas voté (FR-12). Aucune confirmation n'est demandée (FR-15). **Protection contre les clics croisés (FR-17) :** chaque bouton envoie une intention précise (« révéler », « masquer » ou « effacer »), et une intention déjà satisfaite ne fait rien. Par exemple, « révéler » sur un tour déjà révélé n'a aucun effet. Après un changement d'état fait par un autre participant, les boutons de la barre d'action restent inactifs pendant 1 s, pour qu'un clic parti trop tôt ne tombe pas sur le nouveau bouton. Ils restent aussi inactifs pendant 1 s après mon propre clic : le second clic d'un double-clic ne tombe pas sur le bouton relibellé (« Masquer » devenu « Effacer les votes »). |
| **Panneau de résultat** (`result-panel`, `consensus-badge`) | Session, tour révélé | Il affiche (FR-14) la moyenne et le badge « Consensus ! » s'il y a consensus. Il affiche aussi **la valeur la plus votée** avec son nombre de votes, **la valeur minimale** et **la valeur maximale**. Tous ces chiffres ne portent que sur les votes numériques : `?` et `☕` sont exclus. En cas d'égalité pour la plus votée, toutes les valeurs à égalité sont listées, par exemple « 5 et 8 · 3 votes chacune ». S'il n'y a aucun vote numérique, le panneau affiche seulement « Pas de résultat chiffré ». |
| **Bouton « Copier le lien »** (`copy-link-button`) | Barre du haut, Session vide | Copie le lien de session en un clic (FR-1). Le libellé devient « Lien copié » pendant 2 s. Sur téléphone, il ouvre le menu de partage du téléphone si le navigateur le permet, et copie le lien sinon. |
| **Menu du participant** (`participant-menu`) | Barre du haut | Il affiche mon pseudo. Il permet de basculer entre « Je vote » et « J'observe » (FR-5) et de choisir le thème : automatique, clair ou sombre. |
| **Bandeau d'état** (`status-banner`) | Session, sous la barre du haut | Il n'apparaît que pendant « Reconnexion… » (FR-7). Il disparaît dès que la connexion revient. Il ne bloque jamais la table. |
| **Écran d'état** (`state-screen`) | Réveil du serveur, Session introuvable | Un titre, un texte, et au plus un bouton principal. Il n'y a pas d'autre action. |

## State Patterns

| État | Écran | Affichage |
|---|---|---|
| Chargement de la session | Session | Juste après Accueil, Rejoindre ou un rafraîchissement, la barre du haut s'affiche aussitôt. La table montre des places vides en attente, sans pseudo, jusqu'à la réception de l'état, en moins d'une seconde en temps normal. Il n'y a pas de sablier plein écran. |
| Session vide | Session | Il n'y a aucun autre participant que moi. La barre d'action est masquée. La table affiche « Partage le lien pour inviter ton équipe », et « Copier le lien » y devient le seul bouton principal. La barre d'action réapparaît dès qu'un autre participant arrive, et cet état revient si tous les autres partent. Si les autres participants sont tous observateurs (M = 0), la barre d'action reste visible et le compteur affiche « Aucun votant ». |
| Tour caché, personne n'a voté | Session | Toutes les places ont une carte vide. Le compteur affiche « 0 vote sur M ». « Révéler les votes » est actif. |
| Tour caché, votes en cours | Session | Une place prend le dos de carte dès que son participant vote. Le compteur se met à jour en moins d'une seconde (FR-16). |
| Tour révélé | Session | Les cartes se retournent (voir Interaction Primitives), puis le panneau de résultat apparaît. Une place sans vote affiche « n'a pas voté » (FR-12). |
| Consensus | Session | Badge vert « Consensus ! », seulement quand tous les votes numériques sont identiques, avec au moins deux votes numériques (FR-14). Le minimum et le maximum sont alors égaux. |
| Tour révélé, écart | Session | Le minimum et le maximum montrent immédiatement l'écart à discuter, par exemple « Min 3 · Max 13 ». Les votants concernés se repèrent sur la table grâce aux faces visibles. |
| Tour caché après masquage | Session | Même affichage qu'un tour caché. Les cartes des votants redeviennent modifiables (FR-13). |
| Arrivée pendant un tour révélé | Session | La personne voit directement les faces et le résultat. Sa main est grisée et sa place porte la mention « votera au prochain tour » jusqu'à ce que le tour redevienne caché, par un masquage ou un effacement : elle peut alors voter. Il en va de même pour un observateur qui passe votant pendant un tour révélé (FR-5). |
| Participant déconnecté | Session | Son pseudo passe en `{colors.muted-foreground}`, avec une pastille grise (`presence-dot`) et le libellé « déconnecté », et sa carte reste en place. Sa place disparaît au bout de 5 minutes de déconnexion (FR-9). |
| Reconnexion en cours (moi) | Session | Après 2 s de coupure (pour ne pas clignoter sur une micro-coupure), bandeau ambre « Reconnexion… » (`status-banner`, FR-7). La table reste visible, mais les actions sont désactivées jusqu'au retour de la connexion. |
| Session disparue ou expirée | Session introuvable | Titre « Cette session n'existe plus. », texte « Elle a peut-être expiré, ou le serveur a redémarré. », puis bouton principal « Créer une session » (FR-3, FR-7). |
| Retour après une longue absence | Session | Téléphone rallumé ou réseau revenu, même au-delà de 5 min : le participant est remis à sa place automatiquement, en passant simplement par « Reconnexion… », sans écran intermédiaire (FR-7, FR-9). Rester inactif ou laisser l'onglet en arrière-plan ne déconnecte jamais. |
| Pseudo repris ailleurs | Rejoindre | Écran Rejoindre avec le pseudo pré-rempli, et le message « Ta place a été reprise depuis un autre appareil. » (FR-7, FR-8) |
| Pseudo vide | Accueil, Rejoindre | Le bouton « Créer une session » ou « Rejoindre » reste inactif, sans message d'erreur. |
| Envoi en cours | Accueil, Rejoindre | Le bouton affiche « Connexion… » et devient inactif. Le champ reste lisible. |
| Échec réseau à l'envoi | Accueil, Rejoindre | Le message « Impossible de joindre le serveur. » s'affiche sous le bouton, avec une icône. La saisie est conservée, et le bouton redevient actif pour réessayer. |
| Pseudo refusé | Rejoindre | Message sous le champ : « Ce pseudo est déjà pris dans cette session. » La comparaison ignore les majuscules et les espaces en début et en fin (FR-2). |
| Trop de sessions ouvertes | Accueil | Le serveur refuse la création, parce que le plafond de sessions en mémoire est atteint (story 2.6). Message sous le bouton : « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. » La saisie est conservée, et le bouton redevient actif. |
| Trop de créations depuis le même réseau | Accueil | Le serveur refuse la création, parce que trop de sessions ont été créées depuis la même adresse en une minute (story 2.6). Message sous le bouton : « Trop de sessions créées depuis ton réseau. Patiente une minute. » La saisie est conservée. |
| Session complète | Rejoindre | Le serveur refuse l'arrivée, parce que la session a atteint son plafond de participants (story 2.6). Message sous le champ : « Cette session est complète. » La saisie est conservée. |
| Réveil du serveur (0 à 3 min) | Réveil du serveur | Petite animation de cartes qui se battent, texte « Réveil du serveur… Ça peut prendre jusqu'à 2 minutes. » (NFR-2). |
| Serveur indisponible (au-delà de 3 min) | Réveil du serveur | Texte « Le serveur ne répond pas. », bouton principal « Réessayer » (NFR-2). |

## Interaction Primitives

- **Toucher ou cliquer d'abord.** Toutes les actions se font en un appui. Il n'y a ni glisser-déposer, ni appui long, ni geste caché, ni action qui n'apparaît qu'au survol.
- **Clavier sur PC :** Tab parcourt les éléments dans l'ordre de lecture. Dans la main, les flèches gauche et droite passent d'une carte à l'autre, et Entrée ou Espace choisit la carte.
- **Pas de raccourci clavier pour révéler, masquer ou effacer.** Comme aucune confirmation n'est demandée (FR-15), un raccourci rendrait les fausses manœuvres trop faciles.
- **Révélation animée :** les cartes se retournent l'une après l'autre en environ 400 ms au total. C'est le seul moment mis en scène de l'interface. Si l'utilisateur a demandé à réduire les animations (`prefers-reduced-motion`), les cartes apparaissent sans mouvement.
- **Carte choisie :** elle se soulève en 150 ms. Aucun son, aucune vibration.
- **Temps réel :** tout changement apparaît sans recharger la page (FR-16). Quand un autre participant révèle, masque ou efface, l'état change chez moi sans message d'avertissement. La table suffit à le montrer. Pour éviter qu'un clic croisé efface les votes, les boutons de la barre d'action restent inactifs pendant 1 s après un changement venu d'un autre participant, et après mon propre clic (FR-17, voir Barre d'action).
- **Interdit :** fenêtres modales, confettis, sons, notifications du navigateur.

## Accessibility Floor

Ce sont les règles de comportement. Le contraste visuel est traité dans `DESIGN.md`.

- **Niveau visé :** WCAG 2.2 AA sur tous les écrans.
- Les cartes de la main forment une barre d'outils nommée « Ta carte ». Chaque carte est un bouton bascule (`aria-pressed`) avec un nom accessible (« Carte 5 », « Carte je ne sais pas », « Carte pause café »). Il y en a au plus une enfoncée à la fois, et appuyer sur la carte enfoncée la relâche, ce qui retire le vote. Un seul arrêt de tabulation mène dans la barre ; les flèches passent ensuite d'une carte à l'autre.
- Une zone `aria-live="polite"` annonce les événements importants : « Votes révélés. Moyenne 5,3. Plus votée 5, 4 votes. Min 3, max 8. », « Nouveau tour », « Sofia a rejoint la session ». Pour éviter une avalanche d'annonces, les votes des autres ne sont pas annoncés un par un : seul le compteur l'est, au plus toutes les 5 s.
- L'information ne passe jamais par la couleur seule. La présence a aussi un libellé (« déconnecté »), et le consensus a un texte.
- Le focus clavier est toujours visible, avec un contour `{colors.primary}`. Après une révélation, le focus reste où il était : il n'y a pas de saut.
- La page s'adapte à un zoom de 200 % et reste utilisable dès 360 px de large sans défilement horizontal (NFR-5).

## Responsive & Platform

| Largeur | Comportement |
|---|---|
| **≥ 900 px (PC)** | **Aucun défilement de page** avec 13 participants, tour révélé compris, dans une fenêtre d'au moins 1280 × 650 px utiles (voir `DESIGN.md`, Layout & Spacing). La table est en grille de 7 places au plus par ligne, donc 13 participants tiennent sur 2 rangées. Le résultat est intégré à la barre d'action, sur une seule rangée sous la table. La main tient sur une ligne de 10 cartes, fixée en bas. Si la fenêtre est moins haute, seule la table défile, dans sa zone ; la barre du haut, la barre d'action et la main restent visibles. |
| **600 à 899 px (tablette, petite fenêtre)** | La table est en grille de 5 places au plus par ligne, et c'est elle seule qui défile si nécessaire. La main reste sur une ligne, avec des cartes plus étroites, mais d'au moins 44 px (NFR-5). |
| **< 600 px (téléphone)** | La barre du haut est compacte : le nom de l'outil devient une icône, « Copier le lien » devient une icône avec son libellé accessible. La table est en grille de 3 places par ligne, et on la fait défiler. La main devient un tiroir fixe en bas, avec 2 lignes de 5 cartes. La barre d'action est placée juste au-dessus du tiroir, pour rester accessible au pouce : le compteur sur une ligne, les deux boutons côte à côte en dessous. Quand le tour est révélé, le tiroir de cartes se replie, et le panneau de résultat, condensé sur une ligne (voir `DESIGN.md`, Components), se place juste au-dessus de la barre d'action. La table récupère ainsi la place libérée. |

Le thème est **automatique par défaut** : il suit le réglage du système. Le menu du participant permet de forcer le thème clair ou sombre, et ce choix est mémorisé dans le navigateur.

## Inspiration & Anti-patterns

- **Repris de Scrum Poker Online :** la disposition générale, avec une table de participants et une rangée de cartes, qui est déjà familière à l'équipe.
- **Ce qu'on améliore :**
  - un seul bouton principal selon l'état, au lieu de plusieurs boutons de même poids ;
  - la main de cartes à portée de pouce sur téléphone ;
  - un compteur « N votes sur M » qui aide à savoir quand révéler ;
  - une révélation animée qui rend le moment agréable ;
  - un thème sombre.
- **Rejeté :** toute publicité ou bannière (NFR-6, NFR-8).
- **Rejeté :** les graphiques et la répartition complète des votes. La valeur la plus votée, le minimum et le maximum suffisent à lancer la discussion (SM-C1).
- **Rejeté :** les confirmations du type « Es-tu sûr ? », parce que l'équipe se fait confiance (PRD §1).
- **Rejeté :** les confettis et les récompenses. Le badge « Consensus ! » suffit.

## Key Flows

Ces flux reprennent les parcours du PRD (§2.2).

### Flux 1 : Eric lance l'affinage du jeudi (UJ-1)

1. Eric ouvre l'outil sur son PC et arrive sur l'Accueil. Son pseudo « Eric » est pré-rempli. Il choisit « J'observe », puis « Créer une session ».
2. Il arrive sur la table, seul. Le message « Partage le lien pour inviter ton équipe » l'invite à cliquer sur « Copier le lien », qui affiche « Lien copié ». Il colle le lien dans le chat de la visio.
3. Les places se remplissent une à une. Eric présente le premier ticket à l'écran partagé.
4. Des dos de carte apparaissent sur la table, et le compteur passe à « 7 votes sur 7 ».
5. Eric clique sur « Révéler les votes ». **Moment clé :** les cartes se retournent l'une après l'autre. La moyenne s'affiche : « 6,3 ». En dessous, on lit « Plus votée 5 · 4 votes », « Min 3 » et « Max 13 ». Les sept votes sont 3, 5, 5, 5, 5, 8 et 13 : il n'y a pas de consensus. Les deux votants du 3 et du 13 s'expliquent.
6. Eric clique sur « Nouveau tour », et l'équipe revote. Cette fois, c'est 5 partout, et le badge « Consensus ! » s'affiche. Eric reporte 5 dans Jira et clique sur « Nouveau tour » pour le ticket suivant.

**En cas d'échec :** si le serveur dormait, Eric voit « Réveil du serveur… » pendant une à deux minutes au lieu d'une erreur, puis l'Accueil apparaît.

### Flux 2 : Sofia vote depuis son téléphone et perd le réseau (UJ-2)

1. Sofia ouvre le lien sur son téléphone. L'écran Rejoindre a déjà « Je vote » sélectionné. Elle tape « Sofia » et appuie sur « Rejoindre ».
2. La table s'affiche, avec le tiroir de cartes sous son pouce. Elle appuie sur « 8 », et la carte se soulève.
3. Son wifi tombe. Le bandeau ambre « Reconnexion… » apparaît, et la table reste visible.
4. **Moment clé :** trente secondes plus tard, le bandeau disparaît de lui-même. Sa carte « 8 » est toujours soulevée : rien n'a été perdu.

**En cas d'échec :** si elle rouvre le lien sur son PC alors que son téléphone est encore connecté, elle voit « Ce pseudo est déjà pris dans cette session. » Elle ferme l'onglet du téléphone. Son participant apparaît déconnecté, elle réessaie sur son PC avec « Sofia » et reprend sa place avec son vote « 8 » (FR-8).

### Flux 3 : Karim lance la session à la place d'Eric (UJ-3)

1. Karim ouvre l'outil et arrive sur l'Accueil. Rien ne distingue « celui qui crée » des autres.
2. Il tape « Karim », choisit « Je vote », puis « Créer une session ». Il copie le lien et le partage.
3. **Moment clé :** l'atelier se déroule exactement comme d'habitude. Karim n'a eu besoin d'aucune autorisation. Au même moment, une autre équipe utilise sa propre session sans que les deux sessions se croisent.
