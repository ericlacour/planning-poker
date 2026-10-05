# Rapport de validation : PRD Planning Poker pour ateliers d'affinage

- **PRD :** `_bmad-output/planning-artifacts/prds/prd-planning-poker-2026-09-29/prd.md` (et `addendum.md`), version issue de l'Update du 05/10/2026 (commits `56a9494` et `a3d8f20`)
- **Grille :** `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Date :** 2026-10-05 (deuxième passage)
- **Note :** Excellent (les sept dimensions sont *strong*, aucun constat *medium* ou plus)

## Verdict global
Le PRD est de nouveau une source de vérité fiable. FR-16 donne un délai par cas, mesuré de bout en bout ; FR-7 distingue l'onglet en arrière-plan de la page suspendue ; l'addendum, le §9 et le frontmatter ont suivi, et le §11 trace les révisions faites après la finalisation. Il ne reste aucun constat medium ou plus. Les points restants sont mineurs : la règle de FR-5 n'est pas signalée comme exception dans FR-10 et FR-13, quelques passages de l'addendum datent d'avant le choix de l'hébergeur, et le §11 ne mentionne pas la dernière précision de FR-5.

Par rapport à la revue du matin (commit `a7b4222`) : les 4 constats medium et 3 constats low sont résolus. Les 4 autres constats low ont été laissés tels quels par décision d'Eric. Trois nouveaux constats low sont apparus.

## Verdicts par dimension
- Décidabilité : strong
- Substance plutôt que théâtre : strong
- Cohérence stratégique : strong
- Clarté du « terminé » : strong
- Honnêteté du périmètre : strong
- Utilisabilité en aval : strong
- Adéquation de la forme : strong

## Constats par gravité

### Critical (0)
Aucun.

### High (0)
Aucun.

### Medium (0)
Aucun.

### Low (7)

**Nouveaux constats**

**[Clarté du « terminé »]** L'exception de FR-5 n'est pas signalée là où s'appliquent les règles générales (FR-5, FR-10, FR-13, glossaire « Votant »)
Un observateur devenu votant pendant un tour révélé vote après le prochain effacement, même si le tour est masqué entre-temps. FR-13 dit pourtant qu'après un masquage « les votants peuvent de nouveau modifier leur carte ». La règle est une décision assumée et déjà codée ; c'est sa visibilité qui manque.
Correction : dans FR-13, ajouter « sauf un participant devenu votant pendant la révélation, qui vote après le prochain effacement (FR-5) », et renvoyer à FR-5 depuis FR-10.

**[Honnêteté du périmètre]** Le §11 ne trace pas la dernière précision de FR-5 (§11, puce du 05/10)
Correction : compléter la puce : « un observateur devenu votant pendant un tour révélé vote après le prochain effacement, même si le tour est masqué entre-temps ».

**[Utilisabilité en aval]** Une partie de l'addendum date d'avant le choix de l'hébergeur (addendum, « Pistes techniques (… à confirmer dans l'architecture) », « Veille pendant une séance »)
La section se présente comme des pistes « à confirmer », alors qu'elle contient des faits tranchés (Render retenu, délai mesuré de 5 s). « Veille pendant une séance » dit encore qu'« il faut vérifier » et propose « une parade possible », alors que l'architecture a adopté un signal de vie applicatif toutes les 5 s.
Correction : séparer « Décisions prises (voir l'architecture) » et « Pistes » ; renvoyer au signal de vie retenu par l'architecture (AD-8).

**Laissés tels quels par décision d'Eric**

- **[Substance]** NFR-3 n'est qu'un renvoi à FR-16, qui fixe trois délais.
- **[Substance]** Conseil d'usage (« ouvrir l'outil quelques minutes avant l'atelier ») dans NFR-2.
- **[Clarté du « terminé »]** Le retour après FR-9 ne mentionne pas le rôle.
- **[Utilisabilité en aval]** Les états UX de l'addendum ignorent l'extension de FR-14.

## Notes mécaniques
- Frontmatter cohérent : `status: final`, `updated: 2026-10-05`.
- Seuils cohérents : 13 × 5 = 65 connexions ; 2 min et 3 min ; 6 s, 15 s et moins d'1 s entre FR-16, l'addendum et le §11 ; ping de 5 s et expiration de 15 s conformes à AD-8.
- Vocabulaire de présence (« départ », « déconnexion explicite », « déconnexion brutale », « retrait », « page suspendue ») absent du glossaire ; deux lignes suffiraient (départ = déconnexion explicite ; retrait = FR-9).
- Orthographe : « prérempli » et « pré-rempli » coexistent.
- Laissés tels quels par décision d'Eric : glossaire (Consensus, Synthèse), nom de NFR-10, précision de SM-2, cas limite d'UJ-2.
- Identifiants contigus, renvois internes valides, aucun tag `[ASSUMPTION]`, toutes les sections requises présentes.

## Fichiers de revue
- `review-rubric.md`
