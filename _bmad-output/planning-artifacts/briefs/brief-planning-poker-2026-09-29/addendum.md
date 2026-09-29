# Addendum : Planning Poker pour ateliers d'affinage

Ce document complète le brief. Il est destiné au PRD et à l'architecture.

## Décisions de l'idée forgée abandonnées (26/09 → 29/09)

L'idée forgée (`_bmad-output/forge/planning-poker-affinage/forged-idea.md`) prévoyait un **animateur**. Le brief le supprime au profit de droits égaux pour tous. Motifs : plus de souplesse, et un atelier qui ne doit pas dépendre d'une personne en particulier, notamment quand Eric est absent. Cette décision entraîne l'abandon des éléments suivants :

- l'animateur qui pilote la révélation, la validation et le passage au ticket suivant, avec la possibilité de transmettre son rôle ;
- le point ouvert sur le transfert du rôle quand l'animateur est déconnecté, qui n'a plus lieu d'être ;
- la liste de tickets saisie à la main (collée ou ajoutée au fil de l'eau) ;
- la valeur finale choisie par l'animateur, et le statut « non estimé » ;
- le récapitulatif copiable et l'export CSV ;
- l'affichage des votes des tours précédents lors d'un revote. Il n'est plus prévu : effacer remet le tour à zéro.

Si l'équipe réclame à nouveau l'un de ces éléments, il pourra revenir dans une version ultérieure. Les détails figurent dans l'idée forgée.

## Contraintes techniques pour l'architecture

- **Hébergeur gratuit et fiabilité.** Beaucoup d'offres gratuites mettent l'application en veille après une période d'inactivité (démarrage à froid de plusieurs secondes), limitent les connexions temps réel (WebSocket) ou ne gardent aucun état entre deux redémarrages. Or le brief exige zéro plantage en affinage et une session qui survit à un rafraîchissement. Le choix de l'hébergeur doit donc être validé face à ces contraintes.
- **Temps réel.** Les votes, la présence (qui a voté) et la révélation doivent apparaître chez tous les participants sans qu'ils aient à recharger la page.
- **Session éphémère.** Elle expire au bout d'environ 24 h. Aucune donnée n'est conservée au-delà, et il n'existe pas de comptes.
- **Évolutivité.** L'hébergement en entreprise puis l'intégration Jira (V2/V3) ne doivent pas imposer de tout réécrire.

## Questions ouvertes pour le PRD

- Un participant qui se reconnecte sous le même pseudo retrouve-t-il son vote ?
- Que se passe-t-il si deux personnes cliquent en même temps, l'une sur « révéler » et l'autre sur « effacer » ?
