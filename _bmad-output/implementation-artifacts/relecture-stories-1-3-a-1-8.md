---
objet: relecture humaine a posteriori des stories 1.3 à 1.8
origine: constat L5 de epic-1-retro-2026-10-03.md
diff: 3c4df22..82776cd (branche claude/magical-wright-x00utt, fusionnée dans main par 776ec64)
relecteur: Eric
statut: validée
validation: 2026-10-03, par Eric, sur tous les points, sans réserve
---

# Relecture des stories 1.3 à 1.8

Ces six stories ont été conçues, relues et triées par des agents, puis fusionnées sans validation humaine (constat L5). Ce document rassemble ce qui reste à valider par un humain.

- **Partie A** : les décisions de conception prises par l'agent.
- **Partie B** : les 72 constats de revue que l'agent n'a pas corrigés, soit 9 reportés et 63 rejetés.

Pour chaque ligne, coche la case si tu es d'accord. Sinon, écris ta décision en dessous : **corriger**, **reporter (vers quelle story)** ou **question**. Les constats corrigés par l'agent ne figurent pas ici : leurs correctifs sont dans le code et couverts par les tests.

Ce qui est fait :
- Le parcours complet a été rejoué contre le vrai webservice pendant la rétrospective (section « Vérification du comportement »).
- La CI est verte : 84 e2e sur Chromium et WebKit.

## Partie A : décisions de l'agent

### Story 1.3 : créer une session et en partager le lien

Décisions écrites dans la spec, `spec-1-3-creer-une-session-et-en-partager-le-lien.md:37` :

- [x] Adresse de session `/s/{sessionId}`, lien partagé `location.origin + '/s/' + sessionId`.
  `frontend/src/app/session/session-page.component.ts:13`
- [x] Partage natif seulement si `navigator.share` existe **et** que le pointeur est tactile (`pointer: coarse`) ; sinon copie dans le presse-papiers. « Lien copié » pendant 2 s ; un partage annulé n'affiche rien.
  `frontend/src/app/share/copy-link.ts`
- [x] `INVALID_PSEUDO`, inatteignable depuis le front, affiche « Ce pseudo n'est pas valide. » s'il arrive.
- [x] Le domaine ne garde que l'empreinte SHA-256 du jeton, jamais le jeton lui-même, et la comparaison se fait à temps constant.
  `backend/src/main/java/com/planningpoker/domain/ParticipantToken.java:12`

### Story 1.4 : rejoindre une session par son lien

Décisions implicites, tirées des contraintes et des notes de la spec :

- [x] Tout pseudo déjà présent donne un 409, même celui d'un participant déconnecté. La reprise de place est repoussée à la story 2.4. Conséquence : après avoir vidé son navigateur, on ne peut plus reprendre son propre pseudo.
  `backend/src/main/java/com/planningpoker/domain/Session.java:59`
- [x] L'ordre de contrôle du `POST` est : corps malformé (400), session inconnue (404), pseudo invalide (400), pseudo pris (409). Un `sessionId` mal formé donne 404, jamais 400.
- [x] `joinOrder` commence à 1 : le créateur reçoit 1. Ce point corrige la story 1.3, qui commençait à 0.
- [x] La vérification d'existence (`GET`) se fait sans verrou.

### Story 1.5 : voir la table en direct

- [x] Le test de charge n'a tourné qu'en local, 5 × 13 pendant 2 min ; l'exécution de 10 min sur Render t'est confiée (décision écrite, `spec-1-5-voir-la-table-en-direct.md:44`). Constat R1 de la rétrospective.
- [x] Une coupure autre que 4401 ou 4404 laisse la dernière table affichée, sans message, et les clics sont perdus. La reconnexion est repoussée à la story 2.2. Constat F1 de la rétrospective, observé en vrai.
  `frontend/src/app/session/session.service.ts:48`
- [x] Un participant peut avoir plusieurs connexions : seule la première ouverte et la dernière fermée changent sa présence.
  `backend/src/main/java/com/planningpoker/domain/Session.java:90`
- [x] Une connexion qui déborde (file de plus de 64 Ko, ou envoi bloqué plus de 2 s) est fermée.
  `backend/src/main/java/com/planningpoker/adapter/in/ws/WsConnection.java:261`

### Story 1.6 : voter à l'aveugle

Décisions écrites dans la spec, `spec-1-6-voter-a-l-aveugle.md:43` :

