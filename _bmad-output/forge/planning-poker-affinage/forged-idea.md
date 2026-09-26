# Planning poker pour ateliers d'affinage — idée forgée

Statut : HARDENED · 2026-09-26 · Eric (scrum master)

## Décisions verrouillées
- **Rôles** : un animateur (créateur de la session) pilote tickets, révélation, validation, passage au suivant ; il vote ou non. Rôle transmissible à un autre participant. Les votants rejoignent par lien + pseudo (unique dans la session).
- **Cycle par ticket** : vote caché → révélation nominative par l'animateur → discussion des écarts → revote possible → l'animateur valide la valeur retenue → ticket suivant.
- **Vote** : carte modifiable tant que non révélée ; un arrivant en plein vote peut voter ; on voit qui a voté (pas la valeur) ; en revote, les tours précédents restent visibles.
- **Cartes (fixes)** : 0, 1, 2, 3, 5, 8, 13, 21, `?`, `☕`.
- **Valeur finale** : choisie explicitement par l'animateur parmi les cartes ; ou ticket marqué « non estimé ».
- **Tickets** : saisie manuelle (liste collée + ajout à la volée).
- **Sortie** : récapitulatif tickets + estimations, copiable / export CSV.
- **Session** : éphémère mais robuste (survit rafraîchissement/déconnexion), expire ~24h.
- **Accès** : hébergé en ligne, lien long non devinable, pas de mot de passe.

## Écarté de la V1 (et pourquoi)
- Intégration Jira / outil de backlog — coût (auth, API, mapping) trop élevé ; recopie manuelle acceptée.
- Comptes utilisateurs, historique des sessions — inutiles pour un usage éphémère ; l'export sert d'archive.
- Jeu de cartes configurable, ½ / 40 / 100.

## Hypothèses
- Ateliers à distance / hybrides, 3 à 12 personnes, une session active à la fois.
- Risque accepté : quiconque a le lien entre ; titres de tickets exposés.

## Point ouvert
- Transfert du rôle d'animateur quand celui-ci est déconnecté (il ne peut pas transmettre lui-même).
