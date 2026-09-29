# Passe de finition du PRD : Planning Poker pour ateliers d'affinage

*Passe du 29/09/2026 : `skill:bmad-review lenses=structure,prose` sur `prd.md` (3 280 mots avant la passe), puis traitement des constats **low** et des notes mécaniques de `review-rubric.md`. Lecteur : humains (défaut). Guide de style : Microsoft Writing Style Guide (adapté au français). Les constats high et medium n'ont pas été rouverts.*

**Lecture de l'objet :** ce document sert à l'équipe (UX, architecture, epics) pour disposer d'exigences testables sur un outil de planning poker interne, fiable en séance et sans rôle privilégié.

**Modèle de structure retenu :** spécification d'exigences (vision, utilisateurs, glossaire, FR groupées par fonctionnalité, NFR, hors objectifs, périmètre, mesures, questions ouvertes). La forme du document correspond déjà à ce modèle. Aucune section n'est à couper, fusionner ou déplacer.

Contrôles : IDs identiques avant et après la passe (FR-1 à FR-17, NFR-1, NFR-1b, NFR-2 à NFR-10, UJ-1 à UJ-3, SM-1 à SM-3, SM-C1). Frontmatter inchangé (`status: draft`). Aucun seuil ni aucune exigence modifiés ou ajoutés.

## Corrections appliquées

### Lentille structure (7)

| Emplacement | Avant | Après | Motif |
| --- | --- | --- | --- |
| §4.5 | Pas de paragraphe **Description** (seule section de §4.1 à §4.5 dans ce cas) | Ajout de « n'importe quel participant efface le tour pour revoter ou passer au ticket suivant. Réalise UJ-1. » | Homogénéité avec les autres sections (reprend FR-15 et UJ-1, sans nouvelle exigence) |
| §4.1 FR-2 | Unicité du pseudo avant son caractère obligatoire | Puces réordonnées : obligatoire / 20 caractères, puis unicité | Progression logique : validité, puis conflit |
| §4.2 FR-7 | Le cas des onglets multiples était placé entre les deux cas d'échec | Onglets placés avec le fonctionnement nominal, puis les deux cas d'échec (session disparue, participant repris ou retiré) | Regroupement nominal / exceptions |
| §5 NFR-3 | « propagé en moins d'une seconde (FR-16) » | « propagé dans le délai de diffusion fixé par FR-16 » | Constat low de la rubrique : seuil conservé à un seul endroit (FR-16) pour éviter que les deux sources divergent ; valeur inchangée |
| §7.1 | « NFR-1 à NFR-10 » | « NFR-1, NFR-1b et NFR-2 à NFR-10 » | Renvoi explicite : NFR-1b n'apparaissait pas dans la plage |
| §2.2 UJ-1, UJ-2 | Paragraphes des parcours et « Cas limite » en retour à la ligne simple (fusionnés au rendu Markdown) | Paragraphes séparés par une ligne vide et indentés | Mise en forme Markdown : le cas limite s'affiche désormais en paragraphe distinct |
| §7.1, §7.2, §8 | Contenu collé au titre ou au pseudo-titre en gras | Ligne vide ajoutée ; « **Principales** » devient « **Mesures principales** » | Mise en forme homogène ; intitulé autonome |

### Lentille prose (14)