- [x] Le compteur s'accorde au singulier pour 0 et 1 (« 0 vote sur M », « 1 vote sur M »), au pluriel à partir de 2.
- [x] Un observateur voit « Tu observes » à la place de la main, sans lien pour changer de rôle (story 3.1).
- [x] Aucune erreur de `vote` n'est affichée côté front : le prochain instantané fait foi.
  `frontend/src/app/session/session.service.ts:151`

### Story 1.7 : révéler, lire le résultat, passer au ticket suivant

Décisions implicites, tirées des contraintes de la spec :

- [x] **Arrivées tardives** : qui rejoint pendant un tour révélé ne vote qu'au tour suivant (« votera au prochain tour »). Cette notion n'est pas dans l'epic, l'agent l'a introduite.
  `backend/src/main/java/com/planningpoker/domain/Session.java:68`
- [x] Tout participant, observateur compris, peut révéler ou effacer, même sans aucun vote. Effacer un tour caché sans vote crée quand même un nouveau tour.
  `backend/src/main/java/com/planningpoker/domain/Session.java:177`
- [x] « Masquer » est affiché mais toujours inactif, jusqu'à la story 3.2.
- [x] Après une révélation ou un effacement fait **par un autre**, les boutons sont bloqués pendant 1 s ; rien n'est bloqué pour ses propres actions.
- [x] Les annonces lues par les lecteurs d'écran (`aria-live`) se déclenchent quel que soit l'auteur de l'action.

### Story 1.8 : un écran de séance qui tient sur PC et sur téléphone

- [x] WebKit n'est vérifié qu'en CI, faute de WebKit dans le bac à sable (décision écrite, `spec-1-8-…md:39`). La CI de la PR #3 l'a validé : 84 tests.
- [x] Le test de copie dans le presse-papiers n'est pas fait sur WebKit, qui ne gère pas ces permissions dans Playwright.
- [x] Un téléphone en paysage ou une fenêtre très basse font défiler la page : les paliers de la spec ne portent que sur la largeur. Voir aussi le constat rejeté n° 6 de la story 1.8.
- [x] L'étiquette `v1.0` et l'atelier réel te sont confiés (constat R2 de la rétrospective).

## Partie B : constats de revue non corrigés

Chaque ligne indique le numéro du constat dans le journal de tri de la spec, puis le verdict de l'agent en italique.

### Story 1.3 : créer une session et en partager le lien

`spec-1-3-creer-une-session-et-en-partager-le-lien.md`

**Reportés (1)**

- [x] **#12** Pas de limite de taille de corps, de nombre de sessions ni de débit — *medium : épuisement mémoire possible* → defer

**Rejetés (13)**

- [x] **#1** `maxlength="20"` compte les unités UTF-16 : 20 émojis impossibles à saisir — *low : réel, mais c'est la décision de la spec*
- [x] **#2** `trim()` JS et `strip()` Java diffèrent (NBSP) ; `pp.pseudo` non NFC — *low : le front est plus strict, écart cosmétique*
- [x] **#3** Pseudo invisible (U+200B) accepté — *low : conforme à la règle `strip()` de la spec, cas rare*
- [x] **#5** Composant réutilisé si `/s/a` → `/s/b` — *false : aucune navigation entre sessions dans l'application ; page remplacée en 1.4*
- [x] **#6** `/s/{id}` affiche le partage pour tout identifiant — *low : l'intention réserve la vérification à la story 1.4*
- [x] **#8** `AbortSignal.timeout` absent avant Safari 16 — *false : cible = deux dernières versions*
- [x] **#9** Boucle de tirage d'identifiant sans borne — *low : probabilité 2⁻¹²⁸, garde = complexité*
- [x] **#11** Clés JSON en double : la dernière gagne — *low : improbable*
- [x] **#13** Une 500 ne renvoie pas de `problem+json` — *false : le contrat ne garantit pas le corps de `default`*
- [x] **#14** Erreur de pseudo restée affichée après correction — *low : `INVALID_PSEUDO` inatteignable en 1.3*
- [x] **#15** Invariants de `Session` / `ParticipantToken` non vérifiés — *low : aucun appelant fautif identifié*
- [x] **#16** `pp.token.*` s'accumulent dans le stockage — *low : stockage par session voulu (AD-7)*
- [x] **#20** « Lien copié » invisible sous 600 px dans la barre du haut — *low : sur téléphone, le partage natif s'ouvre ; la Session vide montre le retour*

