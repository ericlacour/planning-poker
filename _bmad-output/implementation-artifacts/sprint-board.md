# Avancement du sprint — planning-poker

> Généré par `node scripts/sprint-board.mjs` depuis `sprint-status.yaml` (mis à jour le 10-06-2026 15:00). Ne pas éditer à la main.

## En un coup d'œil

| | Avancement |
| --- | --- |
| **Stories** | `██████████████████░░` 18/20 (90 %) |
| Epic 1 — Un premier atelier de bout en bout ✅ | `████████████████████` 8/8 (100 %) |
| Epic 2 — Personne ne perd sa place ✅ | `████████████████████` 6/6 (100 %) |
| Epic 3 — Des séances souples et soignées 🟡 | `█████████████░░░░░░░` 4/6 (67 %) |
| **Actions de rétro** | `████████████████░░░░` 12/15 (80 %) |

**En cours :** aucune story  
**Prochaine story :** 3.5 Un outil accessible à tous  
**Actions ouvertes :** 3

## Stories

### Epic 1 — Un premier atelier de bout en bout

✅ done · 8/8 stories · rétrospective : ✅ done

| Story | Titre | Statut | Spec |
| --- | --- | --- | --- |
| 1.1 | Le contrat d'échange front / webservice | ✅ done | [spec](spec-1-1-le-contrat-d-echange-front-webservice.md) |
| 1.2 | Ouvrir l'outil, même quand le serveur dort | ✅ done | [spec](spec-1-2-ouvrir-l-outil-meme-quand-le-serveur-dort.md) |
| 1.3 | Créer une session et en partager le lien | ✅ done | [spec](spec-1-3-creer-une-session-et-en-partager-le-lien.md) |
| 1.4 | Rejoindre une session par son lien | ✅ done | [spec](spec-1-4-rejoindre-une-session-par-son-lien.md) |
| 1.5 | Voir la table en direct | ✅ done | [spec](spec-1-5-voir-la-table-en-direct.md) |
| 1.6 | Voter à l'aveugle | ✅ done | [spec](spec-1-6-voter-a-l-aveugle.md) |
| 1.7 | Révéler, lire le résultat, passer au ticket suivant | ✅ done | [spec](spec-1-7-reveler-lire-le-resultat-passer-au-ticket-suivant.md) |
| 1.8 | Un écran de séance qui tient sur PC et sur téléphone | ✅ done | [spec](spec-1-8-un-ecran-de-seance-qui-tient-sur-pc-et-sur-telephone.md) |

### Epic 2 — Personne ne perd sa place

✅ done · 6/6 stories · rétrospective : ✅ done

| Story | Titre | Statut | Spec |
| --- | --- | --- | --- |
| 2.1 | Voir qui est vraiment là | ✅ done | [spec](spec-2-1-voir-qui-est-vraiment-la.md) |
| 2.2 | Se reconnecter tout seul après une coupure | ✅ done | [spec](spec-2-2-se-reconnecter-tout-seul-apres-une-coupure.md) |
| 2.3 | Revenir après une longue absence | ✅ done | [spec](spec-2-3-revenir-apres-une-longue-absence.md) |
| 2.4 | Reprendre sa place depuis un autre appareil | ✅ done | [spec](spec-2-4-reprendre-sa-place-depuis-un-autre-appareil.md) |
| 2.5 | Une session qui s'efface d'elle-même | ✅ done | [spec](spec-2-5-une-session-qui-s-efface-d-elle-meme.md) |
| 2.6 | Un service qui tient face aux abus | ✅ done | [spec](spec-2-6-un-service-qui-tient-face-aux-abus.md) |

### Epic 3 — Des séances souples et soignées

🟡 in-progress · 4/6 stories · rétrospective : ➖ optional

