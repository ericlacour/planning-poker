---
title: 'Story 3.3 : choisir son thème'
type: 'feature'
created: '2026-10-06'
status: 'in-review'
baseline_commit: '6183cf483ff8b57a9589b045e316124430689c8b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les jetons sombres existent déjà (`tokens.css`, story 1.8) et suivent `prefers-color-scheme`, mais personne ne peut forcer le clair ou le sombre (UX-DR2) : le menu du participant ne propose que le rôle. En sombre, la plupart des ombres restent, et aucun test ne garantit les contrastes AA.

**Approach:** Ajouter au menu du participant un groupe « Thème » (« Automatique », « Clair », « Sombre »). Un service front, hors de `SessionService`, pose ou retire `data-theme` sur `<html>` et mémorise le choix sous `pp.theme`. Le choix mémorisé est appliqué dès le démarrage, avant Angular. En sombre, toutes les ombres sont supprimées. Un test vérifie les contrastes des couples de jetons dans les deux thèmes.

## Boundaries & Constraints

**Always:**
- Valeurs de `pp.theme` : `auto`, `light`, `dark`. Une valeur absente ou inconnue vaut `auto`. `auto` retire `data-theme`, ce qui fait suivre `prefers-color-scheme`. `light` et `dark` posent `data-theme`, qui l'emporte sur le système dans les deux sens.
- Le choix s'applique immédiatement, sans rechargement. Il reste actif hors connexion : les choix de thème ne sont jamais grisés, contrairement aux choix de rôle.
- Lecture et écriture via `BrowserStorage`, sans jamais lever d'erreur. Si le stockage est indisponible, le choix vaut pour la page en cours.
- Menu : un seul `role="menu"`, deux `role="group"` (« Ton rôle », puis « Thème »), avec un séparateur entre les deux. Le choix actuel est coché (`menuitemradio`). Les flèches parcourent les cinq choix d'un groupe à l'autre ; Home et End vont au premier et au dernier. Choisir un thème ferme le menu et rend le focus au bouton, comme pour un rôle. À l'ouverture, le focus va au rôle coché.
- En sombre (automatique ou forcé), aucune `box-shadow` d'élévation (panneaux, liste du menu, carte choisie, tiroir, ligne de résultat). Les surfaces plus claires détachent les éléments. La liste du menu prend le fond `surface-muted`. Les `box-shadow: inset` qui dessinent la marge des dos de cartes restent.
- Libellés exacts : « Thème », « Automatique », « Clair », « Sombre ».
- **Lien « Je veux voter »** (décision d'Eric, 2026-10-06, option A) : en thème clair, le texte `primary` sur `surface-muted` n'atteint que 3,99:1. Le lien passe en texte `foreground`, souligné en `primary` (graphique ≥ 3:1), dans les deux thèmes. Seul le CSS de `.link-button` change.

**Never:**
- Aucun passage par le serveur, le contrat ou `SessionService`. Aucune nouvelle clé de stockage.
- Ne pas modifier `tokens.css` à la main : il reflète `DESIGN.md`. Aucune propriété `--*-dark`.
- Pas de script inline dans `index.html` : la CSP l'interdit.
- Pas de choix du thème hors de l'écran Session : le menu n'existe que là, mais le thème mémorisé s'applique à tous les écrans.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Premier passage | `pp.theme` absent, système sombre | Pas de `data-theme`, sombre affiché, « Automatique » coché | — |
| Forcer le clair | Système sombre, choix « Clair » | `data-theme="light"`, clair immédiat, `pp.theme=light` | — |
| Forcer le sombre | Système clair, choix « Sombre » | `data-theme="dark"`, `pp.theme=dark` | — |
| Retour en automatique | `pp.theme=dark`, choix « Automatique » | `data-theme` retiré, `pp.theme=auto` | — |
| Rechargement | `pp.theme=light` | Clair dès le démarrage, y compris sur l'écran de réveil | — |
| Valeur corrompue | `pp.theme=bleu` | Traité comme `auto` | Aucune exception |
| Stockage bloqué | `localStorage` lève | Le choix s'applique pour la page | Repli en mémoire |
| Hors connexion | Connexion pas `open` | Rôles grisés, thèmes actifs | — |

</frozen-after-approval>

## Code Map

- `frontend/src/styles/tokens.css` -- jetons clairs et sombres déjà complets (blocs `@media` + `:not([data-theme="light"])` et `[data-theme="dark"]`). À ne pas toucher.
- `frontend/scripts/tokens.test.mjs` -- modèle de test `node:test` lisant `tokens.css` et `DESIGN.md` : à réutiliser pour le test de contraste.
- `frontend/src/app/storage/browser-storage.ts` -- `read`/`write` privés avec repli en mémoire. Ajouter `readTheme`/`saveTheme` (`pp.theme`).
- `frontend/src/app/top-bar/participant-menu.component.ts` -- menu à un groupe ; `ROLES`, `items` (viewChildren), navigation au clavier sur `ROLES.length`. À étendre à cinq choix.
- `frontend/src/styles/top-bar.css` -- `.participant-menu-list` (ombre l. 65), `.participant-menu-item[aria-checked]`.
- `frontend/src/main.ts` -- démarrage avant `loadAppConfig` : y appliquer le thème mémorisé.
- Ombres d'élévation : `table.css:13`, `action-bar.css:12`, `entry-form.css:16`, `session-layout.css:128,178`, `cards.css:172` (carte choisie), `top-bar.css:65`, `state-screen.css:57` (partie externe seulement).
- Surcharges sombres existantes à regrouper : `cards.css:182-191` (`--poker-card-selected-border`), `session-layout.css:208-219` (tiroir).
- `frontend/src/styles/cards.css:120` -- `.link-button` (« Je veux voter ») : texte `foreground`, soulignement `primary` (`text-decoration-color`).
- `frontend/e2e/role.spec.ts` -- modèle e2e (faux webservice, `fakeSessionSocket`, `addInitScript`).

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/theme/theme.ts` -- type `Theme`, `parseTheme` (inconnu → `auto`), `applyTheme(doc, theme)`, `ThemeService` (signal en lecture seule `theme`, `choose(theme)` qui applique et mémorise) -- point unique du thème, hors session.
- [x] `frontend/src/app/storage/browser-storage.ts` -- `readTheme()`/`saveTheme()` -- clé `pp.theme` avec le même repli.
- [x] `frontend/src/main.ts` -- appliquer le thème mémorisé avant `loadAppConfig` (lecture directe et protégée du `localStorage`) -- pas de flash au chargement.
- [x] `frontend/src/app/top-bar/participant-menu.component.ts` + `top-bar.css` -- groupe « Thème », séparateur, navigation au clavier sur les cinq choix -- UX-DR2.
- [x] `frontend/src/styles/elevation.css` (importé dans `styles.css`) -- propriétés `--elevation-panel`, `--elevation-menu`, `--elevation-card-selected`, `--elevation-dock`, toutes à `none` sous les deux sélecteurs sombres ; les fichiers listés s'y réfèrent. Y regrouper `--poker-card-selected-border` ; supprimer les blocs sombres de `cards.css` et `session-layout.css` -- une seule paire de sélecteurs sombres hors des jetons.
- [x] `frontend/src/styles/cards.css` -- `.link-button` : `color: var(--foreground)`, soulignement `primary` -- décision 1A, contraste AA.
- [x] `frontend/scripts/contrast.test.mjs` -- calcul WCAG sur les valeurs de `tokens.css`, pour les deux thèmes : texte ≥ 4,5 (`foreground` et `muted-foreground` sur `background`/`surface`/`surface-muted`, `foreground` sur `primary-soft`, `primary-foreground` sur `primary`, `card-ink` sur `card-face`, `success`/`warning` sur leur `-soft`, `danger` sur `background`/`surface`, `foreground` du lien sur `surface-muted`) ; graphique ≥ 3 (`primary` sur `surface`/`surface-muted`/`primary-soft`, `card-ink` sur `card-face`, `presence-*` sur `surface`).
- [x] `frontend/src/app/theme/theme.spec.ts`, `participant-menu.component.spec.ts`, `browser-storage.spec.ts` -- matrice I/O et clavier.
- [x] `frontend/e2e/theme.spec.ts` -- `emulateMedia` sombre, choix « Clair » : fond calculé clair, `pp.theme`, persistance au rechargement.

**Acceptance Criteria:**
- Given le menu ouvert, when je choisis un thème, then il s'applique sans rechargement, le choix est coché à la réouverture et rien n'est envoyé sur le WebSocket.
- Given le thème sombre, when la session s'affiche, then aucun élément n'a d'ombre d'élévation, et la carte choisie a un contour `card-ink`.
- Given les deux thèmes, when `npm test` s'exécute, then le test de contraste passe.

## Implementation Notes

- `--elevation-card-back` ajoutée pour l'ombre externe des dos de cartes de l'écran de réveil (`state-screen.css`) : elle suit la marge `inset` dans une liste d'ombres, qui n'accepte pas `none`, d'où `0 0 transparent` en sombre.
- `--menu-background` (`surface` en clair, `surface-muted` en sombre) dans `elevation.css`, qui regroupe aussi `--poker-card-selected-border` : seule paire de sélecteurs sombres hors de `tokens.css`.
- `BrowserStorage.readTheme()` rend la valeur brute ; `parseTheme` l'interprète, ce qui évite une dépendance du stockage vers le thème. `main.ts` lit `localStorage` directement, sous `try/catch`.
- Lien « Je veux voter » : soulignement `primary` de 2 px, décalé de 3 px.
- Vérifié sous Node 24 (Angular refuse Node 22) : 277 tests unitaires, 12 tests de scripts, 52 parcours e2e sur Chromium (`API_BASE_URL=http://127.0.0.1:4310` pour `build:e2e`). WebKit tourne en CI seulement.
- `prettier --check` échouait déjà sur 47 fichiers avant cette story (`.prettierrc` à 100 colonnes, code à 120) : seuls les nouveaux fichiers ont été formatés.

## Spec Change Log

## Review Triage Log

| # | Couche | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | verification-gap | Liste du menu, tiroir téléphone et dos de cartes en sombre : aucune vérification | medium | `theme.spec.ts` ne vérifie que la table, la barre d'action et la carte choisie ; `layout.spec.ts:363` ne tourne qu'en clair | patch : assertions e2e menu et tiroir en sombre |
| 2 | verification-gap | Le test de contraste prétend couvrir le lien « Je veux voter » | low | Il ne lit que `tokens.css`, pas `cards.css` | patch : reformuler le commentaire |
| 3 | verification-gap, edge-case, blind | Blocs sombres dupliqués sans contrôle de concordance | low | `tokens.css` : faux, `tokens.test.mjs` vérifie déjà les deux blocs contre DESIGN.md ; `elevation.css` : vrai, nouveau doublon non vérifié | patch : test de concordance des deux blocs d'`elevation.css` |
| 4 | blind | `main.ts` code en dur `'pp.theme'` | low | Clé répétée hors de `BrowserStorage` | patch : exporter la constante |
| 5 | edge-case, blind | Pas de synchronisation du thème entre onglets (`storage`) | low | Réel, mais hors de l'intention et rare (deux onglets de la même séance) ; ajouterait un écouteur | rejeté |
| 6 | blind | `elevation.css` porte des couleurs (`--menu-background`, bordure de carte) | low | Aucun tort nommé : les couples concernés (`card-ink`/`card-face`, `foreground`/`surface-muted`) sont dans le test de contraste | rejeté |
| 7 | blind | Le menu sombre se détache mal (bordure `border` peu contrastée) | false | Les choix portent du texte contrasté ; WCAG 1.4.11 n'exige pas 3:1 pour la bordure d'un conteneur ; choix voulu par DESIGN (surfaces plus claires) | rejeté |
| 8 | blind | Pas d'intitulé visible « Thème » | low | Le bloc gelé fixe deux groupes séparés par un filet ; « Automatique / Clair / Sombre » se comprend seul | rejeté (signalé à Eric) |
| 9 | blind | Absence de flash non testée | false | Après rechargement, `data-theme="light"` ne peut venir que de `main.ts` : `ThemeService` ne l'applique pas à sa construction | rejeté |
| 10 | blind | Aide `memoryStorage` copiée dans trois specs | low | Motif déjà présent avant la story, sans effet sur l'usage | rejeté |
| 11 | blind | Regex de `contrast.test.mjs` limitée aux hex à 6 chiffres | low | `tokens.css` n'a que ce format, vérifié par `tokens.test.mjs` | rejeté |
| 12 | blind | Le 2e test e2e vérifie moins que le 1er | low | Fermeture, focus et silence réseau déjà couverts par le 1er test et les tests unitaires | rejeté |
| 13 | blind | `choose('auto')` écrit `auto` au lieu d'effacer la clé | false | Le bloc gelé fixe les valeurs `auto`, `light`, `dark` et la matrice attend `pp.theme=auto` | rejeté |

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: unitaires, `tokens.test.mjs` et `contrast.test.mjs` verts.
- `cd frontend && npm run build:e2e && npx playwright test` -- expected: tous les parcours, dont `theme.spec.ts`, verts.
- `cd frontend && npx prettier --check src e2e scripts` -- expected: aucun écart.
