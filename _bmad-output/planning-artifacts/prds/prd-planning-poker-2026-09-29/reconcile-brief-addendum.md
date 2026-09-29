# Réconciliation : addendum du brief → PRD

Entrée : `_bmad-output/planning-artifacts/briefs/brief-planning-poker-2026-09-29/addendum.md`
Cibles : `prd.md`, `addendum.md` (PRD du 29/09/2026), à la lumière de `.memlog.md`.

## Couvert

- **Animateur supprimé, droits égaux** (L7, L9) : §1, §6 « pas un outil d'animation », §7.2, glossaire « Observateur », FR-1, FR-12, FR-13, FR-15.
- **Transfert du rôle d'animateur** (L10) : sans objet, puisqu'aucun rôle n'existe (§6, §7.2).
- **Liste de tickets saisie à la main** (L11) : §6 « pas un outil de gestion de backlog », §7.2.
- **Valeur finale et statut « non estimé »** (L12) : §7.2.
- **Export CSV** (L13, en partie) : §7.2.
- **Votes des tours précédents lors d'un revote** (L14) : §7.2 et FR-15 (« aucun historique »).
- **Temps réel** (L21) : FR-16, NFR-3 ; piste WebSocket dans l'addendum du PRD.
- **Session éphémère d'environ 24 h, sans comptes** (L22) : glossaire « Session », FR-4, FR-1, NFR-6, §6.
- **Évolutivité vers l'hébergement en entreprise et Jira** (L23) : NFR-9, §7.2.
- **Hébergeur gratuit : veille et démarrage à froid** (L20) : NFR-2, UJ-1 (cas limite), §9 Q2, addendum du PRD (« Hébergeur gratuit », « Précautions d'exploitation »).
- **Session qui survit à un rafraîchissement** (L20) : FR-7, NFR-1.
- **Question ouverte : reconnexion sous le même pseudo** (L27) : tranchée par FR-7 (même navigateur), FR-8 (autre appareil), FR-9 (retrait après 5 min).
- **Question ouverte : révéler et effacer cliqués en même temps** (L28) : tranchée par FR-17 (la dernière action reçue s'applique, avec un état final identique pour tous).

## Manques

1. **Mise en veille pendant une séance active.**
   *Source :* L20, « mettent l'application en veille après une période d'inactivité ».
   *Ce qui manque :* le PRD traite la veille uniquement au démarrage (NFR-2). Le risque d'une mise en veille pendant l'atelier, alors que des WebSockets sont ouverts, n'apparaît que comme « précaution d'exploitation » dans l'addendum du PRD (L10). Ce n'est ni une exigence ni un critère de choix de l'hébergeur. Or NFR-1 n'accepte la perte d'une session qu'en cas de plantage ou de redémarrage du serveur, pas en cas de veille prévisible. Le memlog (L19) indique aussi « aucune coupure tolérée une fois la session lancée ».
   *Correction proposée :* compléter NFR-2 ou §9 Q2 : « L'hébergeur retenu ne doit pas mettre l'application en veille tant qu'au moins une connexion temps réel est ouverte. Une session active ne doit jamais être perdue pour cause de mise en veille. »

2. **Limite de connexions temps réel de l'hébergeur face à la capacité visée.**
   *Source :* L20, « limitent les connexions temps réel (WebSocket) ».
   *Ce qui manque :* l'addendum du PRD (L12) demande de vérifier « les limites sur les WebSockets », sans seuil chiffré. NFR-4 implique pourtant au moins 60 connexions simultanées (12 participants × 5 sessions), sans compter les onglets en double ni les reconnexions.
   *Correction proposée :* ajouter dans l'addendum du PRD, rubrique « Hébergeur gratuit » : « le candidat doit accepter au moins 60 connexions WebSocket simultanées (NFR-4), avec une marge pour les reconnexions ».

3. **Évolutivité et état gardé en mémoire.**
   *Source :* L23, « L'hébergement en entreprise […] ne doit pas imposer de tout réécrire ».
   *Ce qui manque :* NFR-9 reprend l'intention, mais l'addendum du PRD ne propose aucune piste pour la tenir. Il retient au contraire un état en mémoire sur une seule instance (L9), ce qui peut bloquer un hébergement d'entreprise à plusieurs instances ou avec redémarrages planifiés. NFR-9 n'est pas non plus vérifiable en l'état.
   *Correction proposée :* ajouter dans l'addendum du PRD une piste « Évolutivité » : isoler le stockage de l'état des sessions derrière une interface, pour pouvoir remplacer la mémoire par un stockage partagé sans toucher au reste ; mettre la configuration propre à l'hébergeur dans des variables d'environnement ; prévoir un point d'extension pour Jira. Pour rendre NFR-9 vérifiable, on peut préciser : « le passage à un autre stockage ou à un autre hébergeur ne modifie que le module concerné ».

4. **Récapitulatif copiable, et possibilité de retour des éléments abandonnés.**
   *Source :* L13, « le récapitulatif copiable et l'export CSV » ; L16, « il pourra revenir dans une version ultérieure. Les détails figurent dans l'idée forgée ».
   *Ce qui manque :* §7.2 cite l'export CSV, mais pas le récapitulatif copiable. Rien n'indique non plus que les éléments abandonnés peuvent revenir, ni où en trouver le détail.
   *Correction proposée :* dans §7.2, écrire « Liste de tickets, valeur retenue, statut « non estimé », récapitulatif copiable et export CSV ». Ajouter ensuite une phrase : « Ces éléments pourront revenir si l'équipe les réclame ; leur détail figure dans l'idée forgée (`_bmad-output/forge/planning-poker-affinage/forged-idea.md`). »

## Divergences assumées

- **« Zéro plantage en affinage » et état qui ne survit pas aux redémarrages** (L20) : le brief exige zéro plantage, alors que NFR-1 accepte la perte de session en cas de plantage ou de redémarrage du serveur, et SM-2 exclut ce cas. Cette divergence est justifiée par le memlog (override NFR-1, L22). Elle explique aussi pourquoi le PRD accepte un hébergeur qui ne garde aucun état entre deux redémarrages (addendum du PRD, « Persistance »).
- **Expiration « environ 24 h »** (L22) : FR-4 fixe une durée précise de 24 h après la création. C'est une précision, pas un écart de fond.
- **Question L28 (révéler et effacer simultanés)** : c'est la règle « la dernière action gagne » qui a été retenue (memlog L14). Si « révéler » arrive juste après « effacer », le tour vide est révélé et tous les votants apparaissent comme « n'a pas voté ». Cette conséquence est cohérente avec FR-12 et avec l'absence de garde-fou (FR-15, §7.2).
