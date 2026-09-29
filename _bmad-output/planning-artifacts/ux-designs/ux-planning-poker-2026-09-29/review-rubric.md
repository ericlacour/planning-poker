# Revue des spines — planning-poker

## Verdict global
**Adéquat.** La paire est compacte, bien ordonnée, fidèle au PRD, et un consommateur peut en extraire l'essentiel sans deviner : les trois parcours, tous les jetons de couleur en paire clair/sombre, les libellés fixes et la plupart des états. Il n'y a aucun défaut critique. En revanche, quatre points à fort impact sont à corriger avant de passer en `final` : une course entre actions simultanées que le bouton principal rend dangereuse (FR-17), la convention `-dark` qui casse la carte (toujours claire) en thème sombre, plusieurs composants de EXPERIENCE sans spec visuelle dans DESIGN, et le budget vertical du téléphone en tour révélé.

Les décisions consignées dans `.memlog.md` (tutoiement, « Nouveau tour » / « Effacer les votes », rouge de marque, vraies cartes, panneau de résultat enrichi, pas de raccourci, pas de modale) sont traitées comme délibérées et ne sont pas relevées comme défauts.

## 1. Couverture des flux — adéquat
Vérifié : UJ-1, UJ-2 et UJ-3 (PRD §2.2) ont chacun un flux (EXPERIENCE l.136-160) avec un protagoniste nommé, des étapes numérotées et un **Moment clé**. Un chemin d'échec est donné pour UJ-1 (réveil du serveur) et UJ-2 (pseudo pris). UJ-3 n'en a pas besoin. J'ai aussi vérifié FR-1 à FR-17 : chacun est couvert par au moins un flux, un composant ou un état, **sauf FR-17**.

### Constats
- **high** FR-17 (actions simultanées) n'apparaît nulle part : ni flux, ni état, ni règle. Le risque est aggravé par un choix de conception : le bouton principal change de sens **à la même place** (« Révéler les votes » devient « Nouveau tour », EXPERIENCE l.62). Si deux personnes cliquent sur « Révéler » presque en même temps, ou si un clic part au moment où la révélation d'un autre arrive (l.94 : changement sans avertissement), le clic tombe sur « Nouveau tour » et **efface tous les votes**. C'est aussi une question d'architecture, puisqu'elle détermine si les actions sont des bascules ou des intentions. *Correction :* s'engager sur deux règles. (1) Chaque bouton envoie une intention nommée (`révéler`, `masquer`, `effacer`), et une intention déjà satisfaite ne fait rien : révéler un tour déjà révélé est sans effet. (2) Après un changement d'état venu d'un autre participant, le bouton principal reste inactif environ 1 s. Ajouter une ligne d'échec au Flux 1 ou un état « Action simultanée ».
- **medium** Rien ne dit que « Nouveau tour » déclenche l'action **effacer** (FR-15). Le PRD, UJ-1 l.42, écrit « Eric clique sur **Effacer** », alors que le Flux 1, étape 6 (l.143), dit « Nouveau tour ». Le libellé est une décision validée, mais la correspondance n'est pas écrite (EXPERIENCE l.62). *Correction :* dans la ligne Barre d'action, ajouter : « "Nouveau tour" (révélé) et "Effacer les votes" (caché) déclenchent tous deux l'action effacer (FR-15). »
- **low** Les chiffres d'exemple du Flux 1, étape 5 (l.142), sont impossibles. Avec 7 votes dont quatre 5, un 3 et un 13, le septième vote ne peut pas donner une moyenne de 6,4 : on obtient 6,3 avec un 8, 7,0 avec un 13, et 6,0 avec un `?`. Les stories et les tests reprendront ces valeurs. *Correction :* donner la distribution complète, par exemple 3, 5, 5, 5, 5, 8, 13, soit une moyenne de 6,3.
- **low** Le cas limite de UJ-2 s'arrête à « réessaie » (l.154). La reprise réussie (FR-8), où Sofia retrouve son « 8 » sur son PC, n'est pas montrée. FR-5 (changer de rôle) et FR-13 (masquer) n'ont pas de flux, mais les états suffisent pour eux. *Correction :* ajouter une phrase au chemin d'échec du Flux 2 : « …elle rejoint avec "Sofia" et retrouve sa carte 8 ».

## 2. Complétude des jetons — adéquat
Vérifié : 20 jetons de couleur clairs et 20 sombres, tous en hexadécimal et tous appariés. Les 8 styles typographiques, les 5 rayons et les 10 espacements sont définis. Toutes les références `{…}` des composants du frontmatter et de la prose (DESIGN et les deux `{colors.primary}` de EXPERIENCE) sont résolues. J'ai recalculé les contrastes des couples porteurs : la plupart passent. Les marges sont faibles pour `muted-foreground`/`surface-muted` (4,55:1) et pour `card-back`/`background` (3,08:1).

