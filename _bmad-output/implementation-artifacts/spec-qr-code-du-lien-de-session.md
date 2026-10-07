---
title: 'QR code du lien de session'
type: 'feature'
created: '2026-10-07'
status: 'done'
baseline_commit: '6c28956e4ac27d6ab0d6566eeabeef712d5467cc'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Pour rejoindre une session depuis un téléphone, il faut aujourd'hui recevoir le lien par un autre canal (chat, mail) : rien ne permet de le passer directement de l'écran du PC au téléphone.

**Approach:** Un bouton à côté (ou sous) « Copier le lien » déplie un panneau non modal qui affiche le QR code du lien de la session ; le scanner avec l'appareil photo d'un téléphone ouvre l'écran Rejoindre de cette session.

## Boundaries & Constraints

**Always:**
- Le QR code est calculé dans le navigateur et dessiné en SVG en ligne : la CSP `default-src 'self'` (AD-11) interdit tout service tiers, toute image `data:` et tout attribut `style` en ligne.
- Il encode exactement le lien que copie « Copier le lien » (même `url`), avec la marge blanche réglementaire, en modules noirs sur fond blanc quel que soit le thème (lisibilité au scan en thème sombre).
- Décisions (Eric, 2026-10-07) : le bouton est placé partout où se trouve « Copier le lien » (barre du haut et carte « Session vide »), juste après lui ; son libellé est « QR code » ; il reste affiché sur téléphone, réduit à une icône avec son libellé accessible, comme « Copier le lien ».
- Décision (Eric, 2026-10-07, après implémentation) : pas de fenêtre modale (EXPERIENCE.md, « Interdit : fenêtres modales »). Le QR code s'affiche dans un **panneau déroulant non modal** ancré sous le bouton, sur le modèle du menu du participant : `aria-expanded`/`aria-controls` sur le bouton, titre, lien en clair sous le QR code, bouton « Fermer » ; Échap, « Fermer », un nouveau clic sur le bouton ou un clic ailleurs le referment, et le focus revient au bouton (sauf clic ailleurs). La table reste utilisable.
- Décision (Eric, 2026-10-07) : « QR code » est **toujours un bouton secondaire**, y compris dans la carte « Session vide », où « Copier le lien » reste le seul bouton principal.

**Never:**
- Pas d'appel réseau, pas de changement côté webservice ni contrat.
- Pas de téléchargement / impression du QR code.
- Ne pas modifier le comportement de « Copier le lien ».

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ouverture | Clic sur le bouton QR code | Panneau non modal sous le bouton avec QR code du lien, lien en clair, « Fermer » | N/A |
| Scan | QR code scanné par un téléphone | Le téléphone ouvre `…/s/<sessionId>` (écran Rejoindre) | N/A |
| Fermeture | « Fermer », Échap, re-clic sur le bouton ou clic hors du panneau | Panneau fermé ; focus sur le bouton QR code (sauf clic ailleurs) | N/A |
| Thème sombre | Thème forcé sombre | QR code toujours noir sur blanc | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/app/share/copy-link.ts` -- bouton « Copier le lien », reçoit `url` et `variant` (`primary`/`secondary`) ; modèle de composant à suivre (OnPush, signal, icône SVG en `secondary`). Ne pas modifier son comportement.
- `frontend/src/app/app.ts` -- barre du haut : `.top-actions` contient `<app-copy-link variant="secondary">` puis le menu participant.
- `frontend/src/app/session/session-page.component.ts` -- carte `.invite` (Session vide) : `<app-copy-link [url]="link" variant="primary">` ; lien construit par `sessionLink(location.origin, sessionId)`.
- `frontend/src/styles/copy-link.css` -- style `.top-actions` et repli en icône < 600 px ; `styles/table.css` `.invite` ; `styles/base.css` `.btn`, `.btn-primary`, `.btn-secondary` ; `styles/tokens.css` jetons.
- `frontend/scripts/api-base-url.mjs` `contentSecurityPolicy` -- CSP à respecter, ne pas l'élargir.
- `frontend/src/app/share/copy-link.spec.ts` -- modèle de test unitaire (vitest + TestBed).
- `frontend/e2e/create-session.spec.ts` -- e2e Playwright de la Session vide / partage.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/scripts/motion.test.mjs`, `frontend/e2e/*.spec.ts` -- retirer la dérogation `<dialog`/`showModal` ; un seul `.btn-primary` dans la Session vide.
- [x] `frontend/package.json` -- ajouter `qrcode-generator` (MIT, sans dépendance, ESM + types) via `npm install` -- encodeur QR fiable plutôt qu'un encodeur maison.
- [x] `frontend/src/app/share/qr-code.ts` -- fonction pure `qrModules(text)` (niveau de correction M, version auto) + composant `app-qr-code-button` : bouton (variants comme copy-link, icône QR en `secondary`) dépliant un panneau non modal (pas de `<dialog>`) avec SVG `viewBox` incluant 4 modules de marge, un seul `<path>` (`shape-rendering="crispEdges"`), `role="img"` + `aria-label`, lien en clair, bouton « Fermer ».
- [x] `frontend/src/app/app.ts`, `frontend/src/app/session/session-page.component.ts` -- placer le bouton juste après chaque `<app-copy-link>`, même `url`, toujours `variant="secondary"`.
- [x] `frontend/src/styles/qr-code.css` (+ import dans `styles.css`) -- panneau ancré sous le bouton (comme `.participant-menu-list`), sans sortir de l'écran à 360 px, fond `--surface`, QR sur fond blanc fixe, taille ~240 px max (rétrécit sur petit écran), repli icône < 600 px comme copy-link.
- [x] `frontend/src/app/share/qr-code.spec.ts` -- `qrModules` décodable (taille cohérente, motifs de repérage), ouverture/fermeture du panneau, `aria-label`, lien affiché.
- [x] `frontend/e2e/create-session.spec.ts` -- ouvrir la fenêtre QR depuis la Session vide, la vérifier visible et accessible (axe), la fermer avec Échap.

