---
title: 'Story 2.2 : se reconnecter tout seul après une coupure'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: '96795b1d467f14d5b21f86c189c271655fada79d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aujourd'hui, une coupure autre que `4401`/`4404` laisse la table figée : pas de reconnexion, la main et les boutons restent actifs et leurs clics partent dans le vide. La rétrospective de l'epic 1 l'a constaté après un redémarrage du webservice (F1, FR7, UJ-2).

**Approach:** `SessionService` détecte la perte (fermeture autre que `4401`/`4404`, ou aucun message du serveur depuis 12 s) et se reconnecte seul selon la séquence d'AD-8, en rejouant `hello`. Il expose l'état de la connexion. La page désactive aussitôt la main et la barre d'action, puis affiche le bandeau ambre « Reconnexion… » après 2 s de coupure.

## Boundaries & Constraints

**Always:**
- Perte constatée : fermeture d'un code autre que `4401`/`4404` (`1001`, `1006`, `1008`, `1009`, `4500`…), ou aucun message du serveur (`tick`, `sessionState`, `error`, même non conforme) depuis 12 s. Le délai court dès la création du socket et repart à chaque message reçu.
- Séquence : tentative immédiate, puis à 1, 2, 4 et 8 s, puis toutes les 10 s, sans fin. Retente aussi immédiatement sur `online` et sur `visibilitychange` vers `visible`, en annulant la tentative programmée. Jamais deux sockets ouverts à la fois.
- Chaque tentative relit le jeton `pp.token.{sessionId}` ; s'il manque : fin `unknownToken`. Elle rejoue `hello`.
- `4404` ou `4401` (y compris pendant une reconnexion) : arrêt de toute tentative, jeton effacé, écran de fin comme aujourd'hui.
- La connexion n'est rétablie qu'à la réception du premier `sessionState` du nouveau socket. Ce premier instantané est accepté quelle que soit sa `version` (AD-5) ; ensuite, une `version` inférieure est ignorée comme aujourd'hui.
- Dès la perte : main grisée (`aria-disabled`, clics sans effet) et boutons de la barre d'action `disabled`, avant tout bandeau. Aucune intention n'est envoyée sans connexion rétablie, aucune mise à jour optimiste. La table et le dernier instantané restent affichés.
- Bandeau `status-banner` : « Reconnexion… », `role="status"`, ambre (`--warning` sur `--warning-soft`), sous la barre du haut, seulement si la coupure dure plus de 2 s ; il disparaît au premier `sessionState`. Il ne masque jamais la table.
- Toutes les minuteries (12 s, 2 s, séquence, `heartbeat`) sont arrêtées à la destruction de la page ou à une fin `4401`/`4404`.

