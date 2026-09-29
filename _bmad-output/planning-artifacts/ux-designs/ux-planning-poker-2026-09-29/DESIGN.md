---
title: "DESIGN : Planning Poker pour ateliers d'affinage"
status: final
created: 2026-09-29
updated: 2026-09-29
sources:
  - _bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/prd.md
  - _bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-planning-poker-2026-09-29/brief.md
name: Planning Poker (nom provisoire)
description: Outil de planning poker d'équipe, sans publicité, pour les ateliers d'affinage. Il doit être chaleureux sans être austère, et concentré sans être froid. Web responsive, PC et téléphone, thème clair et thème sombre.
colors:
  # Thème clair
  background: '#F6F4F0'
  surface: '#FFFFFF'
  surface-muted: '#EFECE6'
  foreground: '#1F2330'
  muted-foreground: '#646B78'
  border: '#E3DED5'
  primary: '#CF3F4A'
  primary-foreground: '#FFFFFF'
  primary-soft: '#FDECEC'
  card-back: '#E0646C'
  card-back-pattern: '#F4B3B7'
  card-face: '#FFFFFF'
  card-ink: '#CF3F4A'
  card-frame: '#F2C4C7'
  success: '#16754F'
  success-soft: '#E3F4EC'
  warning: '#8A560C'
  warning-soft: '#FBF0DC'
  danger: '#8E2A1E'
  presence-online: '#16754F'
  presence-offline: '#7E8490'
  # Thème sombre
  background-dark: '#14161D'
  surface-dark: '#1D2029'
  surface-muted-dark: '#262A35'
  foreground-dark: '#ECEDF0'
  muted-foreground-dark: '#9CA2AE'
  border-dark: '#2E3340'
  primary-dark: '#F28B8F'
  primary-foreground-dark: '#14161D'
  primary-soft-dark: '#3A2226'
  card-back-dark: '#C9505A'
  card-back-pattern-dark: '#E38A90'
  card-face-dark: '#F4F1EC'
  card-ink-dark: '#B8323D'
  card-frame-dark: '#E3B3B7'
  success-dark: '#42C58E'
  success-soft-dark: '#173A2C'
  warning-dark: '#E3A94B'
  warning-soft-dark: '#3A2E17'
  danger-dark: '#F0A36A'
  presence-online-dark: '#42C58E'
  presence-offline-dark: '#7A8191'
typography:
  # Pile système : aucune police téléchargée (NFR-10, sobriété).
  display:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  title:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  card-value:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 26px
    fontWeight: '700'
    lineHeight: '1'
  card-corner:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
  result-stat:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.2'
  result-value:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  card: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  margin-mobile: 16px
  content-max: 960px
  panel-narrow: 400px
  seat-card-width-pc: 44px
  hand-card-width-pc: 60px
  session-min-height-pc: 650px
  touch-min: 44px
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  poker-card:
    background: '{colors.card-face}'
    foreground: '{colors.card-ink}'
    border: '1px solid {colors.border}'
    innerFrame: '1px solid {colors.card-frame}'
    radius: '{rounded.card}'
    typography: '{typography.card-value}'
    cornerTypography: '{typography.card-corner}'
    minWidth: '{spacing.touch-min}'
    aspectRatio: '2 / 3'
  poker-card-selected:
    background: '{colors.card-face}'
    foreground: '{colors.card-ink}'
    border: '3px solid {colors.primary}'
    borderDark: '3px solid {colors.card-ink-dark}'
    lift: '-12px'
  seat-card-back:
    background: '{colors.card-back}'
    pattern: '{colors.card-back-pattern}'
    radius: '{rounded.card}'
  seat-card-empty:
    background: 'transparent'
    border: '2px dashed {colors.muted-foreground}'
    radius: '{rounded.card}'
  seat-card-face:
    background: '{colors.card-face}'
    foreground: '{colors.card-ink}'
    border: '1px solid {colors.border}'
    radius: '{rounded.card}'
  result-panel:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    valueTypography: '{typography.result-value}'
    statTypography: '{typography.result-stat}'
  consensus-badge:
    background: '{colors.success-soft}'
    foreground: '{colors.success}'
    radius: '{rounded.full}'
  status-banner:
    background: '{colors.warning-soft}'
    foreground: '{colors.warning}'
    radius: '{rounded.md}'
  top-bar:
    background: '{colors.surface}'
    borderBottom: '1px solid {colors.border}'
    height: '56px'
  copy-link-button:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    minHeight: '{spacing.touch-min}'
  participant-menu:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
  entry-form:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    width: '{spacing.panel-narrow}'
    inputBorder: '1px solid {colors.border}'
    inputRadius: '{rounded.sm}'
    errorForeground: '{colors.danger}'
  action-bar:
    counterTypography: '{typography.label}'
    counterForeground: '{colors.muted-foreground}'
    gap: '{spacing.3}'
  state-screen:
    titleTypography: '{typography.display}'
    errorTitleForeground: '{colors.danger}'
    width: '{spacing.panel-narrow}'
  presence-dot:
    online: '{colors.presence-online}'
    offline: '{colors.presence-offline}'
    size: '10px'