### Story 1.4 : rejoindre une session par son lien

`spec-1-4-rejoindre-une-session-par-son-lien.md`

**Reportés (3)**

- [x] **#4** Arrivées sans plafond, `nextJoinOrder` peut déborder — *medium : même cause que les limites de ressources reportées en 1.3* → defer (entrée 1.3 complétée)
- [x] **#7** Pseudo à espace insécable ou caractère invisible : sosie d'un participant — *medium : règle `strip()` de la story 1.3 ; la changer touche l'intention* → defer
- [x] **#11** 409 systématique au lieu de la reprise d'un déconnecté (FR-8) non tracé — *low : écart voulu par la spec* → defer (repère pour la story 2.4)

**Rejetés (8)**

- [x] **#3** Stockage indisponible : après rechargement, son propre pseudo répond 409 — *low : rare ; la reprise de place relève de la story 2.4*
- [x] **#5** Un jeton rangé périmé ou corrompu mène à la page de session — *low : la story 1.5 efface le jeton sur `4401`*
- [x] **#6** Critère d'acceptation sur le vrai webservice non automatisé — *false : vérifié manuellement (Implementation Notes)*
- [x] **#8** `pp.pseudo` (trim JS) diffère du pseudo serveur — *low : déjà rejeté en 1.3*
- [x] **#9** Écran de vérification vide et muet ; `role="alert"` sur `<main>` ; focus non déplacé — *low : accessibilité, story 3.5*
- [x] **#10** Pas d'e2e pour le 404 au moment de rejoindre ni `INVALID_PSEUDO` — *low : couvert en Vitest*
- [x] **#12** Le créateur repasse par `GET` après la création — *low : un aller-retour de plus, sans effet visible en temps normal*
- [x] **#15** Nettoyage des tests et doublon de SVG — *low : cosmétique*

### Story 1.5 : voir la table en direct

`spec-1-5-voir-la-table-en-direct.md`

**Reportés (1)**

- [x] **#18** Présence invisible aux lecteurs d'écran — *medium* → defer

**Rejetés (16)**

- [x] **#3** Script de charge hors de toute vérification automatique — *low*
- [x] **#5** Envoi bloqué détecté seulement au prochain `enqueue` (≤ 5 s par le `tick`) — *low*
- [x] **#6** Une exception dans `tickAll` arrête les `tick` — *low*
- [x] **#7** `RejectedExecutionException` à l'arrêt — *low*
- [x] **#8** Instantané > 64 Ko — *low*
- [x] **#9** `tick-interval` ≤ 0 — *low*
- [x] **#10** `new WebSocket` lève (contenu mixte) — *low*
- [x] **#11** Instantané d'une autre session accepté — *false*
- [x] **#12** Script de charge : double comptage, dépassement de durée — *low*
- [x] **#13** Course sur `queuedBytes` (dépassement d'un message) — *low*
- [x] **#14** `WebSocketBroadcaster` sans test unitaire — *low*
- [x] **#15** Nettoyage fragile si `disconnect` lève — *low*
- [x] **#17** Rien d'affiché sur coupure avant le premier instantané / pastilles vertes après coupure — *false*
- [x] **#19** Critère 1 sans test automatisé — *low*
- [x] **#20** Statut du sprint désaccordé — *false*
- [x] **#21** Script de charge ignore `error` et l'ordre des `version` — *low*

### Story 1.6 : voter à l'aveugle

`spec-1-6-voter-a-l-aveugle.md`

**Reportés (3)**

- [x] **#6** Place sans vote muette pour un lecteur d'écran — *medium* → defer
- [x] **#7** Main hors du repère `main` — *low* → defer
- [x] **#12** Vote d'un non-votant compté en `hasVoted` — *false* → defer (3.1)

**Rejetés (10)**

- [x] **#2** Statuts du spec et du sprint désaccordés — *false*
- [x] **#3** `vote` sans champ `card` : NPE — *false*
- [x] **#9** Couleurs d'ombre et rayons en dur — *low*
- [x] **#10** Clavier vérifié sous Chromium seul — *low*
- [x] **#11** `VoteUseCase` : participant inconnu non testé — *low*
- [x] **#13** Repli `'0'` de `faceOf` — *low*
- [x] **#14** Vote sur `roundId` périmé sans retour — *false*
- [x] **#15** Coupure : main active, clics perdus — *low*
- [x] **#16** Tour révélé : focus perdu sur les boutons désactivés — *low*
- [x] **#17** `votes` nul ou orphelin dans `Session` — *low*

