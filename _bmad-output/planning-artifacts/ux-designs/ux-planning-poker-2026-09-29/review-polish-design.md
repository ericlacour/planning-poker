# Passe de finition : DESIGN.md

- **Fichier :** `DESIGN.md` (spine UX, planning-poker)
- **Date :** 2026-09-29
- **Méthode :** `skill:bmad-review lenses=structure,prose`, dans cet ordre. La lentille prose s'appuie sur les constats de la lentille structure. S'y ajoutent les constats **low** et les notes mécaniques de `review-rubric.md` qui concernent DESIGN.md.
- **Référentiel :** `design-md-spec.md`, Microsoft Writing Style Guide (adapté au français), lecteur : humains.
- **Lecture de l'objectif :** ce document sert aux développeurs et à l'architecte pour reproduire l'identité visuelle sans avoir à la deviner (jetons, rôle de chaque couleur, anatomie des composants).
- **Modèle de structure :** Référence (accès direct, sections MECE et à schéma constant), dans l'ordre canonique de la spec.

## Garde-fous respectés

- Aucune valeur de jeton modifiée : le frontmatter (lignes 1 à 206) est identique octet pour octet.
- Aucune décision, aucun libellé d'interface entre guillemets, aucun nom de jeton ou de composant modifié.
- `title`, `status` et `sources` sont inchangés. EXPERIENCE.md n'a pas été touché.
- L'ordre canonique est conservé : Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts.
- Renvois `{path.to.token}` : vérification automatique avant et après la passe. **0 renvoi cassé.**

## Corrections appliquées

| Passe | Emplacement | Avant | Après | Motif |
|---|---|---|---|---|
| structure | Components | Liste plate de 10 puces, dans un ordre sans logique | 3 sous-sections (Cartes, Écran de session, Écrans à une colonne) et une phrase d'introduction. L'écran de session suit l'ordre de haut en bas du Layout. | L'ordre de lecture suit la structure de l'écran. Les cartes restent en tête, car les places y renvoient. |
| structure | Components › Bouton principal | Puce isolée entre Place et Panneau de résultat | Sous-puce de la Barre d'action (MOVE) | Le texte dit lui-même qu'il vit « dans la barre d'action ». |
| structure | Components › Panneau de résultat sur téléphone | Puce sœur du panneau | Sous-puce « Sur téléphone » du panneau (MERGE) | Il s'agit d'une variante du même composant, pas d'un composant distinct. |
| structure | Components › `poker-card-selected` | Noyé au milieu de la puce `poker-card` | Sous-puce dédiée (CONDENSE) | Rend l'état sélectionné repérable. La phrase « `?` et `☕`… » remonte dans la description de la carte. |
| structure | Components › Place › dos | « dos rouge clair à croisillons avec une marge blanche, comme au dos d'un jeu de cartes » | « le dos de carte décrit ci-dessus » (CONDENSE, environ −12 mots) | Redondance exacte avec la puce Dos de carte : une seule source de vérité. |
| structure | Colors › Rouge de marque | Les phrases sur `card-frame` terminaient la puce du rouge | Nouvelle puce **Liseré des cartes** (MOVE) | Chaque couleur a son rôle propre (spec : « per-color story »). |
| structure | Layout & Spacing | La disposition téléphone est décrite dans DESIGN et dans EXPERIENCE, sans lien entre les deux (rubric, §6, low) | Paragraphe de renvoi : DESIGN fixe la géométrie, et `EXPERIENCE.md` › Responsive & Platform le comportement | Évite deux sources de vérité qui divergeraient. |
| prose | Colors › card-frame | « Les cartes restant claires en thème sombre, il a une version sombre qui reste claire » | « Comme les cartes restent claires en thème sombre, sa version sombre, `{colors.card-frame-dark}`, reste claire elle aussi. » | Participe ambigu, antécédent de « il » flou |
| prose | Layout | « sont faits d'une seule colonne » | « tiennent en une seule colonne » | Tournure plus idiomatique |
| prose | poker-card | « en `{typography.card-value}` et couleur `{colors.card-ink}` » | « en `{typography.card-value}` et en `{colors.card-ink}` » | Construction parallèle |
| prose | poker-card-selected | « la face reste blanche, un contour épais l'entoure, et elle se soulève » / « au moins 3:1 contre la face claire » | « la carte garde sa face blanche, s'entoure d'un contour épais et se soulève » / « un contraste d'au moins 3:1 sur la face claire » | Sujet unique ; « contre » est un calque de l'anglais *against*. |
| prose | Dos de carte | « il a une marge blanche, puis un motif… Ce n'est pas un dégradé, et il est donc autorisé. » | « une marge blanche entoure un motif… Ce motif n'est pas un dégradé : il est donc autorisé. » | L'antécédent est explicite et le lien logique est porté par les deux-points. |
| prose | Place › vide / face | « bordure en pointillés, le participant n'a pas encore voté » ; « avec la mention … en label et muted-foreground sous la carte » | Deux phrases distinctes ; « sous la carte » placé avant le style | Même schéma pour les trois aspects ; le complément n'est plus séparé de son nom. |
| prose | Barre du haut | Dernière phrase de 45 mots | Scindée en deux phrases | Lisibilité |
| prose | Formulaire d'entrée | « Champ bordé…, qui passe… avec le message et une icône « ! » dessous » ; « remplie en `primary-soft` » | « Le champ est bordé de… Sa bordure passe… ; le message d'erreur s'affiche alors dessous, avec une icône « ! ». » ; « a un fond `primary-soft` » | Le sujet de « passe » est ambigu (champ ou bordure). |
| prose | Panneau de résultat | « trois chiffres côte à côte… chacun » | « trois valeurs côte à côte… chacune » | « Plus votée » affiche une valeur et un nombre de votes, et pas un seul chiffre. |
| prose | Écran d'état | « Pour le réveil, trois dos… Pour une erreur, une icône. Ensuite vient le titre… » | « En haut, trois dos de carte animés pour le réveil, ou une icône pour une erreur. Viennent ensuite… » | Phrases nominales hachées, ordre vertical explicite |
| prose | Maquettes | « Maquettes de référence, où ce document fait foi en cas de conflit : » | « Maquettes de référence (en cas de conflit, ce document fait foi) : » | « où » avait un antécédent erroné. |