### Constats
- **high** La convention du suffixe `-dark` (DESIGN l.190) casse la carte à jouer, qui reste claire en thème sombre (memlog, `card-face-dark #F4F1EC`). Appliquée mécaniquement : `innerFrame {colors.primary-soft}` devient `#3A2226`, soit un liseré brun foncé sur une carte claire, l'inverse de l'intention (l.131). La bordure de sélection et de survol `{colors.primary}` devient `#F28B8F` sur `#F4F1EC`, soit **2,1:1**, sous le seuil de 3:1 pour un élément graphique (l.140, l.252). C'est l'indicateur « ma carte ». *Correction :* définir des jetons propres à la carte qui ne changent pas avec le thème (`card-frame`, `card-selected-border`), ou écrire que les composants carte utilisent les jetons clairs dans les deux thèmes. Par exemple, une bordure de sélection sombre `#B8323D` donne environ 5:1 sur la face.
- **medium** Un participant déconnecté est affiché « à 50 % d'opacité » (DESIGN l.259, EXPERIENCE l.78). Le pseudo (`label`, 14 px) passe alors à environ **3,2:1** sur `surface`, sous le 4,5:1 exigé, ce qui contredit l'affirmation « tous les couples texte/fond respectent AA » (l.201). *Correction :* mettre le pseudo en `{colors.muted-foreground}`, afficher « déconnecté » en clair, et n'appliquer l'opacité qu'à la carte.
- **medium** DESIGN l.262 prévoit une variante `{colors.danger}` du bandeau d'état « pour un état définitif », sans fond ni texte appariés (pas de `danger-soft`). EXPERIENCE l.66 dit pourtant que le bandeau n'apparaît **que** pendant « Reconnexion… ». *Correction :* supprimer la variante, ou la justifier par un cas d'usage et ajouter `danger-soft` / `danger-soft-dark`. Préciser aussi que l'erreur sous le champ utilise `{colors.danger}` avec une icône.
- **medium** La hauteur de soulèvement de la carte choisie est contradictoire : 8 px dans Elevation & Depth (l.235), mais 12 px dans le frontmatter (`lift: '-12px'`, l.141), dans Components (l.252) et dans le memlog. *Correction :* aligner l.235 sur 12 px.
- **low** Les contrastes sont déclarés « vérifiés » sans liste des couples (l.201). *Correction :* ajouter un petit tableau des couples porteurs et de leurs ratios, pour que l'architecture puisse les tester en régression.
- **low** Elevation ne donne aucun jeton d'ombre (« très légère », « plus marquée »), et la largeur de 400 px des écrans à une colonne (l.229) est écrite en dur. *Correction :* ajouter `shadow-panel`, `shadow-lifted`, `shadow-drawer` et `spacing.panel-narrow: 400px`.

## 3. Couverture des composants — mince
Vérifié : DESIGN décrit `poker-card`, `poker-card-selected`, `seat-card-back/empty/face`, `presence-dot`, `button-primary/secondary`, `result-panel`, `consensus-badge` et `status-banner`. EXPERIENCE décrit Formulaire d'entrée, Main de cartes, Table des participants, Barre d'action, Panneau de résultat, Bouton « Copier le lien », Menu du participant et Bandeau d'état. Les comportements sont réels et précis. Le côté visuel est incomplet.

### Constats
- **high** Plusieurs composants de EXPERIENCE n'ont **aucune spec visuelle** dans DESIGN.Components (l.250-262). C'est le cas du Formulaire d'entrée (champ, groupe « Je vote / J'observe » en boutons segmentés ou en radios, message d'erreur), du Menu du participant (déclencheur, forme ouverte sans modale, sélecteur de thème à 3 choix), du Bouton « Copier le lien » (variante, version icône sur téléphone), de la Barre du haut, de la Barre d'action (disposition du compteur et des boutons) et des écrans Session introuvable et Réveil du serveur (animation « cartes qui se battent », EXPERIENCE l.83). Il manque aussi le message « Partage le lien… » et le bloc « Tu observes / Je veux voter ». Sans ces specs, story-dev inventera les visuels. *Correction :* ajouter une puce courte par composant, avec ses références de jetons, et au besoin ses entrées `components:` dans le frontmatter.
- **medium** Les noms des composants diffèrent d'un fichier à l'autre : « Carte de la main », « Place d'un participant » et « Dos de carte » dans DESIGN, contre « Main de cartes » et « Table des participants » dans EXPERIENCE. EXPERIENCE ne cite jamais les identifiants (`poker-card`, `seat-card-*`). *Correction :* retenir un nom canonique par composant, avec son identifiant entre parenthèses, et l'utiliser à l'identique dans les deux fichiers.
- **medium** Le motif d'accessibilité de la main est incohérent. « Groupe de boutons à choix unique » (l.102), des flèches qui déplacent le focus sans choisir (l.90) et un second appui qui **retire** le vote (l.60) ne correspondent pas à un `radiogroup` : une radio ne se décoche pas, et les flèches y sélectionnent. *Correction :* choisir des boutons bascule (`aria-pressed`) dans un `role="group"` avec un tabindex mobile, et l'écrire.
- **low** Les mentions « n'a pas voté » (tour révélé), « observe » et « (toi) » n'ont pas de traitement visuel. `seat-card-empty` ne couvre que le tour caché (DESIGN l.255, l.259 ; EXPERIENCE l.61, l.74). *Correction :* préciser le style de chacune, par exemple en `label` et `muted-foreground`.

