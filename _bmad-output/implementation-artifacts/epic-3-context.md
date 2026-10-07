# Epic 3 Context: Des séances souples et soignées

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Rendre l'outil complet et agréable pour un vrai atelier d'affinage : changer de rôle sans quitter la table, masquer un tour révélé pour revoter après discussion, choisir son thème (automatique, clair ou sombre), voir les cartes se retourner à la révélation, mener toute une séance au clavier ou au lecteur d'écran (WCAG 2.2 AA), et garantir les trois parcours clés par des tests de bout en bout à chaque changement. L'epic se termine par une version déployée sur Render, prête pour mesurer le succès : trois ateliers consécutifs menés uniquement avec l'outil.

## Stories

- Story 3.1 : Changer de rôle en pleine séance
- Story 3.2 : Masquer pour revoter
- Story 3.3 : Choisir son thème
- Story 3.4 : Une révélation qui se voit
- Story 3.5 : Un outil accessible à tous
- Story 3.6 : Les trois parcours garantis de bout en bout

## Requirements & Constraints

- **Changement de rôle :** votant ↔ observateur à tout moment. Pendant un tour caché, devenir observateur retire le vote. Pendant un tour révélé, le vote reste affiché et compté dans la synthèse jusqu'au masquage ou à l'effacement. Un observateur devenu votant pendant un tour révélé vote dès que le tour redevient caché (masquage ou effacement) ; d'ici là, « votera au prochain tour ».
- **Masquer :** tout participant peut remettre un tour révélé en caché, sans changer le `roundId`. Les votes redeviennent modifiables ; le vote d'un participant devenu observateur pendant la révélation est retiré.
- **Diffusion et concurrence :** tout changement apparaît chez tous en moins d'une seconde ; en cas d'actions quasi simultanées, la dernière reçue s'applique et tous convergent.
- **Thème :** « Automatique » par défaut (suit `prefers-color-scheme`), choix forcé « Clair » ou « Sombre » appliqué immédiatement et mémorisé dans le navigateur sous `pp.theme`, jamais envoyé au serveur. Contrastes AA dans les deux thèmes : 4,5:1 pour le texte, 3:1 pour les grands textes et les éléments graphiques.
- **Révélation animée :** retournement l'une après l'autre en environ 400 ms au total, sans retarder l'état ; aucun mouvement sous `prefers-reduced-motion`. Aucune autre animation : ni son, ni vibration, ni confettis, ni modale.
- **Accessibilité :** audit axe sans violation sur tous les écrans, dans les deux thèmes ; séance complète au clavier (Tab, flèches, Entrée, Espace), focus visible en `primary` et conservé après une révélation faite par un autre ; région `aria-live` polie (révélation, nouveau tour, arrivées), compteur annoncé au plus toutes les 5 s, jamais les votes un par un ; information jamais portée par la couleur seule ; zoom 200 % ou 360 px sans défilement horizontal ; cibles d'au moins 44 × 44 px.
- **Bout en bout :** parcours UJ-1 à UJ-3 sous Playwright, sur Chromium et WebKit, dans la CI GitHub Actions, dont un onglet laissé 20 min en arrière-plan.
- **Langue et ton :** interface en français, tutoiement, libellés exacts (« Je vote », « J'observe », « Je veux voter », « Tu observes », « votera au prochain tour », « Masquer »).

## Technical Decisions

- **Point unique de modification :** sous le verrou de la session, charger → appliquer la règle → incrémenter `version` seulement si l'état observable change → `save` → `publish` (non bloquant).
- **Intentions nommées et idempotentes :** `hide {roundId}` et `changeRole` (champ `role`) rejoignent `vote`, `reveal`, `clear`. Une intention déjà satisfaite ne change rien et n'incrémente pas `version` ; un `roundId` périmé est ignoré ; une intention interdite renvoie `error` (`ROUND_REVEALED`, `NOT_A_VOTER`, `INVALID_CARD`).
- **Instantané `sessionState` complet, filtré par destinataire :** chaque participant porte `role`, `hasVoted`, `vote`, `canVoteThisRound` ; `progress` (« N votes sur M ») est calculé par le serveur ; `lastChange.action` vaut `ROLE` ou `HIDE` pour ces intentions. Le blocage client de 1 s vaut pour REVEAL, HIDE ou CLEAR faits par un autre participant, et après mon propre clic sur la barre d'action.
- **Contrat :** n'évolue que par ajout ; tout nouveau message ou champ passe d'abord par `contract/` (schémas et exemples validés des deux côtés).
- **Webservice hexagonal** contrôlé par ArchUnit ; domaine en Java pur, testé en JUnit 5 avec une `Clock` fixe.
- **Front :** un seul `SessionService` expose l'état en `Signal` en lecture seule ; aucun calcul métier côté front. Le thème est une préférence purement locale, hors de `SessionService` et du contrat.
- **Thème en CSS :** les jetons de DESIGN sont des propriétés CSS globales de même nom ; les jetons `-dark` **redéfinissent ces mêmes propriétés** sous le thème sombre, sans créer de propriétés `--*-dark`. Le sombre s'applique soit par `prefers-color-scheme` (thème automatique), soit par un choix forcé qui doit l'emporter sur le système dans les deux sens.
- **Stockage navigateur :** seules clés autorisées : `pp.token.{sessionId}`, `pp.pseudo`, `pp.theme`.

## UX & Interaction Patterns

- **Menu du participant** (barre du haut, pas de modale ni de navigation) : affiche le pseudo, bascule « Je vote » / « J'observe » avec le rôle actuel sélectionné, et choix du thème « Automatique », « Clair » ou « Sombre ».
- **Thème sombre :** fonds en bleu nuit, jamais en noir pur. Les cartes gardent une face claire (`card-face-dark`) avec le liseré clair `card-frame-dark` ; la carte choisie a un contour en `card-ink-dark` (au moins 3:1 sur la face claire). Les ombres sont remplacées par des surfaces un peu plus claires (`surface-muted-dark`). Le rouge reste réservé aux cartes, à « ma carte » et à l'action principale ; le vert au consensus et à la présence.
- **Main :** un observateur voit « Tu observes » et le lien « Je veux voter » à la place des cartes ; main grisée en tour révélé.
- **Table :** votants d'abord, observateurs toujours à la fin, chaque groupe par ordre d'arrivée, ma place en tête de son groupe ; une place change de groupe au changement de rôle.
- **Barre d'action :** bouton secondaire « Masquer » en tour révélé ; ni raccourci clavier, ni confirmation.
- **Maquette de référence du thème sombre :** l'écran Session sur téléphone (en cas de conflit, DESIGN fait foi).

## Cross-Story Dependencies

- 3.1 et 3.2 sont livrées : les états « devenu observateur pendant la révélation » et « observateur devenu votant en tour révélé » sont résolus au masquage ou au `clear`.
- 3.3 ajoute le choix du thème au menu du participant introduit par 3.1 ; les contrastes qu'elle valide sont ensuite audités par axe dans les deux thèmes en 3.5.
- 3.4 doit respecter `prefers-reduced-motion` et ne pas déplacer le focus, ce que 3.5 vérifie.
- 3.5 doit solder ou refuser explicitement les reports d'accessibilité qui la visent (libellé de présence des places, « n'a pas voté » pour les lecteurs d'écran, main « Ta carte » dans un repère).
- 3.6 couvre l'ensemble des parcours et clôt l'epic par le déploiement sur étiquette `v*` (webservice puis front) ; elle doit préciser si les parcours tournent contre le vrai webservice.
