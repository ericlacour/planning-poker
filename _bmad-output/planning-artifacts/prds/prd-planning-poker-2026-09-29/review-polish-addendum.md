# Passe de finition : addendum.md

- **Date :** 2026-09-29
- **Cible :** `addendum.md` (PRD Planning Poker pour ateliers d'affinage)
- **Directive :** `skill:bmad-review lenses=structure,prose` (structure, puis prose sur la base des constats de structure)
- **Référentiel :** glossaire et IDs de `prd.md` (§2.2, §3, §4, §5, §9). Le fichier `prd.md` n'a pas été modifié.
- **Lecteur visé :** humains (architecte, UX designer). Guide de style : Microsoft Writing Style Guide, appliqué au français.
- **Lecture de l'objet :** ce document aide l'architecte et l'UX designer à partir des pistes et contraintes déjà identifiées, sans ajouter d'exigences.
- **Modèle de structure retenu :** document de référence, regroupé par sujet.

Toutes les corrections ci-dessous ont été **appliquées** directement dans `addendum.md`. Aucun sens n'a été modifié et aucune piste technique n'a été ajoutée.

## Lentille structure (6 corrections appliquées)

| # | Passage d'origine | Disposition | Motif |
|---|---|---|---|
| S1 | « Pistes techniques » : liste plate de 10 puces (461 mots) | Découpage en 4 sous-sections H3 : Temps réel et cohérence partagée, Accès et identité, État des sessions, Hébergement et exploitation | Une liste plate mélangeait temps réel, identité, stockage et hébergement. Les sous-sections la rendent lisible d'un coup d'œil. |
| S2 | « Identité sans compte » (puce 2) et « Identité (FR-7, FR-8) » (puce 8) | FUSION en deux puces adjacentes : « Jeton de participant » et « Jeton refusé » | Le même sujet était traité à deux endroits éloignés, sous deux titres quasi identiques. |
| S3 | « Détection des déconnexions (FR-16) » (puce 6) | DÉPLACEMENT sous « Temps réel », à côté de la connexion persistante | La puce dépend de FR-16, qui est traité dans la première puce. |
| S4 | « Précautions d'exploitation » (puce 5), qui mêlait redéploiement (NFR-1) et veille (NFR-1b) | SCISSION en « Veille pendant une séance (NFR-1b) » et « Redéploiement (NFR-1) », toutes deux sous « Hébergement et exploitation » | Chaque puce porte désormais une seule contrainte et un seul ID. |
| S5 | « Hébergeur gratuit » (dernière puce) | DÉPLACEMENT en tête de « Hébergement et exploitation » | Le critère général de choix précède les contraintes détaillées. |
| S6 | « Démarrage à froid » : la justification (« Le serveur endormi ne peut pas l'afficher lui-même ») venait en dernier | RÉORDONNANCEMENT : la cause d'abord, puis la solution (« Ce message doit donc venir… ») | Le raisonnement se lit dans l'ordre. |

Impact en volume : 602 mots avant, 669 après (+67 mots, soit +11 %). La hausse vient des intertitres, des libellés ajoutés aux puces et des renvois aux IDs. L'objectif était la lisibilité, pas la réduction. Il n'y a aucune perte de contenu.

## Lentille prose (9 corrections appliquées)

| # | Texte d'origine | Texte révisé | Motif |
|---|---|---|---|
| P1 | « Il est destiné à l'architecture et à la conception UX. On n'y trouve aucune exigence nouvelle, seulement des pistes et des contraintes. » | « Ce document complète le PRD à l'intention de l'architecture et de la conception UX. Il n'ajoute aucune exigence : il ne contient que des pistes et des contraintes. » | Trois phrases courtes remplacées par deux, et suppression du « on » impersonnel. |
| P2 | « Le serveur étant le seul endroit où vit l'état, il suffit à assurer la reconnexion de FR-7 » | « Comme l'état ne vit que sur le serveur, celui-ci suffit aussi à assurer la reconnexion de FR-7 » | Remplacement d'un participe absolu lourd, et suppression de l'antécédent ambigu du « il ». |
| P3 | « Pour FR-8, un pseudo déconnecté peut être repris » | « Pour FR-8, le pseudo d'un participant déconnecté peut être repris » | Cohérence avec le glossaire : la présence (connecté ou déconnecté) est un état du participant, pas du pseudo. |
| P4 | « parce que le participant a été repris ailleurs ou retiré » | « parce que le participant a été repris depuis un autre appareil (FR-8) ou retiré (FR-9) » | Formulation de FR-8 reprise, et renvois aux IDs ajoutés. |
| P5 | « L'expiration à 24 h de FR-4 peut se faire par un simple nettoyage périodique » | « … peut passer par un simple nettoyage périodique » | Remplacement d'un verbe faible. |
| P6 | « permet de respecter le délai de détection » | « permet de respecter le délai de détection d'une déconnexion brutale » | Le délai visé était implicite. Il s'agit du délai de 15 s de FR-16 pour une déconnexion brutale. |
| P7 | « Sur certaines offres gratuites, seules les requêtes HTTP comptent comme activité. » (phrase isolée) | Rattachée par « car » à la phrase qui la justifie | Le lien de cause à effet était implicite. |
| P8 | « Ce point était déjà relevé dans l'addendum du brief. » | « Ce point figurait déjà dans l'addendum du brief et reste une question ouverte du PRD (§9). » | Renvoi à la question ouverte n° 2 du PRD, qui porte exactement sur ce point. |
| P9 | Renvois aux IDs dans les libellés et la section UX | Ajout de : (NFR-6), (NFR-9) dans le libellé, (NFR-1b, NFR-2), (NFR-4) pour les limites WebSocket, (PRD §2.2), (NFR-5), (NFR-2), (FR-7), (FR-6, FR-12), (FR-14) | Chaque piste ou précision renvoie à l'exigence qu'elle sert. Les renvois NFR-1b et NFR-4 dans « Choix de l'hébergeur » reprennent le rattachement déjà fait par la question ouverte n° 2 du PRD (§9). |

Choix de style conservés : libellés en gras suivis d'un deux-points, infinitifs de consigne (« ne pas redéployer »), « V1 », exemples concrets (Redis, CDN), phrase finale sur Scrum Poker Online.

## À arbitrer (non appliqué, touche au fond)

1. **États UX incomplets par rapport au PRD.** La liste « États à rendre visibles » ne cite pas plusieurs états que le PRD exige pourtant d'afficher :
   - lien de session inconnu ou expiré (FR-3) ;
   - message d'indisponibilité et bouton pour réessayer au-delà de 60 s (NFR-2) ;
   - pseudo refusé avec un message explicite (FR-2) ;
   - écran pour rejoindre la session avec le pseudo pré-rempli (FR-7) ;
   - moyenne (FR-14).

   Faut-il les ajouter ? Ce serait un ajout de contenu.
2. **Statut du « doit ».** L'intro et le titre annoncent des pistes « à trancher dans l'architecture ». Pourtant, deux puces sont prescriptives :
   - « l'accès à l'état des sessions **doit** passer par une interface » ;
   - « ce message **doit** donc venir d'une page statique ».

   Ces deux points sont-ils des contraintes déjà décidées ou de simples pistes ? Selon la réponse, il faudrait adoucir le verbe ou le signaler comme contrainte.
3. **Page statique de démarrage à froid.** La piste couvre le message « Réveil du serveur… », mais ne dit pas si cette même page gère aussi le délai de 60 s et le bouton pour réessayer de NFR-2. Faut-il le préciser ?