## 4. Couverture des états — adéquat
Vérifié par écran. **Accueil** et **Rejoindre** : seul le pseudo refusé est couvert. **Session** : caché vide, votes en cours, révélé, consensus, écart, masqué, déconnecté, reconnexion, session vide et reprise ou retrait sont couverts. **Session introuvable** est couvert. **Réveil du serveur** : 0-60 s et au-delà de 60 s sont couverts. La table d'états est dense et utile, mais il reste des trous.

### Constats
- **high** Le budget vertical du téléphone en tour révélé ne tient pas (EXPERIENCE l.114, DESIGN l.225). Tout s'empile en position fixe : barre du haut, panneau de résultat, barre d'action sur 2 lignes et tiroir de 2 × 5 cartes. À 360 px de large, une carte fait environ 59 × 88 px, donc le tiroir occupe à lui seul environ 200 px. Sur un écran d'environ 560 px de hauteur utile, il reste moins d'une rangée pour la table. L'addendum exige pourtant que la liste des participants reste consultable. Or la main est inactive quand le tour est révélé. *Correction :* décider qu'en tour révélé, le tiroir se replie (sur une ligne ou masqué) et laisse sa place au panneau de résultat, puis qu'il revient au tour suivant.
- **medium** Le chargement initial de Session (après un rafraîchissement, FR-7, ou juste après Rejoindre, avant de recevoir l'état) n'a aucun traitement. *Correction :* ajouter une ligne avec un squelette de table, la main inactive, et une durée maximale avant de basculer en « Reconnexion… ».
- **medium** L'arrivée d'un participant, ou son passage de observateur à votant, **pendant un tour révélé** (FR-2 l.93, FR-5 l.105) n'est pas couverte. On ne sait pas ce que montrent sa main et sa place, ni s'il compte dans M ou apparaît comme « n'a pas voté ». *Correction :* ajouter un état : main grisée avec « Tu voteras au prochain tour », place sans carte, exclu de M et de « n'a pas voté ».
- **medium** Accueil et Rejoindre n'ont pas d'états de saisie ni d'envoi : pseudo vide ou fait seulement d'espaces, envoi en cours, échec réseau à la création ou au moment de rejoindre, session expirée entre l'ouverture du lien et la validation. Par ailleurs, « Pseudo refusé » est indiqué pour l'Accueil (l.82), ce qui est impossible puisque la session y est neuve. *Correction :* ajouter ces lignes et retirer Accueil de « Pseudo refusé ».
- **low** Plusieurs cas limites manquent. Un votant qui passe observateur pendant un tour caché perd son vote (FR-5) : le dire explicitement, sans confirmation, par cohérence. On ne sait pas si l'état « Session vide » revient quand les autres partent (l.85 ne décrit que l'apparition). Le compteur n'est pas défini quand M = 0 (seulement des observateurs). Aucun délai n'évite que le bandeau « Reconnexion… » clignote sur une micro-coupure. *Correction :* une phrase par cas dans State Patterns.

## 5. Couverture des références visuelles — mince
Vérifié : `mockups/` contient `session-pc.html`, `session-telephone.html`, `rejoindre.html` et `etats.html`. Les quatre sont cités, il n'y a donc pas d'orphelin. La règle « en cas de conflit, ce document fait foi » est posée une fois (EXPERIENCE l.33). Le contenu visuel des maquettes n'a pas été revu, comme demandé.

