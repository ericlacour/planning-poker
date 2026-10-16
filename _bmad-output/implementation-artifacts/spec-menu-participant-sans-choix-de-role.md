---
title: 'Menu du participant sans choix de rôle'
type: 'change'
created: '2026-10-16'
status: 'done'
baseline_commit: '7a13a64'
route: 'dispatch'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-3-1-changer-de-role-en-pleine-seance.md'
---

## Intent

**Problem:** Sur l'écran Session, le menu du participant (bouton qui affiche le pseudo, barre du haut) propose « Je vote » / « J'observe » en plus du thème. Eric demande de retirer ces deux options.

**Approach:** Le menu ne garde que le groupe « Thème » (« Automatique », « Clair », « Sombre »). Le rôle se choisit à l'entrée (formulaire d'accueil et Rejoindre, inchangé), et un observateur redevient votant par « Je veux voter » sous la main (inchangé).

## Boundaries & Constraints

**Always:**
- Le menu garde son bouton (pseudo + flèche), son `role="menu"`, son groupe « Thème », sa navigation au clavier (flèches, Début / Fin, Entrée / Espace, Échap / Tab) et le retour du focus au bouton.
- À l'ouverture, le focus va au thème coché.
- Formulaire d'entrée (« Je vote » / « J'observe ») et lien « Je veux voter » inchangés.

**Never:**
- Pas de changement côté webservice ni contrat : `changeRole` reste accepté pour les deux rôles.

**Conséquence assumée :** un votant ne peut plus passer observateur en pleine séance depuis l'interface (il faut rejoindre de nouveau en observateur). Le sens observateur → votant reste couvert par « Je veux voter ». FR5 n'est donc plus couvert que dans ce sens par le front.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Ouverture | Clic ou Entrée sur le bouton du pseudo | Liste « Automatique », « Clair », « Sombre », thème actuel coché et focalisé ; aucun « Je vote » / « J'observe » |
| Choix d'un thème | Clic ou Entrée sur un thème | Thème appliqué et mémorisé (`pp.theme`), menu fermé, focus sur le bouton, rien sur le WebSocket |
| Hors connexion | Connexion perdue | Thèmes toujours actifs |
| Observateur | « Je veux voter » | `changeRole VOTER`, comme avant |

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/top-bar/participant-menu.component.ts` -- retirer `ROLES`, le groupe « Ton rôle », le séparateur, `choose()` et `connected` ; focus initial sur le thème coché.
- [x] `frontend/src/styles/top-bar.css` -- retirer `.participant-menu-separator` et l'état `aria-disabled` des items, devenus inutiles.
- [x] `frontend/src/app/top-bar/top-bar-state.ts`, `frontend/src/app/session/session.service.ts` -- commentaires.
- [x] `frontend/src/app/top-bar/participant-menu.component.spec.ts` -- trois choix, focus sur le thème coché, clavier sur trois choix, thèmes actifs hors connexion.
- [x] `frontend/e2e/role.spec.ts` -- Alice entre observatrice : le menu ne propose que le thème, puis « Je veux voter ».
- [x] `frontend/e2e/accessibility.spec.ts`, `frontend/e2e/theme.spec.ts` -- le menu s'ouvre sur « Automatique » ; le parcours au clavier ne change plus de rôle par le menu.
- [x] `EXPERIENCE.md`, `DESIGN.md`, `epics.md` (UX-DR11, story 3.1), `epic-3-context.md` -- documents alignés.

**Acceptance Criteria:**
- Given l'écran Session, when j'ouvre le menu du participant, then il ne propose que « Automatique », « Clair » et « Sombre », le thème actuel coché.
- Given un observateur, when il choisit « Je veux voter », then `changeRole VOTER` est envoyé.

## Verification

**Commands:**
- `cd frontend && npm test` -- 352 tests verts.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npm run e2e` -- 109 tests verts (Chromium).
