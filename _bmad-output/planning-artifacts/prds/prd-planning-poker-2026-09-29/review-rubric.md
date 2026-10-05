# PRD Quality Review — PRD : Planning Poker pour ateliers d'affinage

*Revue du 05/10/2026 selon `prd-validation-checklist.md`, sur la version issue de l'Update du même jour (commits `56a9494` et `a3d8f20`). Elle remplace la revue du matin, faite sur le commit `a7b4222` et conservée dans l'historique git. Calibrage inchangé : outil interne d'équipe (3 à 13 personnes), projet d'apprentissage BMAD, PRD en tête de chaîne (UX, architecture et epics en sont dérivés, deux epics sont implémentés), cible de 3 à 5 pages. Les décisions consignées dans `.memlog.md` ne sont pas traitées comme des défauts. C'est le cas en particulier de la règle de FR-5 : un observateur devenu votant pendant un tour révélé ne vote qu'après le prochain effacement, même si le tour est masqué entre-temps.*

*Suivi des constats de la revue précédente (4 medium, 7 low) :*
- *Résolus : FR-16 contradictoire sur le délai d'un départ (medium) ; « ne déconnecte jamais » dans FR-7 (medium) ; addendum contraire à FR-7 sur le jeton d'un participant retiré (medium) ; question de l'hébergeur à la fois ouverte et tranchée (medium) ; FR-5 et FR-13 contradictoires (low) ; révisions non tracées (low, désormais §11 et memlog) ; renvoi de FR-16 à `deploy/README.md` (low). Le frontmatter (`updated: 2026-10-05`) et la mention de Render dans FR-16, relevés dans les notes mécaniques, sont aussi corrigés.*
- *Toujours ouverts, laissés tels quels par décision d'Eric : NFR-3 réduit à un renvoi (low) ; conseil d'usage dans NFR-2 (low) ; rôle non mentionné dans le retour après FR-9 (low) ; états UX de l'addendum sans l'extension de FR-14 (low). Il en va de même pour les notes mécaniques sur le glossaire (Consensus, Synthèse), le nom de NFR-10, la précision de SM-2 et le cas limite d'UJ-2.*

## Overall verdict
Le PRD est de nouveau une source de vérité fiable. FR-16 donne un délai par cas, mesuré de bout en bout ; FR-7 distingue l'onglet en arrière-plan de la page suspendue ; l'addendum, le §9 et le frontmatter ont suivi, et le §11 trace les révisions faites après la finalisation. Il ne reste aucun constat medium ou plus. Les points restants sont mineurs : la règle de FR-5 n'est pas signalée comme exception dans FR-10 et FR-13, quelques passages de l'addendum datent d'avant le choix de l'hébergeur, et le §11 ne mentionne pas la dernière précision de FR-5.

## Decision-readiness — strong
Les décisions sont écrites comme des décisions, avec ce qu'elles coûtent. NFR-1 accepte la perte de session sur plantage et donne le repli (« l'équipe crée une nouvelle session et revote le ticket en cours ») ; NFR-1b fait de la mise en veille en séance un « critère éliminatoire ». FR-8, FR-15 et NFR-6 assument leurs risques « au nom de la confiance d'équipe ». Le relèvement à 6 s de FR-16 est désormais motivé dans le texte (« l'hébergeur retenu […] met environ 5 s à signaler la fermeture d'une connexion ») et daté, avec le détail renvoyé à l'addendum. La seule question ouverte restante (nom du produit) est réellement ouverte et non bloquante. Pas de constat.

## Substance over theater — strong
Rien ne relève du décor. Eric, Sofia et Karim portent chacun des exigences précises ; la Vision est propre au produit ; les NFR sont chiffrées (13 participants, 65 connexions, 2 min et 3 min, 360 px, 44 × 44 px).

### Findings
- **[low]** NFR-3 n'est qu'un renvoi au singulier (§5 NFR-3) — « dans le délai de diffusion fixé par FR-16 » alors que FR-16 fixe trois délais. NFR-3 n'ajoute aucune exigence propre. Laissé tel quel par décision d'Eric. *Fix:* supprimer NFR-3, ou écrire « les délais de FR-16 s'appliquent avec la charge de NFR-4 ».
- **[low]** Un conseil d'usage dans une exigence (§5 NFR-2) — « Conseil d'usage : ouvrir l'outil quelques minutes avant l'atelier » n'est pas vérifiable. Laissé tel quel par décision d'Eric. *Fix:* le déplacer dans l'addendum ; UJ-1 le montre déjà (« dix minutes avant l'atelier »).

