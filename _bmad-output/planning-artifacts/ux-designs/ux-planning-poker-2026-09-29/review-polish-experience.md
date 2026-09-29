# Passe de finition — EXPERIENCE.md

- **Fichier revu :** `EXPERIENCE.md` (3 442 mots avant la passe, mesurés par `word_metrics.py`)
- **Directive :** `skill:bmad-review lenses=structure,prose` (structure, puis prose sur la base des constats de structure)
- **Références :** `DESIGN.md` (jetons et identifiants de composants), glossaire du PRD §3, constats **low** et notes mécaniques de `review-rubric.md`
- **Guide de style :** Microsoft Writing Style Guide (valeur par défaut) ; lecteur : humains
- **Contraintes respectées :** aucun comportement, seuil, décision ni libellé entre guillemets modifié (l'ensemble des chaînes « … » est identique avant et après la passe) ; frontmatter intact ; DESIGN.md non touché ; fins de ligne CRLF conservées.

**Lecture de l'objectif :** ce document sert à story-dev et à l'architecture à implémenter le comportement de l'interface du Planning Poker sans deviner, en complément de DESIGN.md pour l'apparence.

**Modèle de structure retenu :** Reference/Database (accès direct, schéma homogène par tableau), avec des Key Flows linéaires.

## Lentille structure — 5 corrections appliquées, 3 éléments préservés

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| structure | §State Patterns — ordre des 19 lignes (Session vide en dernier, Arrivée pendant un tour révélé entre Rejoindre et Accueil) | MOVE : lignes regroupées par écran, dans l'ordre Session → Session introuvable → Rejoindre → Accueil, Rejoindre → Réveil du serveur | Accès direct par écran ; aucun mot ajouté |
| structure | §State Patterns — colonne Écran : « Session, tour révélé » (Consensus, Tour révélé, écart) | CONDENSE : « Session » | La colonne ne contient plus que des écrans, comme les 17 autres lignes ; la condition est déjà dans le nom de l'état |
| structure | §Component Patterns, Barre d'action — la phrase sur l'action **effacer** précède celle sur le bouton secondaire, qui nomme « Effacer les votes » | MOVE : phrase placée après « En bouton secondaire : … » | Le lecteur connaît les deux boutons avant qu'on lui dise qu'ils déclenchent la même action |
| structure | §Foundation — vocabulaire noyé dans la puce Apparence ; « place » employé partout sans définition (rubric low §7) | Nouvelle puce **Vocabulaire** : termes du glossaire, plus la définition de la **place** | Échafaudage : le terme d'interface est défini avant usage (+45 mots environ) |
| structure | §State Patterns — état « Tour masqué », hors glossaire (rubric low §7) | « Tour caché après masquage » | Terminologie du glossaire : après masquer, le tour est caché |
| structure | §Voice and Tone — tableau À faire / À ne pas faire | PRESERVE | Exemples concrets utiles à l'implémentation |
| structure | §Responsive & Platform, ligne téléphone — disposition 2 × 5 et barre d'action, déjà décrites dans DESIGN.md (rubric low §6) | PRESERVE | Comportement ici, géométrie dans DESIGN ; le renvoi vers `DESIGN.md`, Components existe déjà |
| structure | Règle du délai de 1 s, présente dans Barre d'action et dans Interaction Primitives | PRESERVE | Renforcement utile, avec renvoi explicite ; les deux formulations ont été alignées (voir prose) |

## Lentille prose — 12 corrections appliquées, 1 choix de style préservé

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| prose | Plusieurs règles sans renvoi : Table des participants, « Copier le lien », Bandeau d'état, Tour révélé, Reconnexion, Réveil du serveur, carte de 44 px, « sans installation ni compte » | Ajout de FR-6, FR-1, FR-7 (×2), FR-12, NFR-2, NFR-5 et NFR-8 | Renvois FR et NFR vérifiés contre le PRD ; les renvois existants sont tous corrects |
| prose | « les boutons restent inactifs pendant 1 s … (voir Barre d'action) » | « les boutons de la barre d'action restent inactifs pendant 1 s … (FR-17, voir Barre d'action) » | Aligné sur la règle de la Barre d'action, qui limite le délai à cette barre ; renvoi FR-17 ajouté |
| prose | « Faire patienter jusqu'à 30 s, puis afficher « Indisponible » avec un bouton pour réessayer au-delà de 60 s » | « Faire patienter pendant le réveil, qui prend jusqu'à 30 s. L'attente se prolonge jusqu'à 60 s ; au-delà, afficher « Indisponible » avec un bouton pour réessayer » | Levée de l'ambiguïté signalée par la rubrique (l'attente continue de 30 à 60 s) ; libellé conservé |
| prose | « Badge vert « Consensus ! », seulement à partir de deux votes numériques identiques (FR-14) » | « … seulement quand tous les votes numériques sont identiques, avec au moins deux votes numériques (FR-14) » | L'ancienne formulation pouvait se lire « dès que deux votes sont égaux » ; reprise exacte de FR-14 |
| prose | « Son pseudo passe en gris lisible, avec une pastille grise … Elle disparaît au bout de 5 minutes » | « Son pseudo passe en `{colors.muted-foreground}`, avec une pastille grise (`presence-dot`) … Sa place disparaît au bout de 5 minutes de déconnexion » | Jeton de DESIGN.md au lieu d'une couleur décrite ; antécédent ambigu de « Elle » (la carte ?) levé |
| prose | « Bandeau ambre « Reconnexion… ». » (State Patterns) | « … (`status-banner`, FR-7). » | Identifiant de composant de DESIGN.md |
| prose | Flux 1, étape 5 : moyenne « 6,3 » sans distribution (rubric low §1) ; « Les deux concernés s'expliquent » | « Les sept votes sont 3, 5, 5, 5, 5, 8 et 13 : il n'y a pas de consensus. Les deux votants du 3 et du 13 s'expliquent. » | La distribution est la seule compatible avec 6,3, quatre 5, min 3 et max 13 ; les tests pourront la reprendre |
| prose | « Les deux votants concernés se repèrent » (Tour révélé, écart) | « Les votants concernés se repèrent » | Il peut y avoir plus de deux votants aux extrêmes |
| prose | « Entrée valide le formulaire. » | « La touche Entrée valide le formulaire. » | « Entrée » lu comme un nom commun |
| prose | « Sur téléphone, le tiroir se replie » (premier emploi de « tiroir ») | « le tiroir de cartes (voir Responsive & Platform) se replie » | Terme défini plus loin : renvoi ajouté |
| prose | « Une zone `aria-live` polie » | « Une zone `aria-live="polite"` » | Valeur ARIA exacte, sans traduction ambiguë |
| prose | « sans que les deux ne se croisent » (Flux 3) | « sans que les deux sessions se croisent » | Antécédent explicite |
| prose | Style général (tutoiement, première personne « je / ma place », phrases courtes) | Conservé | Choix délibérés de voix, non modifiés |

**Bilan :** 21 lignes : 17 corrections appliquées (5 de structure, 12 de prose, dont une qui regroupe 8 renvois FR et NFR) et 4 éléments préservés. Effet net sur la longueur : environ +110 mots (+3 %), dû aux renvois, à la définition de la place et à la distribution du Flux 1. Aucun compromis de compréhension.

## Constats low et notes mécaniques de la rubrique

| Constat (rubrique) | Traitement |
|---|---|
| Flux 1 : distribution incomplète | Corrigé (prose) |
| « Tour masqué » hors glossaire ; « place » non définie | Corrigé (structure) |
| IA l.29 : formulation 30 s / 60 s ambiguë | Corrigé (prose), libellé « Indisponible » conservé ; voir A1 |
| Marqueurs `[ASSUMPTION]` dans EXPERIENCE | Déjà absents |
| Badge « Consensus ! » | Correct dans EXPERIENCE ; DESIGN.md (Components, Panneau de résultat) écrit encore « Consensus » : pour la passe DESIGN |
| Maquette de l'Accueil | Déjà traité : `rejoindre.html` couvre l'Accueil sur PC |
| Disposition du téléphone en double | Préservé (comportement ici, géométrie dans DESIGN) |
| Identifiants de composants absents | Déjà présents ; noms canoniques à aligner, voir A5 |
| Flux 2 : reprise réussie (FR-8) non montrée | À arbitrer (A3) |
| Cas limites d'état | À arbitrer (A4) |
| « Pseudo refusé » sur l'Accueil | À arbitrer (A2) |
| Frontmatter sans `name`, `status: draft` | Non traité : frontmatter hors périmètre (A7) |
| Traitement visuel de « n'a pas voté », « observe », « (toi) » | Relève de DESIGN.md |

## À arbitrer (touche au fond, non appliqué)

- **A1. Libellé « Indisponible » (IA, ligne Réveil du serveur).** Aucun écran n'affiche ce mot : l'état Serveur indisponible affiche « Le serveur ne répond pas. » et « Réessayer ». Proposition : remplacer par « …au-delà, l'écran passe à l'état Serveur indisponible, avec le bouton « Réessayer » ».
- **A2. « Pseudo refusé » indiqué pour l'Accueil** (State Patterns et Formulaire d'entrée). Le cas est impossible sur une session neuve. Proposition : Écran = « Rejoindre » seulement.
- **A3. Flux 2, chemin d'échec :** ajouter la reprise réussie (FR-8), par exemple « …réessaie : elle rejoint avec « Sofia » et retrouve sa carte 8 ».
- **A4. Cas limites d'état** (rubric low §4) : perte du vote quand un votant passe observateur pendant un tour caché (FR-5) ; retour de l'état Session vide quand les autres partent ; compteur quand M = 0 ; délai avant d'afficher « Reconnexion… » pour éviter le clignotement sur une micro-coupure.
- **A5. Noms canoniques des composants,** à coordonner avec la passe DESIGN : « Main de cartes » ici contre « Carte de la main » dans DESIGN (`poker-card`) ; « Table des participants » contre « Place d'un participant » (`seat-card-*`) ; « Dos de carte » n'a pas d'identifiant dans DESIGN (EXPERIENCE emploie `seat-card-back`).
- **A6. Liste « Libellés fixes » incomplète** (Voice and Tone) : n'y figurent pas « Je veux voter », « Tu observes », « Connexion… », « Ton pseudo », « Ton rôle », « Partage le lien pour inviter ton équipe », « Lien copié ». Les ajouter en ferait des chaînes contractuelles.
- **A7. Frontmatter :** ajouter `name` et passer `status` à `final` une fois les arbitrages faits.