---

## Brand & Style

L'outil appartient à l'équipe, et il doit le montrer : **chaleureux sans être austère, concentré sans être froid**. On s'en sert au milieu d'un atelier. Il doit donc s'effacer derrière la discussion, tout en rendant le moment du vote agréable.

L'expression visuelle suit ce principe :
- un fond crème chaud plutôt qu'un blanc clinique ;
- une seule couleur de marque, **un rouge clair**, réservé à ce qui est « à moi » ou « à faire maintenant » ;
- de **vraies cartes à jouer** : face blanche avec la valeur rappelée dans deux coins opposés, et dos rouge à croisillons, comme un jeu de cartes classique ;
- un seul moment de mise en scène : **la révélation**, où les cartes se retournent.

Le reste de l'interface est sobre, pour que l'équipe reste concentrée.

L'outil ne s'appuie sur aucune bibliothèque de composants imposée : le choix reviendra à l'architecture. Les jetons de ce document sont donc des valeurs concrètes. Si l'architecture retient un système de composants, ces jetons en surchargeront les valeurs par défaut.

## Colors

La palette est chaude, avec une seule couleur de marque, et chaque couleur a un rôle. Chaque jeton existe en version claire et en version sombre (suffixe `-dark`).

- **Fonds** (`{colors.background}`, `{colors.surface}`, `{colors.surface-muted}`) : un crème chaud pour la page, du blanc pour les panneaux et les cartes, et un crème plus soutenu pour les zones secondaires comme la main de cartes. En thème sombre, on passe à un bleu nuit, jamais à un noir pur.
- **Rouge de marque** (`{colors.primary}`, et `{colors.card-back}` en version plus claire pour le dos des cartes) : il marque le bouton d'action principal, le contour de **la carte que j'ai choisie**, le dos des cartes posées sur la table, les valeurs imprimées sur les cartes (`{colors.card-ink}`) et les éléments actifs. Il n'est jamais utilisé en décoration.
- **Liseré des cartes** (`{colors.card-frame}`) : il trace le liseré intérieur des cartes. Comme les cartes restent claires en thème sombre, sa version sombre, `{colors.card-frame-dark}`, reste claire elle aussi.
- **Vert** (`{colors.success}`) : il est réservé au **consensus** et à la présence « connecté ». Il ne sert à rien d'autre.
- **Ambre** (`{colors.warning}`) : il est réservé au bandeau « Reconnexion… », sur le fond `{colors.warning-soft}`. Il n'indique jamais une erreur définitive. L'écran « Réveil du serveur… » n'utilise pas l'ambre : son titre est en couleur de texte, et l'animation montre des dos de carte rouges.
- **Rouge brique foncé** (`{colors.danger}`, orangé en thème sombre) : il se distingue du rouge de marque par sa teinte plus sombre, et il est **toujours accompagné d'une icône et d'un texte**. Il signale les erreurs définitives, comme un pseudo refusé, une session introuvable ou un serveur indisponible.
- **Gris de présence** (`{colors.presence-offline}`) : il indique un participant déconnecté.

**À éviter :** les dégradés, un deuxième accent décoratif, et les grandes surfaces pleines de rouge saturé. Le rouge reste clair, et il est surtout porté par les cartes, pour ne pas donner une impression d'alerte.

