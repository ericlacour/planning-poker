# Epic 3 Context: Des séances souples et soignées

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Rendre l'outil complet et agréable pour un atelier réel : changer de rôle en pleine séance sans quitter la table, masquer un tour révélé pour revoter après discussion, choisir son thème (automatique, clair ou sombre), voir les cartes se retourner à la révélation, mener toute une séance au clavier ou au lecteur d'écran (WCAG 2.2 AA), et garantir les trois parcours clés par des tests de bout en bout à chaque changement. L'epic se termine par une version déployée sur Render, prête pour mesurer SM-1 (trois ateliers consécutifs menés uniquement avec l'outil).

## Stories

- Story 3.1 : Changer de rôle en pleine séance
- Story 3.2 : Masquer pour revoter
- Story 3.3 : Choisir son thème
- Story 3.4 : Une révélation qui se voit
- Story 3.5 : Un outil accessible à tous
- Story 3.6 : Les trois parcours garantis de bout en bout

## Requirements & Constraints

- **Changement de rôle :** votant ↔ observateur à tout moment. Un votant qui devient observateur pendant un tour caché perd son vote ; pendant un tour révélé, son vote reste affiché (et compté) jusqu'à l'effacement. Un observateur qui devient votant pendant un tour révélé ne vote qu'à partir du tour suivant (« votera au prochain tour »).
- **Masquer :** tout participant peut remettre un tour révélé en caché ; les votes redeviennent modifiables, le `roundId` ne change pas. Au masquage, le vote d'un participant devenu observateur pendant la révélation est retiré, et un observateur devenu votant pendant la révélation peut voter.
- **Diffusion :** tout changement (rôle, masquage…) apparaît chez tous en moins d'une seconde. Actions quasi simultanées : la dernière reçue s'applique, tous convergent vers le même état.
- **Thème :** automatique par défaut (`prefers-color-scheme`), choix forcé clair ou sombre mémorisé côté navigateur sous `pp.theme`, jamais envoyé au serveur. Contrastes AA dans les deux thèmes (4,5:1 texte, 3:1 grands textes et éléments graphiques).
- **Révélation animée :** retournement l'une après l'autre en environ 400 ms au total, sans retarder l'état ; rien en `prefers-reduced-motion`. Aucune autre animation, ni son, ni confettis, ni modale.
- **Accessibilité :** audit axe sans violation sur tous les écrans et dans les deux thèmes ; séance complète au clavier avec focus visible en `primary` et conservé après une révélation d'un autre ; région `aria-live` polie (révélation, nouveau tour, arrivées), compteur annoncé au plus toutes les 5 s, jamais les votes un par un ; information jamais portée par la couleur seule ; zoom 200 % ou 360 px sans défilement horizontal ; cibles de 44 × 44 px au moins.
- **Bout en bout :** UJ-1 à UJ-3 sur Chromium et WebKit dans la CI, dont un onglet en arrière-plan pendant 20 min.
- **Langue et ton :** interface en français, tutoiement, libellés exacts (« Je vote », « J'observe », « Je veux voter », « Tu observes », « votera au prochain tour »).

## Technical Decisions

- **Point unique de modification :** sous le verrou de la session, charger → appliquer la règle → incrémenter `version` seulement si l'état observable change → `save` → `publish` (non bloquant).
- **Intentions nommées et idempotentes :** `hide {roundId}` et `changeRole` (champ `role`) s'ajoutent à `vote`, `reveal`, `clear`. Une intention déjà satisfaite ne change rien et n'incrémente pas `version` ; un `roundId` périmé est ignoré ; une intention interdite renvoie `error` (`ROUND_REVEALED`, `NOT_A_VOTER`, `INVALID_CARD`).
- **Instantané `sessionState` complet et filtré par destinataire :** chaque participant porte `role: VOTER | OBSERVER`, `hasVoted`, `vote`, `canVoteThisRound` ; `progress` (« N votes sur M ») est calculé par le serveur ; `lastChange.action` vaut `ROLE` ou `HIDE` pour ces intentions. Le blocage client de 1 s ne vaut que pour REVEAL, HIDE ou CLEAR faits par un autre participant.
- **Contrat :** n'évolue que par ajout ; tout nouveau message ou champ passe d'abord par `contract/` (schémas + exemples validés des deux côtés).
- **Webservice hexagonal** contrôlé par ArchUnit ; domaine en Java pur testé en JUnit 5 avec `Clock` fixe.
- **Front :** un seul `SessionService` expose l'état en `Signal` en lecture seule, aucun calcul métier côté front ; les jetons DESIGN sont des propriétés CSS, les jetons `-dark` redéfinissent les mêmes propriétés.
- **Navigateur :** seules clés stockées : `pp.token.{sessionId}`, `pp.pseudo`, `pp.theme`.

## UX & Interaction Patterns

- **Menu du participant** (barre du haut) : affiche le pseudo, bascule « Je vote » / « J'observe » (rôle actuel sélectionné), choix du thème.
- **Main :** un observateur voit « Tu observes » et le lien « Je veux voter » à la place des cartes ; main grisée en tour révélé.
- **Table :** votants d'abord, puis observateurs toujours à la fin, chaque groupe par ordre d'arrivée, ma place en tête de son groupe ; un observateur n'a pas de carte, la mention « observe » occupe l'emplacement.
- **Barre d'action :** bouton secondaire « Masquer » en tour révélé ; aucun raccourci clavier ni confirmation.
- **Thème sombre :** les cartes gardent une face claire (`card-face-dark`, liseré `card-frame-dark`), carte choisie en `card-ink-dark` ; ombres remplacées par des surfaces plus claires.

## Cross-Story Dependencies

- 3.1 et 3.2 se croisent : les états « devenu observateur pendant la révélation » et « observateur devenu votant en tour révélé » créés par 3.1 sont résolus au masquage par 3.2 (et au `clear`).
- 3.3 (menu du thème) partage le menu du participant introduit en 3.1.
- 3.5 vérifie l'accessibilité des écrans livrés par 3.1 à 3.4 ; 3.6 couvre l'ensemble des parcours et termine l'epic par le déploiement.
