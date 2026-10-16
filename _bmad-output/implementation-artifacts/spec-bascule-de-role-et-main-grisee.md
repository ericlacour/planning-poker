---
title: 'Bascule de rôle en bas à gauche et main grisée pour un observateur'
type: 'change'
created: '2026-10-16'
status: 'done'
baseline_commit: 'claude/wonderful-shannon-skjtkx (après spec-menu-participant-sans-choix-de-role.md)'
route: 'dispatch'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-menu-participant-sans-choix-de-role.md'
---

## Intent

**Problem:** Après le retrait de « Je vote » / « J'observe » du menu du participant, un votant ne pouvait plus passer observateur en pleine séance. Un observateur, lui, voyait « Tu observes » et « Je veux voter » à la place des cartes.

**Approach (demande d'Eric, 2026-10-16) :**
1. Retirer « Tu observes » et « Je veux voter ».
2. Placer en bas à gauche une bascule « Je vote » / « J'observe ».
3. Afficher les cartes quel que soit le rôle : actives pour un votant, visibles mais grisées pour un observateur.

## Boundaries & Constraints

**Always:**
- La bascule (`hand-role`) est un groupe « Ton rôle » de deux boutons bascule (`aria-pressed`), mon rôle actuel enfoncé, avec l'aspect des boutons segmentés du formulaire d'entrée. Les deux boutons sont dans l'ordre de tabulation. Pas de radios à flèches : une flèche ne doit pas changer de rôle par mégarde (en tour caché, passer observateur retire le vote).
- Choisir l'autre rôle envoie `changeRole` ; choisir le rôle actuel n'envoie rien ; hors connexion, la bascule est grisée (`aria-disabled`) et sans effet. Pas de mise à jour optimiste.
- Observateur : la barre d'outils « Ta carte » et ses cartes sont `aria-disabled`, grisées comme en tour révélé ; pas de « Choisis ta carte ».
- Disposition : ≥ 900 px, la bascule est à gauche des cartes, alignée en bas. < 900 px, elle passe sous les cartes, alignée à gauche (sinon débordement horizontal au zoom 200 %). Sur téléphone, elle se replie avec le tiroir en tour révélé.

**Never:**
- Pas de changement côté webservice ni contrat.
- Le menu du participant reste sans choix de rôle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Votant | Tour caché | Cartes actives, « Je vote » enfoncé |
| Votant → observateur | Clic « J'observe » | `changeRole OBSERVER` ; à l'instantané, cartes grisées, « J'observe » enfoncé |
| Observateur → votant | Clic « Je vote » | `changeRole VOTER` ; à l'instantané, cartes actives (ou grisées jusqu'au tour suivant si le tour est révélé, `canVoteThisRound: false`) |
| Rôle actuel | Clic sur le bouton enfoncé | Rien n'est envoyé |
| Hors connexion | Connexion perdue | Bascule grisée, sans effet |

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/session/hand.component.ts` -- main toujours rendue, bascule `hand-role`, `chooseRole()` à la place de `becomeVoter()`.
- [x] `frontend/src/styles/cards.css` -- `.hand` en grille (bascule à gauche, cartes), styles de la bascule ; suppression de `.hand-observer` et `.link-button`.
- [x] `frontend/src/styles/session-layout.css` -- < 900 px : bascule sous les cartes, à gauche.
- [x] `frontend/scripts/contrast.test.mjs`, commentaires de `session-page`, `session.service`, `participant-menu`.
- [x] Tests unitaires : `hand.component.spec.ts`, `session-page.component.spec.ts`.
- [x] E2E : `role.spec.ts` (aller-retour par la bascule, position en bas à gauche), `vote.spec.ts`, `accessibility.spec.ts` (bascule au clavier), `e2e-journeys/uj1-affinage.spec.ts`.
- [x] `EXPERIENCE.md`, `DESIGN.md`, `epics.md` (UX-DR7, story 3.1), `epic-3-context.md`, `epics-recap.html`.

**Acceptance Criteria:**
- Given un observateur, when l'écran Session s'affiche, then il voit toutes les cartes, grisées, sans « Tu observes » ni « Je veux voter », et « J'observe » enfoncé en bas à gauche.
- Given un votant, when il clique « J'observe », then `changeRole OBSERVER` est envoyé ; when il clique ensuite « Je vote », then `changeRole VOTER` est envoyé.

## Verification

**Commands:**
- `cd frontend && npm test` -- 354 tests unitaires et 15 tests de scripts verts.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npm run e2e` -- 109 tests verts (Chromium).
- `e2e:journeys` non lancé en local (JDK 25 requis) : à vérifier en CI.