## Strategic coherence — strong
La thèse (« fait une seule chose, et doit la faire de façon fiable ») structure le document : FR-7, FR-8, FR-9, FR-16, FR-17, NFR-1 et NFR-1b la portent, SM-2 la valide, et SM-C1 (« chaque ajout accroît le risque de panne en séance ») en est la contre-mesure. Les révisions tracées au §11 (FR-14 étendu, 13 participants, NFR-2 à 2 min, départ à 6 s) restent petites et ne déplacent pas la thèse. Pas de constat.

## Done-ness clarity — strong
Les FR ont des conséquences testables : 20 caractères et casse ignorée (FR-2), 5 minutes (FR-9), une décimale au format français et deux votes minimum (FR-14), « dernière action reçue » (FR-17). FR-16 est maintenant mesurable de bout en bout, cas par cas (« moins d'une seconde », « 6 s au plus », « détectée en 15 s au plus, puis diffusée en moins d'une seconde »). FR-7 borne enfin le « jamais » : l'inactivité et l'onglet en arrière-plan ne déconnectent pas, mais une page suspendue « peut apparaître comme déconnectée » avec un retour transparent.

### Findings
- **[low]** L'exception de FR-5 n'est pas signalée là où s'appliquent les règles générales (§4.1 FR-5, §4.3 FR-10, §4.4 FR-13, §3 « Votant ») — FR-5 dit qu'un observateur devenu votant pendant un tour révélé vote « à partir du tour suivant, après un effacement, même si le tour est masqué entre-temps ». Or FR-13 dit qu'après un masquage « les votants peuvent de nouveau modifier leur carte », FR-10 qu'« un votant peut choisir une carte […] pendant un tour caché », et le glossaire définit le votant comme « participant qui peut choisir une carte ». La règle elle-même est une décision assumée et déjà codée ; le problème est qu'un lecteur de FR-10 ou FR-13 seul ne la voit pas, et que rien ne dit comment FR-6 affiche ce votant pendant le tour masqué (« n'a pas voté » ? cartes désactivées ?). *Fix:* ajouter dans FR-13 « sauf un participant devenu votant pendant la révélation, qui vote après le prochain effacement (FR-5) », et renvoyer à FR-5 depuis FR-10. Le rendu de FR-6 peut rester à l'UX.
- **[low]** Le retour après FR-9 ne dit pas ce que devient le rôle (§4.2 FR-7) — la puce garantit le retour « sous le même pseudo » sans mentionner le rôle, que l'architecture conserve. Laissé tel quel par décision d'Eric. *Fix:* « sous le même pseudo et avec le même rôle ».

## Scope honesty — strong
Les Hors objectifs (§6) et le §7.2 justifient chaque exclusion ; les risques acceptés sont nommés là où ils s'appliquent. Aucune hypothèse ouverte, une seule question ouverte non bloquante. Le nouveau §11 répond au défaut principal de la revue précédente : un lecteur sait désormais quelles exigences ont été relâchées ou étendues depuis la version validée, et quand.

