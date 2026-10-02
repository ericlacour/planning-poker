- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-le-contrat-d-echange-front-webservice.md`
  summary: Faire tourner `npm ci && npm run validate && npm test` dans `contract/` en CI GitHub Actions, sous Node 24.
  evidence: Aucun workflow n'existe ; la story 1.2 (AR15) crée la CI backend, frontend et contrat.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-le-contrat-d-echange-front-webservice.md`
  summary: Vérifier automatiquement que le contrat n'évolue que par ajout (AD-13), en le comparant à la dernière version étiquetée `v*`.
  evidence: Aucune version de référence n'existe encore ; la règle n'est aujourd'hui que documentée dans `contract/README.md`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-ouvrir-l-outil-meme-quand-le-serveur-dort.md`
  summary: Ne déployer une étiquette `v*` que si la CI est verte sur ce commit (vérification des checks dans `deploy.yml`, ou règle de protection).
  evidence: Le workflow de déploiement ne consulte pas l'état de la CI ; seule la discipline humaine l'empêche aujourd'hui.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-ouvrir-l-outil-meme-quand-le-serveur-dort.md`
  summary: Confirmer au premier déploiement `v0.1` la forme réelle de la réponse `GET /v1/services/{id}/deploys` de Render et le blueprint `deploy/render.yaml`.
  evidence: `render-deploy.sh` est testé contre une fausse API ; aucun compte Render n'était accessible pendant la story 1.2.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-creer-une-session-et-en-partager-le-lien.md`
  summary: Borner les ressources du webservice : taille des corps REST, nombre de sessions en mémoire et débit de `POST /api/sessions`.
  evidence: Le pseudo brut est lu en entier avant le contrôle des 200 points de code, et le stockage en mémoire n'a ni plafond ni expiration avant la story 2.5 ; un client anonyme peut épuiser la mémoire.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-rejoindre-une-session-par-son-lien.md`
  summary: Plafonner le nombre de participants par session (et donc `nextJoinOrder`), avec les autres limites de ressources de la story 1.3.
  evidence: `Session.join` accepte des arrivées sans limite ; un client anonyme peut gonfler une session indéfiniment.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-rejoindre-une-session-par-son-lien.md`
  summary: Décider si le pseudo doit aussi perdre les espaces insécables et caractères invisibles (U+00A0, U+200B, U+FEFF) avant comparaison, pour empêcher les sosies.
  evidence: `Pseudo` applique `String.strip()` (règle de la story 1.3) ; « Sofia » précédé d'un U+00A0 rejoint comme un participant distinct, identique à l'écran.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-rejoindre-une-session-par-son-lien.md`
  summary: Story 2.4 — remplacer le 409 systématique par la reprise d'un participant déconnecté portant le même pseudo (FR-8, `openapi.yaml` joinSession).
  evidence: `Session.join` lève `PseudoTakenException` pour tout pseudo présent ; la notion de déconnexion n'existait pas encore.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-voir-la-table-en-direct.md`
  summary: Rendre la présence de chaque place perceptible aux lecteurs d'écran (texte masqué ou aria-label à côté de la pastille `presence-dot`).
  evidence: La pastille est en `aria-hidden="true"` sans alternative textuelle ; les libellés de présence relèvent de la story 2.1 et l'accessibilité de la story 3.5.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-voter-a-l-aveugle.md`
  summary: Donner un libellé « n'a pas voté » (ou un état sur l'étiquette de la place) aux places sans vote, pour les lecteurs d'écran.
  evidence: La carte vide est en `aria-hidden` alors que le dos annonce « a voté » ; relève de la story 3.5.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-voter-a-l-aveugle.md`
  summary: Placer la main « Ta carte » dans un repère (dans `main` ou une section nommée).
  evidence: `<app-hand>` est rendu après `</main>` dans `session-page.component.ts` ; à traiter avec la disposition téléphone (1.8) ou l'accessibilité (3.5).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-voter-a-l-aveugle.md`
  summary: Au changement de rôle (story 3.1), retirer le vote d'un votant devenu observateur, ou filtrer `hasVoted` par rôle dans l'instantané.
  evidence: `SessionSnapshot` pose `hasVoted = vote != null` quel que soit le rôle, alors que `progress` ne compte que les votants.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-reveler-lire-le-resultat-passer-au-ticket-suivant.md`
  summary: Les arrivées tardives (`canVoteThisRound` faux) devront être traitées avec `hide` (3.2) et `changeRole` (3.1) : exclues ou non de `progress.expected`, raison de refus d'un vote sur un tour redevenu caché, marquage d'un observateur devenu votant en tour révélé.
  evidence: Non vérifié (medium si vrai) — aujourd'hui une arrivée tardive n'existe que pendant un tour révélé, où le compteur est masqué ; à trancher dans les specs 3.1 et 3.2 (le schéma `session-state.json` dit déjà qu'un observateur devenu votant en tour révélé ne vote pas ce tour).