Tous les couples texte/fond respectent le contraste WCAG AA : 4,5:1 pour le texte courant, 3:1 pour les grands textes et les éléments graphiques. Les ratios ont été vérifiés le 29/09/2026 dans les deux thèmes. Le vert, l'ambre et le gris de présence du thème clair ont été foncés, et le gris de présence du thème sombre éclairci, pour atteindre ces seuils.

## Typography

On utilise uniquement **la police système** du poste (`system-ui`). Aucune police n'est téléchargée : c'est plus sobre (NFR-10) et plus rapide au démarrage.

- `{typography.display}` : titres des écrans d'accueil et d'erreur.
- `{typography.title}` : titres de panneaux, par exemple « Participants » ou « Résultat ».
- `{typography.body}` : texte courant, champs de saisie.
- `{typography.label}` : pseudos, compteurs, boutons.
- `{typography.card-value}` : valeur imprimée sur une carte (0, 1, 2, 3, 5, 8, 13, 21, ?, ☕).
- `{typography.card-corner}` : valeur rappelée dans les coins d'une carte.
- `{typography.result-value}` : la moyenne, affichée en grand dans le résultat.
- `{typography.result-stat}` : la valeur la plus votée, le minimum et le maximum, sous la moyenne.

Les chiffres utilisent des chasses fixes (`font-variant-numeric: tabular-nums`) pour que les valeurs restent alignées. La moyenne est au format français : « 5,3 ».

## Layout & Spacing

On utilise une échelle en multiples de 4 : `{spacing.1}` à `{spacing.7}`. Le contenu est centré, avec une largeur maximale de `{spacing.content-max}`. Sur téléphone, les marges latérales valent `{spacing.margin-mobile}`.

L'écran de session s'organise en trois bandes verticales :
1. **la barre du haut** : nom de l'outil, bouton « Copier le lien », et le menu du participant, qui contient aussi le choix du thème ;
2. **la table** : les participants, chacun représenté par une place avec sa carte posée devant lui. Juste en dessous se trouvent la barre d'action (compteur de votes et boutons) et, une fois les votes révélés, le panneau de résultat ;
3. **la main** : les 10 cartes, fixées en bas de l'écran. Sur PC, elles tiennent sur une ligne. Sur téléphone, elles sont disposées en 2 lignes de 5 cartes, dans un tiroir fixe en bas.

**Sur PC, l'écran Session tient sans défilement.** Avec 13 participants (NFR-4), tour révélé compris, tout doit être visible dans une zone utile de 1280 × `{spacing.session-min-height-pc}`, soit un écran de 1366 × 768 une fois retirée l'interface du navigateur. Ce budget vertical s'obtient ainsi :
- **barre du haut** : 56 px ;
- **table** : au plus 2 rangées de 7 places. Les cartes de la table font `{spacing.seat-card-width-pc}` de large, en proportion 2:3, soit 66 px de haut, et chaque rangée mesure environ 110 px avec le pseudo et la mention ;
- **barre de décision** : environ 72 px. Sur PC, le résultat n'occupe pas un panneau séparé : il prend place **dans la barre d'action**, à gauche des boutons, à la place du compteur (voir Panneau de résultat) ;
- **main** : les cartes font `{spacing.hand-card-width-pc}` de large, soit 90 px de haut, et la main mesure environ 130 px avec le soulèvement de 12 px.

Le total, avec les espacements, reste sous 560 px. Si la fenêtre est moins haute que le budget, seule la table défile, dans sa propre zone. La barre du haut, la barre de décision et la main restent toujours visibles.

Ce document fixe la géométrie. Le comportement du tiroir et de la barre d'action sur téléphone (repli en tour révélé, placement du panneau de résultat) est décrit dans `EXPERIENCE.md`, section Responsive & Platform.

Tout élément sur lequel on peut appuyer mesure au moins `{spacing.touch-min}`, soit 44 × 44 px (NFR-5).

Les écrans **Accueil**, **Rejoindre** et les écrans d'état tiennent en une seule colonne. Sur PC, c'est un panneau centré de `{spacing.panel-narrow}` de large. Le nom de l'outil sert de titre, en `{typography.display}`.

## Elevation & Depth

