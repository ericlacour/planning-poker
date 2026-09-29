---
title: "Product Brief : Planning Poker pour ateliers d'affinage"
status: final
created: 2026-09-29
updated: 2026-09-29
---

# Product Brief : Planning Poker pour ateliers d'affinage

## Résumé

Notre équipe estime ses user stories en planning poker pendant les ateliers d'affinage, à distance ou en hybride. Elle utilise aujourd'hui Scrum Poker Online. L'outil fait le travail, mais il est envahi de publicité, il dépend d'un service tiers et nous ne pouvons pas le faire évoluer.

Nous construisons notre propre outil de planning poker, simple, sans publicité et que nous maîtrisons. Il fait une seule chose, et doit la faire de façon fiable : permettre à 3 à 12 personnes de voter à l'aveugle sur une estimation, de révéler les votes, d'en discuter, puis de passer au ticket suivant. Tout le monde a les mêmes droits. N'importe qui peut lancer une session, et l'atelier ne dépend donc d'aucune personne en particulier.

Le projet a aussi un second objectif, assumé : **apprendre la méthode BMAD** en la suivant de bout en bout sur un cas réel. Ce brief, et tout ce qui suivra, sert donc à la fois à livrer l'outil et à pratiquer la méthode.

## Le problème

- **La publicité gêne l'atelier.** Elle distrait l'équipe pendant les votes et ne fait pas sérieux. La supprimer a un coût : il faut payer un abonnement.
- **Nous dépendons d'un tiers.** Nous ne contrôlons ni la disponibilité du service, ni son évolution, ni ce qu'il fait des titres de nos tickets.
- **L'outil n'évolue pas selon nos besoins.** Si nous voulons un jour relier les estimations à Jira, ou adapter le déroulé à notre façon de travailler, nous dépendons de la feuille de route de quelqu'un d'autre.

## La solution

Une application web accessible par lien, sans compte ni installation.

- **Lancer une session :** n'importe qui crée une session et partage son lien, qui est long et impossible à deviner. Les participants la rejoignent avec un pseudo, unique dans la session.
- **Voter :** chacun choisit une carte parmi `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`. Tant que les votes sont cachés, chacun peut changer sa carte, et tout le monde voit **qui** a voté, mais pas **quoi**. Une personne qui arrive en cours de tour peut voter.
- **Révéler et masquer :** n'importe quel participant peut révéler les votes, avec le nom de chaque votant, ou les masquer à nouveau.
- **Passer au ticket suivant :** n'importe quel participant efface les estimations pour démarrer un nouveau tour. Le ticket lui-même est présenté en visio, et l'outil ne le connaît pas.
- **Fiabilité :** la session survit à un rafraîchissement de page ou à une déconnexion passagère. Elle expire environ 24 h après le début de l'atelier.
- **Revoter :** effacer remet le tour à zéro, sans garder d'historique des tours précédents. Pour revoter, on efface et on recommence.
- **Une session par atelier :** chaque atelier crée sa propre session, sans lien d'équipe permanent. Deux équipes peuvent ainsi mener leur affinage en même temps sans se gêner.

## Ce qui le distingue

Aucune avancée technique, et nous ne prétendons pas en avoir. Ce qui compte, c'est la **maîtrise** :
- zéro publicité ;
- aucun abonnement ;
- un code que nous possédons et que nous pouvons faire évoluer (Jira, hébergement interne) ;
- un fonctionnement **sans rôle privilégié**, pensé pour une équipe qui se fait confiance.

## Pour qui

- **L'équipe de développement**, de 3 à 12 personnes, qui estime ses stories en atelier d'affinage à distance ou en hybride. Pour elle, l'outil doit s'ouvrir en un clic et fonctionner du premier coup, sans rien qui distraie.
- **Le scrum master**, Eric, qui anime habituellement l'atelier. Il n'a pas de droits particuliers dans l'outil, mais n'importe quel membre de l'équipe doit pouvoir le remplacer s'il est absent.

## Critères de succès

1. **L'équipe a remplacé Scrum Poker Online** par cet outil pour ses ateliers d'affinage.
2. **Le cycle BMAD complet a été mené**, du brief jusqu'au code livré et utilisé.

Condition préalable à ces deux critères : aucun plantage bloquant pendant un affinage. Un outil qui lâche en pleine séance serait immédiatement abandonné.

## Périmètre V1

**Inclus :** création de session par lien, accès par pseudo, jeu de cartes fixe, vote caché modifiable, visibilité de qui a voté, révélation et masquage nominatifs, effacement pour un nouveau tour. Tous ces droits sont ouverts à tous. La session résiste au rafraîchissement et expire au bout d'environ 24 h. L'outil est hébergé sur un hébergeur gratuit.

**Exclu :**
- rôle d'animateur ou de modérateur ;
- liste de tickets ;
- valeur retenue et export CSV (l'estimation est reportée à la main dans Jira) ;
- intégration Jira ;
- comptes utilisateurs et historique des sessions ;
- jeu de cartes configurable ;
- garde-fou contre un effacement ou une révélation par erreur (risque accepté : on revote).

**Risque accepté :** toute personne qui a le lien peut entrer dans la session.

## Vision

Si l'équipe adopte l'outil, deux évolutions sont prévues :
1. un **hébergement en entreprise**, pour ne plus dépendre d'un hébergeur gratuit ;
2. une **intégration Jira** en V2 ou V3, pour importer les tickets et renvoyer les estimations sans recopie.

L'outil reste volontairement petit. Son intérêt, c'est d'appartenir à l'équipe.