| Emplacement | Avant | Après | Motif |
| --- | --- | --- | --- |
| §2.2 UJ-1 | « la **moyenne** et l'absence de **consensus** » | « et la **moyenne**, mais aucun **consensus** n'est signalé » | Constat low de la rubrique : aligné sur FR-14, qui ne prévoit aucun indicateur de désaccord |
| §2.2 UJ-1 | « le premier ticket » | « le premier **ticket** » | Terme du glossaire mis en gras comme les autres à sa première occurrence dans l'UJ |
| §2.2 UJ-3 | « L'atelier se déroule […] : il n'a eu besoin d'aucune autorisation » | « … : Karim n'a eu besoin … » | Antécédent ambigu (« il » renvoyait grammaticalement à « l'atelier ») |
| §1, §8 SM-2, §10 | « plantage du serveur » | « plantage ou redémarrage du serveur » | Cohérence avec NFR-1, qui fait foi, et avec la décision du memlog (« plantage/redémarrage ») ; « Seul un plantage » (§1) contredisait NFR-1 |
| §10 | « Les sept hypothèses […] ont été confirmées : » suivi de six éléments, puis NFR-1 | « tranchées […]. Six ont été confirmées : … La septième a conduit à redéfinir NFR-1 » | Note mécanique : le décompte annoncé (7) ne correspondait pas à la liste (6 + NFR-1) |
| §4.1 FR-2 | « s'il n'est pas révélé » | « s'il est caché » | Emploi de l'état défini dans le glossaire (« tour caché ») |
| §4.1 FR-3 | « voit un message clair, et on lui propose de créer » | « voit un message clair qui lui propose de créer » | Allègement : suppression du « on » |
| §4.2 FR-7 | « retrouve automatiquement sa place dans la session, dans le même navigateur » | « Dans le même navigateur, un participant qui … retrouve automatiquement sa place » | Condition placée en tête ; fin de phrase allégée |
| §4.2 FR-7 | « la page n'essaie pas de le reprendre » | « la page ne tente pas de reconnexion » | « Reprendre » a un sens précis dans FR-8 ; on évite le double emploi |
| §4.2 FR-7 | « pré-rempli » ; « elle affiche le message de FR-3 et propose de créer » | « prérempli » ; « le message de FR-3, qui propose de créer » | Orthographe ; FR-3 contient déjà la proposition |
| §4.2 FR-8, §5 NFR-9 | « perd alors ce participant (voir FR-7) » ; « (voir §7) » | « perd ce participant (FR-7) » ; « (§7.2) » | « alors » répété ; format de renvoi homogène ; NFR-9 pointe maintenant vers la sous-section qui traite Jira |
| §4.4 FR-12 | « même si tous les votants n'ont pas voté » | « même si certains votants n'ont pas voté » | Négation ambiguë en français |
| §4.4 FR-13, §4.5 FR-15 | « Les votes redeviennent cachés pour tous et le tour redevient caché : … donc à nouveau » ; « : c'est un risque accepté parce que …, et en cas d'erreur, on revote. » | « Le tour redevient caché pour tous : les votes ne sont plus visibles, et … de nouveau » ; « Ce risque est accepté parce que … (§1) : en cas d'erreur, on revote. » | Redondance supprimée ; phrases lourdes scindées |
| §4.6 FR-16, §7.2, §8 SM-2, §9 | « un participant qui arrive ou qui part, un vote déposé ou retiré » ; « pas abandonnés pour toujours. Si … » ; « c'est-à-dire des votes perdus … » ; « Cette question est à traiter dans l'architecture. » | « l'arrivée ou le départ d'un participant, le dépôt ou le retrait d'un vote » ; « pas abandonnés : si … » ; « Par incident bloquant, on entend … » ; « À traiter dans l'architecture. » | Parallélisme ; concision ; définition explicite de l'incident bloquant |

## Constats low et notes mécaniques de la rubrique : bilan

| Constat | Traitement |
| --- | --- |
| NFR-3 doublonne FR-16 | Appliqué (voir structure) |
| UJ-1 montre une « absence de consensus » | Appliqué (reformulation de UJ-1, option qui ne touche pas au fond) |
| Glossaire : tour caché / tour révélé, Ticket | Déjà traité lors d'une passe précédente (entrées présentes au §3) |
| Moyenne au format français | Déjà traité (FR-14 : « 5,3 ») |
| Identifiants / renvois | Vérifié ; plage du §7.1 corrigée pour inclure NFR-1b |
| Index des hypothèses | Décompte corrigé (voir prose) |
| NFR-9 invérifiable, NFR-8 recoupe NFR-6, SM-1 trop large, normalisation du pseudo, FR-5 sur tour révélé, NFR-5 adjectifs, modèle de confiance de FR-8 | À arbitrer (touchent au fond, voir ci-dessous) |

## À arbitrer (non appliqué, touche au fond)

1. **NFR-9, évolutivité :** « sans tout réécrire » ne se vérifie pas. Il faut soit une contrainte vérifiable (pas de dépendance à un service propriétaire de l'hébergeur, configuration par variables d'environnement), soit un déplacement dans l'addendum.
2. **NFR-8 / NFR-6 :** l'absence de publicité est énoncée deux fois. Faut-il fusionner les deux, ou limiter NFR-8 à « ni installation ni compte » ?
3. **SM-1, traçabilité :** « Valide FR-1 à FR-17 » est trop large. Faut-il la réduire (par exemple à FR-1, FR-2, FR-10, FR-12, FR-14) ou la supprimer ?
4. **FR-2, normalisation du pseudo :** faut-il ignorer la casse et retirer les espaces de début et de fin ? Un pseudo vide après nettoyage est-il refusé ? Cette règle conditionne la reprise de FR-8.
5. **FR-5 sur un tour révélé :** un votant qui passe observateur après la révélation voit-il son vote retiré, ce qui modifie la synthèse, alors que FR-11 verrouille les votes ?
6. **NFR-5 :** remplacer « versions récentes » et « assez grandes » par des seuils (par exemple, les deux dernières versions majeures et des zones tactiles d'au moins 44 × 44 px).
7. **FR-8 / NFR-6, modèle de confiance :** faut-il dire explicitement que posséder le lien permet de reprendre le pseudo d'un participant déconnecté, sans aucune protection contre l'usurpation ?
8. **FR-16, liste des changements diffusés** (nouveau, issu de la passe prose) : l'énumération (« Cela concerne … ») paraît exhaustive mais omet le changement de rôle (FR-5). Faut-il ajouter « notamment », ou compléter la liste ?

## Synthèse

21 corrections appliquées (7 structure, 14 prose ; plusieurs lignes du tableau regroupent des corrections de même nature). Le volume reste quasi constant (+30 mots environ, dus surtout à la description ajoutée au §4.5 et à la reformulation du §10). Aucune perte de compréhension. 8 points sont à arbitrer par le PM.