Le relief reste discret :
- les panneaux posés sur le fond ont une ombre très légère ;
- la carte que j'ai choisie **se soulève** de 12 px avec une ombre plus marquée. C'est le seul endroit où l'ombre porte un sens ;
- sur téléphone, le tiroir de la main a une ombre vers le haut, qui le détache de la table.

En thème sombre, on remplace les ombres par des surfaces un peu plus claires (`{colors.surface-muted-dark}`).

## Shapes

Les coins sont arrondis sans être « bulle » :
- `{rounded.sm}` pour les champs de saisie ;
- `{rounded.md}` pour les boutons et les bandeaux ;
- `{rounded.card}` pour les cartes ;
- `{rounded.lg}` pour les panneaux.

Les formes en pilule (`{rounded.full}`) sont réservées au badge « Consensus ! » et aux pastilles de présence. Les cartes gardent leur proportion 2:3, parce qu'elles doivent ressembler à des cartes.

## Components

Les composants sont regroupés par zone : d'abord les cartes, puis les barres et panneaux de l'écran de session, de haut en bas, et enfin les écrans à une colonne.

### Cartes

- **Carte de la main** (`poker-card`) : c'est **une vraie carte à jouer**. Face `{colors.card-face}`, liseré intérieur fin `{colors.card-frame}`, grande valeur centrée en `{typography.card-value}` et en `{colors.card-ink}`. La même valeur est rappelée en petit (`{typography.card-corner}`) dans le coin supérieur gauche et, retournée à 180°, dans le coin inférieur droit. Au survol ou au focus, la bordure passe en `{colors.primary}`. Les cartes `?` et `☕` ont exactement la même anatomie.
  - **Une fois choisie** (`poker-card-selected`), la carte garde sa face blanche, s'entoure d'un contour épais et se soulève de 12 px. Ce contour est en `{colors.primary}` en thème clair et en `{colors.card-ink-dark}` en thème sombre, ce qui garantit un contraste d'au moins 3:1 sur la face claire.