### Constats
- **medium** Les quatre maquettes sont citées dans une seule ligne (EXPERIENCE l.33), sans dire ce que chacune illustre. DESIGN.md n'en cite aucune. *Correction :* placer chaque lien à l'endroit utile : `session-pc.html` sous DESIGN Layout & Spacing et Components, `session-telephone.html` sous EXPERIENCE Responsive & Platform, `rejoindre.html` sous le Formulaire d'entrée, et `etats.html` sous State Patterns, en listant les états qu'elle montre.
- **low** L'écran Accueil n'a pas de maquette. *Correction :* écrire que `rejoindre.html` vaut aussi pour l'Accueil, puisque les deux écrans ont la même colonne de 400 px, ou le signaler comme absent.

## 6. Surcharge et sur-spécification — solide
Les deux fichiers sont courts, et chaque section porte une décision. Il n'y a ni prose décorative ni valeurs inutiles.

### Constats
- **low** La disposition du téléphone (2 × 5, barre d'action) est décrite deux fois : DESIGN l.222-229 et EXPERIENCE l.114. Les libellés du panneau de résultat le sont aussi (DESIGN l.261 et EXPERIENCE l.63). Deux sources de vérité finiront par diverger. *Correction :* garder la géométrie dans DESIGN et le comportement dans EXPERIENCE, avec un renvoi de l'un à l'autre.

## 7. Discipline d'héritage — adéquat
Vérifié : les trois sources (PRD, addendum, brief) existent. Les titres des flux reprennent mot pour mot UJ-1 à UJ-3. Les termes du glossaire (session, participant, votant, observateur, tour, révéler, masquer, effacer, présence, moyenne, consensus) sont employés correctement. Les références de jetons sont résolues.

### Constats
- **medium** Des marqueurs `[ASSUMPTION]` restent dans un document contrat. DESIGN l.178 qualifie la direction visuelle de « à valider », alors que le memlog montre qu'Eric l'a tranchée (rouge, vraies cartes). EXPERIENCE l.64 (partage natif sur téléphone) et l.103 (cadence des annonces `aria-live`) portent aussi ce marqueur. Pour un consommateur, une hypothèse est une décision non prise. *Correction :* retirer le marqueur de l.178, et trancher ou valider explicitement les deux autres.
- **low** « Tour masqué » (EXPERIENCE l.77) n'est pas un terme du glossaire : après masquer, le tour redevient **caché**. « Place » est un terme d'interface nouveau, jamais défini. *Correction :* renommer l'état en « Tour caché après masquage » et définir « place » dans Foundation.
- **low** Le libellé du badge diffère : « Consensus » dans DESIGN (l.248, l.261), « Consensus ! » dans EXPERIENCE (l.43, l.63, l.75). *Correction :* aligner DESIGN sur « Consensus ! », qui est le libellé fixe.

## 8. Adéquation de forme — solide
Vérifié : les sections de DESIGN sont dans l'ordre canonique (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts). EXPERIENCE contient toutes les sections par défaut (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows), ainsi que Responsive & Platform et Inspiration & Anti-patterns, qui sont justifiées.

### Constats
- **low** Le frontmatter de EXPERIENCE n'a pas de `name`, contrairement aux exemples, et les deux fichiers sont en `status: draft`. *Correction :* ajouter `name` et passer à `final` une fois les constats high traités.

## Notes mécaniques
- **Soulèvement :** 8 px (DESIGN l.235) contre 12 px (l.141, l.252).
- **Badge :** « Consensus » (DESIGN) contre « Consensus ! » (EXPERIENCE).
- **Noms de composants non alignés :** Carte de la main / Main de cartes ; Place d'un participant / Table des participants. Les identifiants `poker-card` et `seat-card-*` sont absents de EXPERIENCE.
- **Correspondance non écrite :** « Nouveau tour » correspond à l'action effacer (FR-15). Le PRD UJ-1 dit « Effacer ».
- **Bandeau d'état :** la variante `danger` (DESIGN l.262) n'a pas d'usage dans EXPERIENCE (l.66) et pas de fond apparié.
- **État impossible :** « Pseudo refusé » est indiqué pour l'Accueil (EXPERIENCE l.82).
- **Arithmétique :** moyenne « 6,4 » impossible avec la distribution partielle du Flux 1 (l.142).
- **Frontmatter :** EXPERIENCE n'a pas de `name`. Les deux fichiers sont en `status: draft`. Les chemins `sources` sont tous résolus.
- **Marqueurs restants :** `[ASSUMPTION]` en DESIGN l.178, EXPERIENCE l.64 et l.103.
- **Formulation ambiguë :** IA l.29, « jusqu'à 30 s, puis Indisponible… au-delà de 60 s ». Il faut préciser que l'attente continue de 30 à 60 s.