### Findings
- **[low]** Le §11 ne trace pas la dernière précision de FR-5 (§11, puce du 05/10) — elle dit « FR-5 est aligné sur FR-13 (le vote d'un votant devenu observateur est retiré au masquage) », mais pas que la règle du nouveau votant a été précisée (« même si le tour est masqué entre-temps »), après une formulation contraire (« dès que le tour redevient caché ») le même jour. Le memlog consigne bien les deux étapes. *Fix:* compléter la puce : « ; un observateur devenu votant pendant un tour révélé vote après le prochain effacement, même si le tour est masqué entre-temps ».

## Downstream usability — strong
Le glossaire est complet et appliqué, les identifiants sont contigus, chaque UJ a un protagoniste nommé, et l'addendum ne contredit plus le PRD sur le jeton d'un participant retiré ni sur l'hébergeur. Les epics ont été réalignés dans le même mouvement (`a3d8f20`). Les écarts restants sont limités à l'addendum, qui n'est qu'une source de pistes.

### Findings
- **[low]** Une partie de l'addendum date d'avant le choix de l'hébergeur (addendum, « Pistes techniques (recommandations, à confirmer dans l'architecture) », « Veille pendant une séance ») — la section se présente comme des pistes « à confirmer », alors qu'elle contient désormais des faits tranchés (Render retenu, délai mesuré de 5 s). « Veille pendant une séance » dit encore qu'« il faut vérifier » et propose « une parade possible », alors que l'architecture a adopté un signal de vie applicatif toutes les 5 s. Un lecteur qui part de l'addendum suivrait une piste écartée. *Fix:* séparer « Décisions prises (voir l'architecture) » et « Pistes » ; dans « Veille pendant une séance », renvoyer au signal de vie applicatif retenu par l'architecture (AD-8).
- **[low]** Les états UX de l'addendum ignorent l'extension de FR-14 (addendum, « États à rendre visibles ») — « moyenne et consensus (FR-14) », sans la valeur la plus votée, le min ni le max. Laissé tel quel par décision d'Eric. *Fix:* écrire « la synthèse de FR-14 ».

## Shape fit — strong
La forme convient au produit : outil interne, mais multi-participants, en temps réel et utilisé sur téléphone, donc trois UJ avec protagonistes sont utiles sans alourdir. Les SM sont opérationnels, SM-3 assume l'objectif d'apprentissage, et le document reste dans la cible de 3 à 5 pages malgré l'ajout du §11. La forme « tête de chaîne » est respectée. Pas de constat.

## Mechanical notes
- **Frontmatter :** `status: final`, `updated: 2026-10-05`, cohérent avec le dernier commit et avec le memlog (`updated: 2026-10-05T15:58`).
- **Cohérence des seuils :** 13 × 5 = 65 connexions (§1, NFR-4) ; 2 min et 3 min cohérents entre UJ-1, NFR-2 et l'addendum ; 6 s, 15 s et moins d'1 s cohérents entre FR-16, l'addendum et le §11. Le ping de 5 s et l'expiration de 15 s de l'addendum correspondent à AD-8 et à FR-16.
- **Vocabulaire de présence :** « départ » (FR-16, §11, addendum), « déconnexion explicite », « déconnexion brutale », « retrait » (FR-9) et « page suspendue » (FR-7) ne sont pas dans le glossaire, qui ne définit que « Présence ». FR-16 cite « le départ d'un participant » dans la liste des changements, puis le chiffre sous « déconnexion explicite » : la correspondance est claire en contexte, mais un glossaire de deux lignes (départ = déconnexion explicite ; retrait = FR-9) éviterait toute dérive en aval.
- **Doublons de NFR :** NFR-8 (« sobriété ») et NFR-10 (« coût et sobriété technique ») partagent un mot pour deux notions. Laissé tel quel par décision d'Eric.
- **Traçabilité des SM :** SM-1 et SM-2 citent des identifiants existants. SM-2 pourrait préciser qu'un départ affiché en 6 s n'est pas un incident. Laissé tel quel par décision d'Eric.
- **Glossaire :** **Consensus** n'inclut pas la condition « au moins deux votes numériques » de FR-14, et « synthèse », « valeur la plus votée », « valeur minimale » et « valeur maximale » ne sont pas définis. Laissé tel quel par décision d'Eric. « Webservice » (NFR-2) et « Render Free » (§9) sont des termes techniques dans le PRD ; c'est acceptable dans la clôture d'une question ouverte.
- **Orthographe :** « prérempli » (FR-7, addendum « Jeton refusé ») et « pré-rempli » (addendum, « États à rendre visibles »).
- **Identifiants :** FR-1 à FR-17, UJ-1 à UJ-3, SM-1 à SM-3 et SM-C1 contigus et sans doublon ; NFR-1b hors séquence, acceptable. Les renvois internes (§1, §7.2, §9, FR-3, FR-5, FR-7, FR-9, FR-11, FR-13, FR-15, FR-16, NFR-6) se résolvent, ainsi que le chemin de la spine d'architecture cité au §9.
- **Index des hypothèses :** aucun tag `[ASSUMPTION]` dans le texte ; le §10 est cohérent avec le memlog.
- **Protagonistes des UJ :** Eric, Sofia et Karim sont nommés avec leur contexte. Le cas limite d'UJ-2 (« le pseudo redevient disponible ») ne dit pas que cela prend jusqu'à 6 s. Laissé tel quel par décision d'Eric.
- **Sections requises :** toutes présentes pour le niveau d'exigence convenu, plus le §11 Révisions.
