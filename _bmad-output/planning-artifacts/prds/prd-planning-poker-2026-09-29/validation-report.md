# Rapport de validation : PRD Planning Poker pour ateliers d'affinage

- **PRD :** `_bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/prd.md` (et `addendum.md`), version du commit `a7b4222` (03/10/2026)
- **Grille :** `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Date :** 2026-10-05
- **Note :** Excellent (toutes les dimensions sont *strong* ou *adequate*, aucun constat *high* ou *critical*)

## Verdict global
Le PRD reste un bon document : court, avec une thèse nette (« fait une seule chose, et doit la faire de façon fiable »), des renoncements assumés et des FR presque toutes testables. Le risque vient des retouches faites après la finalisation, hors du workflow de mise à jour : FR-16 se contredit désormais sur le délai d'un départ (1 s dans la phrase de tête, 6 s dans la puce), FR-7 promet qu'un onglet en arrière-plan ne déconnecte « jamais », ce qui heurte la détection des déconnexions brutales, et l'addendum, le §9 et le frontmatter n'ont pas suivi. Aucun de ces points ne bloque le travail en cours, mais le PRD n'est plus tout à fait la source de vérité que l'architecture et les epics (déjà réalignés) supposent.

Les 14 constats de la revue du 29/09 (1 high, 4 medium, 9 low) sont tous résolus dans le texte actuel. Les nouveaux constats viennent tous des modifications faites après la finalisation.

## Verdicts par dimension
- Décidabilité : strong
- Substance plutôt que théâtre : strong
- Cohérence stratégique : strong
- Clarté du « terminé » : adequate
- Honnêteté du périmètre : strong
- Utilisabilité en aval : adequate
- Adéquation de la forme : strong

## Constats par gravité

### Critical (0)
Aucun.

### High (0)
Aucun.

### Medium (4)

**[Clarté du « terminé »]** FR-16 se contredit sur le délai d'un départ (§4.6 FR-16)
La phrase de tête exige que « l'arrivée ou le départ d'un participant » apparaisse « en moins d'une seconde ». La puce ajoutée le 03/10 dit qu'« un départ apparaît donc chez les autres en 6 s au plus ». Faire partir le délai « du moment où le serveur constate la fermeture » rend en outre la seconde invérifiable de bout en bout. Les epics et `deploy/load-test.mjs` ont déjà choisi 6 s.
Correction : un délai par cas, mesuré de bout en bout. Changements d'état : moins d'1 s. Départ explicite : 6 s au plus. Déconnexion brutale : 15 s au plus pour la détection, puis moins d'1 s pour la diffusion.

**[Clarté du « terminé »]** « Ne déconnecte jamais » contredit la détection des déconnexions brutales (§4.2 FR-7, §4.6 FR-16)
FR-7 affirme qu'un onglet en arrière-plan « ne déconnecte jamais un participant, quelle qu'en soit la durée ». FR-16 classe le « téléphone en veille » parmi les déconnexions brutales détectées en 15 s. Sur téléphone, le participant sera vu comme déconnecté, puis retiré après 5 min (FR-9).
Correction : sur PC, l'inactivité et l'onglet en arrière-plan ne déconnectent jamais. Sur téléphone, une mise en veille peut faire apparaître le participant comme déconnecté, mais son retour est transparent (FR-7, y compris après FR-9).

**[Utilisabilité en aval]** L'addendum contredit le nouveau FR-7 (addendum, « Jeton refusé (FR-7) »)
L'addendum dit qu'un participant « retiré (FR-9) » voit son jeton refusé et revient à l'écran pour rejoindre la session. FR-7 et FR-9 disent désormais qu'il est « remis automatiquement à sa place ».
Correction : le jeton d'un participant retiré reste valable si son pseudo est libre. Il n'est refusé qu'après une reprise depuis un autre appareil (FR-8) ou si le pseudo a été pris entre-temps.

**[Utilisabilité en aval]** La question de l'hébergeur est encore « ouverte » alors que le PRD cite déjà Render (§9 Q2, FR-16, NFR-2, addendum)
L'architecture a tranché (Render Free). NFR-2 parle du « démarrage du webservice » et FR-16 cite « le test de charge sur Render », ce qui fait entrer un fournisseur dans une FR, contrairement au §0.
Correction : clore la question 2 en renvoyant à la spine d'architecture. Dans FR-16, parler de « l'hébergeur retenu » et déplacer la mention de Render dans l'addendum.

### Low (7)

**[Substance]** NFR-3 n'est plus qu'un renvoi ambigu (§5 NFR-3)
FR-16 fixe désormais trois délais, et NFR-3 laisse croire à un délai unique.
Correction : supprimer NFR-3, ou écrire « les délais de FR-16 s'appliquent en fonctionnement normal, pour 13 participants et 5 sessions (NFR-4) ».

**[Substance]** Un conseil d'usage dans une exigence (§5 NFR-2)
« Ouvrir l'outil quelques minutes avant l'atelier » n'est pas vérifiable.
Correction : le déplacer dans l'addendum ou dans UJ-1.

**[Clarté du « terminé »]** FR-5 et FR-13 se contredisent sur le vote d'un votant devenu observateur (§4.1 FR-5, §4.4 FR-13)
FR-5 : le vote reste affiché « jusqu'au prochain effacement ». FR-13 : il « est retiré au masquage ».
Correction : dans FR-5, écrire « jusqu'au prochain masquage ou effacement », et préciser qu'après un masquage, le nouveau votant peut voter.

**[Clarté du « terminé »]** Le retour transparent après FR-9 ne dit pas ce que devient le rôle (§4.2 FR-7, FR-9)
Correction : « sous le même pseudo et avec le même rôle ».

**[Honnêteté du périmètre]** Les révisions faites après la finalisation ne sont pas tracées (frontmatter, §10, `.memlog.md`)
13 participants, FR-14 étendu, NFR-2 à 2 min, départ à 6 s : la décision du 03/10 manque au memlog.
Correction : passer ces changements par le workflow de mise à jour et, si besoin, ajouter une courte section « Révisions ».

**[Utilisabilité en aval]** FR-16 s'appuie sur un document de déploiement (§4.6 FR-16)
« Voir `deploy/README.md` » : si ce fichier change, le renvoi casse.
Correction : consigner la justification dans le memlog ou l'addendum.

**[Utilisabilité en aval]** La liste des états UX de l'addendum ignore l'extension de FR-14
Correction : ajouter la valeur la plus votée, le min et le max, ou renvoyer à « la synthèse de FR-14 ».

## Notes mécaniques
- Le frontmatter indique `updated: 2026-09-29` alors que la dernière modification date du 03/10 (`a7b4222`). Le memlog n'a pas d'entrée pour la décision du 03/10.
- Les seuils sont cohérents : 13 × 5 = 65 connexions, 2 min et 3 min, battement de 5 s et expiration de 15 s.
- NFR-8 et NFR-10 partagent le mot « sobriété » : renommer NFR-10 « coût et simplicité technique ».
- SM-2 gagnerait à préciser qu'un départ affiché en 6 s n'est pas un incident.
- Glossaire : la définition de Consensus n'inclut pas la règle « au moins deux votes numériques », et les termes de la synthèse étendue (valeur la plus votée, min, max) ne sont pas définis.
- Les identifiants sont contigus. NFR-1b sort de la séquence, ce qui est acceptable mais fragile.
- UJ-2 : le pseudo ne se libère qu'au bout de 6 s au plus depuis le 03/10.

## Fichiers de revue
- `review-rubric.md`