| Story | Titre | Statut | Spec |
| --- | --- | --- | --- |
| 3.1 | Changer de rôle en pleine séance | ✅ done | [spec](spec-3-1-changer-de-role-en-pleine-seance.md) |
| 3.2 | Masquer pour revoter | ✅ done | [spec](spec-3-2-masquer-pour-revoter.md) |
| 3.3 | Choisir son thème | ✅ done | [spec](spec-3-3-choisir-son-theme.md) |
| 3.4 | Une révélation qui se voit | ✅ done | [spec](spec-3-4-une-revelation-qui-se-voit.md) |
| 3.5 | Un outil accessible à tous | ⚪ backlog | — |
| 3.6 | Les trois parcours garantis de bout en bout | ⚪ backlog | — |

## Actions de rétrospective

### 🔴 À faire (3)

| # | Action | Porteur | Epic | Source |
| --- | --- | --- | --- | --- |
| 4 | Retirer de deferred-work.md l'entrée sur la forme de l'API Render, soldée par la PR #2, et donner un statut aux entrées (R4) | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 8 | Story 3.6 contre le vrai webservice en CI, ou test de fumée qui fait tourner le front et le webservice ensemble plus tôt (V1) | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 15 | En rédigeant chaque spec, reprendre les entrées de deferred-work.md qui la visent et les solder ou les refuser explicitement (L2, F1) | agent dev | 2 | [rétro](epic-2-retro-2026-10-05.md) |

### ✅ Faites (12)

| # | Action | Porteur | Epic | Source |
| --- | --- | --- | --- | --- |
| 1 | Exécuter le test de charge de 10 min (5 × 13) contre Render et consigner le résultat dans deploy/README.md (R1) | Eric | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 2 | Observer l'écran de réveil sur Render après une mise en veille et le consigner dans deploy/README.md (R3) | Eric | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 3 | Poser v1.0 et tenir le premier atelier réel (SM-1), après l'epic 2 et les actions 1, 2, 6 et 7 (R2)<br>↳ _Premier atelier réel tenu sur v0.3 (noté le 2026-10-05). v0.3 contient tout l'epic 2 ; pas d'étiquette v1.0, qui aurait redéployé la même application._ | Eric | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 5 | Spec 2.2 : couvrir toute coupure autre que 4401 et 4404 (y compris 4500 et 1008), avec un retour visible et sans clic perdu (F1) | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 6 | Ajouter les limites de ressources (taille des corps, nombre de sessions et de participants, débit) à l'epic 2, avec la story 2.5, avant v1.0 (F2) | Eric + agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 7 | N'autoriser le déploiement d'une étiquette v* que si la CI est verte sur ce commit, avant v1.0 (V3)<br>↳ _Contrôle manuel retenu par Eric le 2026-10-04 : vérifier la CI verte de main avant de poser l'étiquette (deploy/README.md)._ | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 9 | Faire passer la CI sur les branches de story : déclencheur claude/** ou PR en brouillon dès la première story (V2) | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 10 | Avant chaque PR, comparer le suivi de sprint aux en-têtes des specs (L1) | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 11 | Garder l'historique par story : conserver les branches de travail, ou fusionner par commit de fusion (L2) | Eric | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 12 | Avant de fusionner une série de stories, relecture humaine explicite des décisions de l'agent et des constats rejetés, avec bmad-walkthrough (L5) | Eric + agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 13 | Au début de l'epic 2, extraire le squelette commun des cas d'usage et enregistrer le délai du hello avant de le programmer (D1, F3)<br>↳ _Fait dans la story 3.1 (tâches D1 et F2 de la spec 3.1) : squelette commun des cas d'usage extrait, délai du hello enregistré avant d'être programmé._ | agent dev | 1 | [rétro](epic-1-retro-2026-10-03.md) |
| 14 | Inscrire comme tâches de la spec 3.1 : extraire le squelette commun des cas d usage, corriger le délai du hello, décider du découpage de Session.java avant hide et changeRole (D1, F2, T1, L1)<br>↳ _Fait dans la story 3.1 (tâches D1, F2 et T1 de la spec 3.1) : squelette commun, délai du hello, état du tour sorti dans domain/Round (option B, décision d'Eric du 2026-10-05)._ | agent dev | 2 | [rétro](epic-2-retro-2026-10-05.md) |

---

Légende : ⚪ backlog · 🔵 ready-for-dev · 🟡 in-progress · 🟣 review · ✅ done · 🔴 open