### Conservé délibérément (PRESERVE)

- **Colors › « À éviter »**, qui recoupe la 1re ligne de Do's and Don'ts : c'est un rappel utile, et la spec demande de dire à quoi chaque couleur *ne sert pas*.
- **Liste des maquettes en fin de Components** : elle est déjà ventilée par usage.

### Bilan chiffré

- 7 corrections de structure, 11 corrections de prose et 0 renvoi cassé, soit 18 corrections.
- Volume : 2 535 → 2 615 mots (+3 %). La hausse vient des intertitres, de la phrase d'introduction de Components et du renvoi vers EXPERIENCE. Elle est compensée en partie par la suppression de la description du dos en double. Aucun objectif de longueur n'était fixé.
- Compromis de compréhension : aucun. Aucune coupe ne retire de contenu.

## À arbitrer (touche au fond : non appliqué)

1. **Libellé du badge** (rubric §7, low, et notes mécaniques) : DESIGN écrit « Consensus » dans Shapes et dans Components › Panneau de résultat, mais « Consensus ! » dans la variante téléphone. EXPERIENCE retient « Consensus ! ». Le libellé est entre guillemets, donc je ne l'ai pas modifié. *Proposition :* aligner les deux occurrences sur « Consensus ! ».
2. **Tableau des contrastes** (rubric §2, low) : ajouter les couples porteurs et leurs ratios pour les tests de régression. Il faut calculer et valider de nouvelles données.
3. **Jetons d'ombre et largeur des panneaux** (rubric §2, low) : `shadow-panel`, `shadow-lifted`, `shadow-drawer` et `spacing.panel-narrow: 400px`, qui remplacerait les `400px` en dur dans `entry-form` et `state-screen`. Ces jetons n'existent pas encore et restent à créer.
4. **Style des mentions de place** (rubric §3, low) : « n'a pas voté » (tour révélé), « observe » et « (toi) » n'ont pas de style défini. *Proposition :* `{typography.label}` et `{colors.muted-foreground}`.
5. **Accueil sans maquette** (rubric §5, low) : déclarer que `mockups/rejoindre.html` vaut aussi pour l'Accueil, ou signaler que la maquette manque.
6. **Provenance dans Brand & Style** (constat de structure) : « proposé par Claude puis ajusté par Eric sur les maquettes » et « choisi par Eric » relèvent de l'historique des décisions (`.memlog.md`) plutôt que du contrat visuel. *Proposition :* retirer ces mentions, ou les garder volontairement.
7. **Identifiant du dos de carte** : la puce « Dos de carte » n'a pas d'identifiant, alors que ce motif sert aussi au logo de la barre du haut et à l'animation de réveil. Il faut choisir entre réutiliser `seat-card-back` et créer un composant `card-back`.
8. Hors périmètre de cette passe : `status: draft` → `final` (le frontmatter reste inchangé, conformément à la consigne).
