---
title: "Réconciliation d'entrée : brief → PRD"
entree: "_bmad-output/planning-artifacts/briefs/brief-planning-poker-2026-09-29/brief.md"
cibles: "prd.md, addendum.md"
created: 2026-09-29
---

# Réconciliation d'entrée : product brief → PRD

Entrée : `briefs/brief-planning-poker-2026-09-29/brief.md` (statut final).
Cibles : `prd.md` et `addendum.md`. Décisions postérieures au brief lues dans `.memlog.md`.

## Couvert

- Problème : publicité, abonnement, dépendance à un tiers, outil figé (brief L12, L20-22) → PRD §1 Vision, JTBD émotionnel (« sobre et sérieux »), NFR-6, NFR-8.
- Un outil qui fait une seule chose, de façon fiable, pour 3 à 12 personnes (L14) → §1, NFR-4.
- Aucun rôle privilégié ; l'atelier ne dépend de personne ; Eric remplaçable (L14, L42, L47) → §1, FR-1, UJ-3, JTBD social, §6, §7.2.
- Objectif d'apprentissage BMAD (L16, L52) → §1 (dernier paragraphe) et SM-3.
- Accès par lien sans compte ni installation, lien impossible à deviner (L26, L28) → FR-1, FR-2, glossaire, NFR-6, NFR-8, addendum (128 bits).
- Jeu de cartes, vote caché modifiable, visibilité de qui a voté, arrivée en cours de tour (L29) → FR-2, FR-6, FR-10.
- Révéler et masquer nominatifs, par n'importe qui (L30) → FR-12, FR-13.
- Le ticket reste hors de l'outil, présenté en visio (L31) → §6, UJ-1. Cela répond aussi, implicitement, à l'inquiétude sur les titres de tickets confiés à un tiers (L21).
- Rafraîchissement et déconnexion passagère, expiration à ~24 h (L32) → FR-4, FR-7, NFR-1.
- Effacer sans historique, revote (L33) → FR-15, §7.2.
- Une session par atelier, sessions parallèles sans interférence (L34) → §4.1, UJ-3, NFR-4, §7.2.
- Sobriété, « sans rien qui distraie » (L46) → NFR-8, JTBD émotionnel, addendum UX (« même simplicité, sans aucune publicité »).
- Critère d'adoption (L51) → SM-1, rendu mesurable (3 ateliers).
- Exclusions V1 et risque accepté sur les garde-fous (L60-67) → §7.2, FR-15.
- Vision : hébergement d'entreprise, Jira en V2/V3 (L73-75) → §7.2, NFR-9.
- « L'outil reste volontairement petit. Son intérêt, c'est d'appartenir à l'équipe » (L77) → SM-C1 et §1 (« qui appartienne à l'équipe »).

## Manques

### M1. La confiance d'équipe comme principe de conception a disparu
- **Brief L42 :** « un fonctionnement **sans rôle privilégié**, pensé pour une équipe qui se fait confiance. »
- **Dans le PRD :** l'égalité des droits est justifiée seulement par l'indépendance vis-à-vis d'une personne (§1 : « L'atelier ne dépend donc de personne » ; §7.2 : « par choix »). Le mot « confiance » n'apparaît nulle part. Or c'est cette confiance qui rend acceptables trois choix du PRD : droits égaux, aucun garde-fou sur Effacer ou Révéler (FR-15), accès par simple lien. Sans ce principe, un lecteur en aval (UX, architecture) risque de « corriger » ces choix, par exemple en ajoutant une confirmation, un verrou ou un propriétaire de session.
- **Correction proposée :** dans §1, ajouter après « aucun rôle privilégié » : « L'outil est pensé pour une équipe qui se fait confiance : il ne cherche pas à empêcher les erreurs ni les abus entre participants. Une erreur se corrige en revotant. » Dans FR-15 et §7.2 (garde-fous), renvoyer à ce principe.