- **Dos de carte** (`seat-card-back`, réutilisé tel quel pour le logo de la barre du haut et pour l'animation de réveil) : une marge blanche entoure un motif à croisillons en losanges (`{colors.card-back-pattern}` sur `{colors.card-back}`). Ce motif n'est pas un dégradé : il est donc autorisé.
- **Mentions de place** (« (toi) », « observe », « n'a pas voté », « déconnecté », « visible par toi seul », « votera au prochain tour ») : `{typography.label}` en `{colors.muted-foreground}`.
- **Place d'un participant** : pseudo en `{typography.label}` et pastille de présence (`presence-dot`). Devant chaque place, une carte peut prendre trois aspects :
  - **vide** (`seat-card-empty`) : bordure en pointillés. Le participant n'a pas encore voté ;
  - **dos** (`seat-card-back`) : le dos de carte décrit ci-dessus. Le participant a voté ;
  - **face** (`seat-card-face`) : même anatomie que la carte de la main (valeur centrale et coins), en plus petit. La valeur est visible après la révélation. Pendant un tour caché, ma propre place montre la face de ma carte, avec la mention « visible par toi seul » sous la carte, en `{typography.label}` et `{colors.muted-foreground}`.

  Un observateur n'a pas de carte : la mention « observe » occupe l'emplacement de la carte. Un participant déconnecté garde son opacité normale : son pseudo passe en `{colors.muted-foreground}`, sa pastille devient grise et le libellé « déconnecté » s'affiche. Sa carte garde son aspect.

### Écran de session

- **Barre du haut** (`top-bar`) : fond `{colors.surface}`, filet inférieur `{colors.border}`, 56 px de haut. À gauche, le nom de l'outil est précédé d'un petit dos de carte qui sert de logo. À droite se trouvent le bouton « Copier le lien » (`copy-link-button`, un bouton secondaire avec une icône de lien), puis le menu du participant (`participant-menu`). Ce menu affiche le pseudo et une flèche, et s'ouvre en liste déroulante sous la barre.
- **Bandeau d'état** (`status-banner`) : bandeau ambre sous la barre du haut, pour « Reconnexion… » uniquement. Les erreurs définitives n'utilisent jamais ce bandeau : elles s'affichent en écran d'état ou sous le champ concerné.
- **Barre d'action** (`action-bar`) : à gauche, le compteur « N votes sur M » en `{typography.label}` et `{colors.muted-foreground}`. À droite, le bouton secondaire puis le bouton principal, espacés de `{spacing.3}`. Un bouton inactif passe à 40 % d'opacité.
  - **Bouton principal** (`button-primary`) : il n'y en a qu'un à la fois dans la barre d'action. C'est « Révéler les votes » quand le tour est caché, et « Nouveau tour » quand il est révélé. Les autres actions sont des boutons secondaires (`button-secondary`).
- **Panneau de résultat** (`result-panel`) : la moyenne en `{typography.result-value}`, avec le libellé « Moyenne ». Le badge « Consensus ! » (`consensus-badge`) s'affiche en vert à côté quand il y a consensus. En dessous, trois valeurs côte à côte en `{typography.result-stat}`, chacune avec son libellé : « Plus votée » (suivie du nombre de votes, par exemple « 5 · 4 votes »), « Min » et « Max ».
- **Panneau de résultat sur PC** : il est intégré à la barre d'action, sur une seule rangée d'environ 72 px. À gauche se trouvent la moyenne en `{typography.result-stat}` agrandie à 28 px avec son libellé « Moyenne », le badge « Consensus ! », puis « Plus votée », « Min » et « Max » en `{typography.result-stat}`. À droite se trouvent les boutons. Le compteur « N votes sur M » disparaît quand le tour est révélé : il n'a plus d'utilité.
  - **Sur téléphone**, le panneau tient sur une ligne condensée, « Moy. 6,3 · Plus votée 5 (4) · Min 3 · Max 13 », en `{typography.label}`, avec la moyenne en `{typography.result-stat}`. Le badge « Consensus ! » reste à côté. Si la ligne déborde, par exemple en cas d'égalités, elle passe sur deux lignes : la moyenne et le badge sur la première, le reste sur la seconde.

### Écrans à une colonne

- **Formulaire d'entrée** (`entry-form`) : panneau `{colors.surface}` de `{spacing.panel-narrow}` de large, `{rounded.lg}`. Le champ est bordé de `{colors.border}`. Sa bordure passe en `{colors.primary}` au focus et en `{colors.danger}` en cas d'erreur ; le message d'erreur s'affiche alors dessous, avec une icône « ! ». Le rôle se choisit avec deux boutons segmentés côte à côte, « Je vote » et « J'observe » : l'option choisie a un fond `{colors.primary-soft}` et un contour `{colors.primary}`. En dessous, le bouton principal occupe toute la largeur.
- **Écran d'état** (`state-screen`) : colonne centrée de `{spacing.panel-narrow}`. En haut, trois dos de carte animés pour le réveil, ou une icône pour une erreur. Viennent ensuite le titre en `{typography.display}` (en `{colors.foreground}` pour le réveil, en `{colors.danger}` pour une erreur), un texte en `{typography.body}` et enfin le bouton principal.

Maquettes de référence (en cas de conflit, ce document fait foi) :
- `mockups/session-pc.html` : cartes, places et barre d'action ;
- `mockups/session-telephone.html` : thème sombre et tiroir ;
- `mockups/rejoindre.html` : formulaire d'entrée ;
- `mockups/etats.html` : écrans d'état.

## Do's and Don'ts

| À faire | À ne pas faire |
|---|---|
| Réserver le rouge à « ma carte », aux cartes et à l'action principale | Utiliser le rouge pour décorer, ou en grands aplats saturés |
| Dessiner de vraies cartes à jouer : coins, valeur centrale, dos à croisillons | Faire des cartes qui ne sont que des boutons carrés |
| Réserver le vert au consensus et à la présence | Mettre du vert sur un simple succès (« Lien copié ») : un texte suffit |
| Avoir un seul bouton principal visible à la fois | Mettre « Révéler » et « Effacer » côte à côte avec le même poids |
| Animer le retournement des cartes à la révélation, et seulement là | Animer partout, ou ajouter des confettis |
| Utiliser la police système | Télécharger des polices web |
| Faire des cartes d'au moins 44 px de côté | Réduire les cartes sur téléphone pour tout faire tenir sur une ligne |
| Utiliser un bleu nuit pour le thème sombre | Utiliser un noir pur `#000` |