**Never:**
- Pas de changement du contrat ni du webservice, pas de nouveau code de fermeture.
- Pas de file d'intentions rejouées après reconnexion, pas de retrait au bout de 5 min (story 2.3).
- Pas de compteur ni de message d'échec définitif pendant les tentatives : seul le bandeau.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Coupure brève | fermeture `1006`, reconnexion réussie en 1 s | main et boutons désactivés aussitôt, aucun bandeau, réactivés au premier `sessionState` | N/A |
| Coupure longue | serveur injoignable 30 s | tentatives à 0, 1, 2, 4, 8 s puis toutes les 10 s ; bandeau après 2 s | chaque échec relance la séquence suivante |
| Silence | socket ouvert, aucun message depuis 12 s | socket fermé par le client, reconnexion immédiate | N/A |
| Retour réseau | `online` ou onglet redevenu visible pendant l'attente | tentative immédiate, attente programmée annulée | N/A |
| Version plus basse | premier `sessionState` après reconnexion avec `version` inférieure | accepté et affiché | N/A |
| Redémarrage | `1001`, puis le serveur répond `4404` | main et boutons désactivés, « Reconnexion… », puis « Session introuvable », jeton effacé | plus aucune tentative |
| Jeton révoqué | reconnexion fermée en `4401` | écran Rejoindre prérempli, jeton effacé | plus aucune tentative |
| Onglet caché 20 min | serveur qui envoie `tick`, minuteries ralenties | aucune fermeture côté client, une seule connexion | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/app/session/session.service.ts` -- seul propriétaire du socket. `connect`, `onclose` (fermetures `4401`/`4404` déjà traitées), `receive` (règle de `version` à assouplir pour le premier instantané d'un socket), `disconnect`. Commentaire de classe « Pas de reconnexion automatique (story 2.2) » à réécrire.
- `frontend/src/app/session/session-page.component.ts` -- héberge la table, la barre d'action et la main ; le bandeau va en tête de `main.session-page`, donc sous la barre du haut (rendue par `App`).
- `frontend/src/app/session/hand.component.ts` -- `open()` décide si la main est active (grisée par `hand-locked` et `aria-disabled`) ; y ajouter la condition « connexion rétablie ».
- `frontend/src/app/session/action-bar.component.ts` -- `guarded()` désactive déjà les boutons pendant 1 s ; y ajouter la connexion perdue. La garde ignore déjà un instantané de `version` inférieure ou égale (ne rien changer).
- `frontend/src/app/session/session-entry.component.ts` -- réagit à `session.end()` (`notFound`, `unknownToken`) : ne pas changer.
- `frontend/src/styles/session-layout.css` -- disposition de l'écran ; y ajouter `.status-banner` (marge 8 px 16 px 0, hauteur min 44 px, `rounded-md`, 14 px, graisse 500) d'après `mockups/session-telephone.html` l. 84.
- `frontend/src/styles/tokens.css` -- `--warning`, `--warning-soft` existent déjà dans les deux thèmes.
- `frontend/src/app/session/session.service.spec.ts` -- `FakeSocket` (`serverOpens`, `serverSends`, `serverCloses`) à réutiliser avec `vi.useFakeTimers()`.
- `frontend/e2e/fake-session-socket.ts` -- faux serveur Playwright (`routeWebSocket`), `server.routes` compte les connexions.
- `frontend/e2e/table.spec.ts` l. 87-91 -- exige aujourd'hui l'absence de reconnexion après `1011` : à inverser.
- `frontend/e2e/wake.spec.ts` l. 59-65 -- exemple d'horloge simulée (`page.clock.install`, `runFor`).

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/session/session.service.ts` -- signal en lecture seule `connection: 'connecting' | 'open' | 'lost'` (`open` au premier `sessionState` d'un socket) et `reconnecting: boolean` (vrai après 2 s de perte) ; séquence de reconnexion, chien de garde de 12 s, écoute de `online` et `visibilitychange` retirée à la destruction ; intentions refusées hors `open`.
- [x] `frontend/src/app/session/session.service.spec.ts` -- couvrir chaque ligne de la matrice avec des minuteries simulées : délais exacts de la séquence, chien de garde à 11,999 s / 12 s, `online`, fin `4404`/`4401` qui arrête tout, première `version` acceptée, intention non envoyée pendant la perte.
- [x] `frontend/src/app/session/hand.component.ts`, `action-bar.component.ts` -- désactivées tant que `connection()` n'est pas `open` ; tests unitaires associés.
- [x] `frontend/src/app/session/session-page.component.ts`, `styles/session-layout.css` -- bandeau `status-banner` quand `reconnecting()` ; test du composant.
- [x] `frontend/e2e/reconnect.spec.ts` (nouveau) -- coupure brève sans bandeau ; coupure longue avec bandeau puis retour, vote intact ; redémarrage (`1001` puis `4404`) jusqu'à « Session introuvable » ; onglet caché 20 min en horloge simulée, le faux serveur répondant `tick` à chaque `heartbeat`, sans seconde connexion.
- [x] `frontend/e2e/table.spec.ts` -- inverser l'attente « sans reconnexion » après `1011`.

**Acceptance Criteria:**
- Given une coupure en cours, when un participant clique une carte ou un bouton, then rien n'est envoyé et rien ne change à l'écran.
- Given une reconnexion réussie pendant le même tour, when le premier `sessionState` arrive, then le bandeau disparaît, la main et les boutons sont réactivés, et le pseudo, le rôle et le vote sont intacts.
- Given 13 participants sur PC 1280 × 650 avec le bandeau affiché, when la table s'affiche, then la page ne défile toujours pas (seule la zone de la table peut défiler).

## Design Notes

- **`open` au premier `sessionState`, pas à `onopen` :** le serveur peut encore fermer en `4401`/`4404` après l'ouverture ; réactiver la main avant l'instantané laisserait partir des intentions sans table à jour.
- **Le serveur fait foi pour la présence :** un onglet caché envoie `heartbeat` moins souvent, mais le serveur mesure la vivacité par ses pings (story 2.1). Le chien de garde de 12 s ne lit que les messages reçus ; un `tick` toutes les 5 s le nourrit.

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: Vitest vert.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npm run e2e` -- expected: Playwright vert, dont `reconnect.spec.ts` et la disposition.
- `cd backend && ./mvnw -B verify` -- expected: vert (aucun changement attendu).

**Manual checks (if no CLI):**
- Après déploiement : redémarrer le webservice Render pendant une séance ; chacun voit « Reconnexion… » puis « Session introuvable ».

## Review Triage Log

| # | Source | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | blind | Statut de la spec et du suivi de sprint différents ; 2.1 passée à `done` | false | L'étape 5 synchronise le suivi ; 2.1 est fusionnée (PR #7). | rejeté |
| 2 | blind, edge | Région `role="status"` insérée déjà remplie : « Reconnexion… » souvent pas annoncé | medium | Le bandeau et son rôle naissent ensemble dans le `@if`. | patch : région `status-region` toujours présente, seul son contenu change |
| 3 | blind | Retour de la connexion non annoncé | low | Non demandé ; la main redevient active. | rejeté |
| 4 | blind | `disabled` natif sur la barre d'action fait perdre le focus pendant la coupure | low | Réel, mais la spec impose `disabled` ; un clavier retrouve vite la barre. | rejeté |
| 5 | blind | Le chien de garde de 12 s coupe une poignée de main lente (réveil Render) | low | Voulu par la spec (délai dès la création) ; une tentative suivante aboutit une fois le serveur réveillé. | rejeté |
| 6 | blind | Le test « onglet caché 20 min » ne reproduit pas le ralentissement réel | false | Le vrai serveur envoie `tick` toutes les 5 s de lui-même ; le faux serveur le modélise. | rejeté |
| 7 | blind, vgap | Retrait des écouteurs et `visibilitychange` vers `hidden` non testés | low | Vérifié : aucun test ne les exerce. | patch : deux tests ajoutés |
| 8 | vgap | Deux échecs rapides puis retour avant 2 s : absence de bandeau non testée | low | Le code est correct, le cas n'était pas couvert. | patch : test ajouté |
| 9 | blind | `table.spec` ne vérifie plus la table pendant la coupure | low | La reconnexion est immédiate ; l'assertion serait une course. Couvert par `reconnect.spec.ts`. | rejeté |
| 10 | blind | CSS du bandeau : marges et taille de police codée en dur | low | Les marges latérales viennent de `.session-page` ; police remplacée par le jeton. | patch (jetons) |
| 11 | blind | Échec de la première connexion : « Reconnexion… » sur des places vides | false | Voulu : la relecture UX demandait de basculer en « Reconnexion… ». | rejeté |
| 12 | blind | Compteur d'attente non remis à zéro après un retour par `online` | false | `receive` remet `attempts` à 0 au premier instantané, quel que soit le déclencheur. | rejeté |
| 13 | blind | Position du bandeau comparée à la hauteur de la barre et non à son bas | low | Correction directe. | patch |
| 14 | blind | Conversions de type risquées dans `reconnect.spec.ts` | low | Correction directe : attente de la valeur non nulle. | patch |