### Story 1.7 : révéler, lire le résultat, passer au ticket suivant

`spec-1-7-reveler-lire-le-resultat-passer-au-ticket-suivant.md`

**Reportés (1)**

- [x] **#5** Les arrivées tardives comptent dans `progress.expected` et votent refusées avec `ROUND_REVEALED` ; un `changeRole` en tour révélé ne les marque pas. — *maybe-false — inatteignable aujourd'hui (arrivée tardive seulement en tour révélé, compteur masqué) ; deviendrait medium avec `hide` (3.2) et `changeRole` (3.1).* → defer.

**Rejetés (7)**

- [x] **#6** Annonce « Nouveau tour » seule si la reconnexion saute de l'ancien tour à un nouveau tour déjà révélé. — *low — rare (instantanés manqués), correctif = nouvelle branche.*
- [x] **#7** Intention `reveal`/`clear` ignorée sans trace quand la connexion n'a plus d'attache. — *low — course avec la fermeture, sans effet utilisateur.*
- [x] **#8** Boucle de nouveau `roundId` (`RoundUseCase.newRoundId`) non testée. — *low — `IdGenerator` est final, le test demanderait un générateur aléatoire truqué.*
- [x] **#9** Main grisée sans explication pour un votant arrivé tard. — *false — conforme à la spec et à l'UX (« votera au prochain tour » sur sa place).*
- [x] **#10** « Masquer » inactif en `disabled` natif, sans explication. — *low — temporaire jusqu'à la story 3.2, voulu par la spec.*
- [x] **#11** `Card.numericValue()` recalculé à chaque appel. — *low — négligeable (au plus quelques dizaines de cartes).*
- [x] **#12** Test e2e du blocage sans borne haute de durée. — *low — la durée exacte est couverte par le test Vitest en faux temps.*

### Story 1.8 : un écran de séance qui tient sur PC et sur téléphone

`spec-1-8-un-ecran-de-seance-qui-tient-sur-pc-et-sur-telephone.md`

**Reportés (0)**

_aucun_

**Rejetés (9)**

- [x] **#5** Au repli du tiroir (téléphone), une carte de la main qui avait le focus clavier le perd. — *low — clavier sur écran < 600 px, cas rare ; la spec impose un repli complet ; déplacer le focus ajouterait de la logique.*
- [x] **#6** Téléphone en paysage ou fenêtre très basse : la page défile au lieu de garder barres et main visibles. — *low — hors des paliers de la spec (fondés sur la largeur), page encore utilisable par défilement.*
- [x] **#7** L'observateur voit aussi « Tu observes » disparaître au repli. — *low — rien à jouer pour lui pendant un tour révélé ; cohérent avec le repli voulu.*
- [x] **#8** Seul dans la session, tour révélé, téléphone : tiroir replié et pas de barre d'action. — *false — l'absence de barre d'action seul vient de la story 1.7 ; le repli n'y change rien.*
- [x] **#9** Ombre de la carte levée possiblement rognée par le tiroir (`overflow: hidden`). — *low — le rembourrage haut (12 px) couvre le soulèvement ; au plus quelques pixels d'ombre.*
- [x] **#10** Rembourrage de « Tu observes » écrasé par celui du tiroir. — *low — cosmétique.*
- [x] **#11** Données de test incohérentes (synthèse de maquette ≠ votes affichés, consensus avec votes mêlés, nouveau tour gardant des votes). — *low — la synthèse est affichée telle que reçue ; les tests de mise en page n'en dépendent pas.*
- [x] **#12** Ombre et règles du thème sombre dupliquées ; logique dupliquée entre panneau et ligne de résultat. — *low — maintenabilité, sans défaut observable.*
- [x] **#14** Le test « animations réduites » ne vérifie qu'une partie des transitions. — *low — le repli est vérifié par sa hauteur finale.*

## Synthèse de la relecture

Relecture faite par Eric le 2026-10-03, avec l'aide de `bmad-walkthrough` (orientation, parcours par thème, points à risque).

- Décisions de l'agent remises en cause : aucune.
- Constats à rouvrir : aucun. Les 9 constats reportés restent suivis dans `deferred-work.md` et dans la rétrospective (F2, V3).
- Décision : **stories 1.3 à 1.8 validées sur tous les points** (96 points).