### M2. Le risque accepté « quiconque a le lien peut entrer » n'est pas nommé
- **Brief L69 :** « **Risque accepté :** toute personne qui a le lien peut entrer dans la session. »
- **Dans le PRD :** FR-2 et le glossaire décrivent le fonctionnement (« seul moyen d'accéder »), et NFR-6 rend le lien impossible à deviner, mais aucun texte ne dit qu'il s'agit d'un **risque accepté**. Rien non plus n'exclut explicitement l'expulsion d'un participant ou le contrôle d'accès : un intrus ne peut pas être retiré, et ce point n'est pas tranché.
- **Correction proposée :** ajouter à NFR-6 : « Il n'y a pas de contrôle d'accès au-delà du lien : toute personne qui a le lien peut entrer. C'est un risque accepté. » Ajouter à §7.2 : « Mot de passe de session, salle d'attente, expulsion d'un participant : exclus (risque accepté, cf. §1). »

### M3. « S'ouvrir en un clic et fonctionner du premier coup » n'a pas de critère
- **Brief L46 :** « l'outil doit s'ouvrir en un clic et fonctionner du premier coup, sans rien qui distraie. »
- **Dans le PRD :** NFR-8 couvre « rien ne distrait », et NFR-2 couvre le démarrage à froid. Mais aucune exigence ne mesure la friction d'entrée. FR-2 ajoute même une étape (choix votant ou observateur) que le brief ne prévoyait pas.
- **Correction proposée :** ajouter à FR-2 : « Le rôle votant est présélectionné. Depuis le lien, rejoindre la session tient en un seul écran : saisir un pseudo et valider. » Éventuellement, ajouter à NFR-8 : « Rejoindre une session prend moins de 10 s hors démarrage à froid. »

### M4. Le coût nul et la sobriété technique ne sont pas des contraintes explicites
- **Brief L38-40, L58 :** « Aucune avancée technique, et nous ne prétendons pas en avoir » ; « aucun abonnement » ; « L'outil est hébergé sur un hébergeur gratuit. »
- **Dans le PRD :** « sans abonnement » n'apparaît que dans la Vision, et l'hébergeur gratuit n'est qu'implicite (NFR-9 : « passer d'un hébergeur gratuit… », §9 Q2). Aucune NFR n'impose un coût d'exploitation nul en V1. L'idée « pas d'ambition technique », qui oriente vers des choix simples et éprouvés, est absente, y compris de l'addendum.
- **Correction proposée :** ajouter une contrainte, par exemple dans NFR-9 ou une nouvelle NFR-10 : « En V1, l'outil tourne sur une offre d'hébergement gratuite, sans aucun coût récurrent. » Dans l'addendum, ajouter : « Le produit ne vise aucune innovation technique : privilégier les solutions les plus simples et les plus éprouvées. »

### M5. Mineur : l'évolutivité est réduite à Jira et à l'hébergement, et la Vision est conditionnelle
- **Brief L22 :** « adapter le déroulé à notre façon de travailler ». **Brief L73 :** « **Si l'équipe adopte l'outil**, deux évolutions sont prévues ».
- **Dans le PRD :** NFR-9 ne cite que l'hébergement et Jira. §7.2 place Jira en V2/V3 sans condition, alors que le brief conditionne les deux évolutions à l'adoption.
- **Correction proposée :** dans NFR-9, ajouter « … et le déroulé du vote doit pouvoir être adapté par l'équipe ». Dans §7.2, écrire : « Prévu en V2/V3, si l'outil est adopté (SM-1) : intégration Jira ».

## Divergences assumées

- **Fiabilité face au plantage du serveur (brief L54 et L32 ↔ NFR-1, SM-2).** Le brief pose « aucun plantage bloquant » comme condition préalable, car un outil qui lâche serait « immédiatement abandonné ». Le PRD accepte la perte d'une session en cas de plantage ou de redémarrage du serveur (memlog, override NFR-1). *À harmoniser :* §1 dit encore « sans jamais lâcher en pleine séance », et le JTBD émotionnel dit « qui ne plante pas devant l'équipe ». Ces formulations contredisent désormais NFR-1 : il faut les nuancer, par exemple « sans lâcher en pleine séance à cause d'une coupure côté participant ». Le risque d'abandon cité par le brief mériterait un seuil dans SM-2 (par exemple « au plus une perte de session sur les N premiers ateliers »), au lieu de « doit rester exceptionnelle ».
- **Unicité du pseudo (brief L28 ↔ FR-2, FR-8, FR-9).** Le brief exige un pseudo unique dans la session. Le PRD limite ce refus aux participants connectés et permet de reprendre un pseudo déconnecté (memlog : changement d'appareil, présence ~5 min).
- **Mode observateur et changement de rôle (FR-2, FR-5, glossaire).** Ils sont absents du brief et ont été ajoutés par décision (memlog : mode observateur, 7 hypothèses confirmées). Les droits restent égaux, donc le principe « sans rôle privilégié » est respecté.
- **Moyenne et consensus (FR-14).** Ils sont absents du brief et ont été ajoutés par décision (memlog : révélation). *Note :* le memlog indique aussi « Aucun ajout par rapport au brief » (L7), ce qui est devenu inexact. Une entrée corrective serait utile.
- **Vote verrouillé après révélation (FR-11).** Le brief ne le précise pas ; décision du memlog.
- **Expiration à 24 h après la création (FR-4) au lieu d'« environ 24 h après le début de l'atelier » (brief L32).** L'écart est négligeable, puisque la session est créée juste avant l'atelier, et le PRD rend la règle testable.