**Acceptance Criteria:**
- Given une session ouverte, when je clique le bouton QR code, then un QR code encodant le lien de la session s'affiche dans un panneau non modal et le décoder redonne exactement ce lien.
- Given la CSP de production, when la fenêtre s'ouvre, then aucune violation CSP n'est émise et aucune requête réseau n'est faite.

## Implementation Notes

## Spec Change Log

- Itération 0 → 1 (vérification après implémentation) : la spec imposait un `<dialog>` modal et « même variant », en contradiction avec EXPERIENCE.md (« Interdit : fenêtres modales » ; « Copier le lien » seul bouton principal de la Session vide). Eric a tranché : panneau déroulant non modal, et « QR code » toujours secondaire. À éviter : toute dérogation dans `scripts/motion.test.mjs` (la retirer) et deux `.btn-primary` dans `main`. KEEP : `qrModules`/`qrPath`, SVG noir sur blanc fixe, ids par instance, placement après chaque `<app-copy-link>`, libellé et repli icône < 600 px, tests e2e (CSP, axe, thèmes).

## Review Triage Log

| # | Source | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | blind, edge, verif | Échap lié à l'hôte : sans effet si le focus est sorti du composant (clic sur l'image, Tab au-delà de « Fermer ») | medium | `host '(keydown.escape)'` ; la spec exige qu'Échap referme le panneau → patch : écouter sur `document` |
| 2 | blind | Couleurs forcées (contraste élevé) : le fond blanc du QR peut être remplacé, QR illisible | medium | `background:#fff` est soumis à forced-colors, `fill` du path non → patch : `forced-color-adjust: none` |
| 3 | verif | Aucun test ne vérifie que le QR décode vers le lien | medium | `qr-code.spec.ts` ne teste que la structure ; le test du `d` compare la fonction à elle-même → patch : décodage jsQR (dev) |
| 4 | blind | `<h2>` du panneau casse la hiérarchie de titres (pas de `<h1>` en Session) | low | correction directe → patch : titre non-titre (`<p>`) référencé par `aria-labelledby` |
| 5 | blind, edge | `variant` « primary » inutilisé ; en barre du haut < 600 px il donnerait un bouton vide | low | aucun appelant ne passe `primary` → patch : supprimer l'entrée `variant` |
| 6 | blind | `.top-actions` stylé dans deux fichiers | low | `.participant-menu` est déjà `position: relative`, pas d'effet visuel ; correction directe → patch : déplacer la règle dans `copy-link.css` |
| 7 | blind | Ligne du commentaire de `session-page.component.ts` > 120 caractères | low | constaté → patch |
| 8 | blind | viewBox `41 41` codé en dur dans l'e2e | low | lien e2e fixe ; rejeté (peu probable, pas de défaut produit) |
| 9 | blind, edge | `qr.make()` lève au-delà de la capacité version 40 | false | les liens de session font ~50 octets, capacité ~2 300 : inatteignable |
| 10 | blind | `String.fromCharCode(...octets)` : limite d'arguments | false | même borne : lien court, inatteignable |
| 11 | blind | QR et menu participant ouverts ensemble | false | chacun se ferme sur clic hors de son hôte : ouvrir l'un ferme l'autre |
| 12 | blind | URL qui change / instance détruite pendant l'ouverture | false | `afterNextRender` est annulé avec l'injecteur ; `close()` n'est pas appelé à la destruction |
| 13 | blind | e2e « clic ailleurs » ne vérifie que `not.toBeFocused()` | low | qualité de test, pas de défaut ; rejeté |
| 14 | edge | Clic ailleurs avec focus sur « Fermer » : focus perdu vers `body` | false | un clic sur une zone non focalisable met déjà le focus sur `body` au mousedown, avant la fermeture |
| 15 | edge | Panneau de la barre du haut en `--menu-background` et non `--surface` | low | la spec demande le modèle du menu participant, qui utilise `--menu-background` ; rejeté |

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: tous les tests passent.
- `cd frontend && npm run build` -- expected: build OK, CSP injectée inchangée.
- `cd frontend && npx playwright test e2e/create-session.spec.ts e2e/accessibility.spec.ts` -- expected: vert.

**Manual checks (if no CLI):**
- Scanner le QR code affiché avec un téléphone : il ouvre l'écran Rejoindre de la session.
