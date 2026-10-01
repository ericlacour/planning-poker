# Contrat d'échange front / webservice

Ce dossier est la **source de vérité** de tous les échanges entre le front Angular et le webservice Java (AD-6). Aucun champ ne circule s'il n'est pas décrit ici.

## Contenu

| Chemin | Rôle |
| --- | --- |
| `openapi.yaml` | OpenAPI 3.2.0 : les quatre endpoints REST (AD-2) et leurs erreurs `application/problem+json`. |
| `asyncapi.yaml` | AsyncAPI 3.1.0 : le WebSocket brut `/ws/sessions/{sessionId}`, ses 10 messages, la poignée de main, les codes d'erreur et les codes de fermeture (`x-close-codes`). |
| `schemas/` | Les charges utiles en JSON Schema 2020-12, chacune définie **une seule fois**, avec un `$id` égal au nom du fichier. Les deux documents y renvoient par `$ref`. |
| `examples/<schéma>/<cas>.json` | Les exemples. Le nom du dossier désigne le schéma visé : `examples/vote/withdraw.json` est validé contre `schemas/vote.json`. |
| `scripts/validate.mjs` | Le script de validation (voir ci-dessous). |
| `scripts/validate.test.mjs` | Les tests du script, qui faussent une copie du contrat et vérifient que l'erreur est détectée. |
| `redocly.yaml` | Les règles de lint d'`openapi.yaml`. |

## Valider le contrat

Avec Node.js ≥ 24.15 :

```bash
cd contract
npm ci
npm run validate   # valide le contrat ; code de sortie non nul en cas d'erreur
npm test           # vérifie que la validation détecte bien les erreurs
```

`npm run validate` vérifie :

1. qu'`openapi.yaml` est valide selon OpenAPI 3.2 (Redocly) et qu'`asyncapi.yaml` l'est selon AsyncAPI 3.1 (`@asyncapi/parser`), avec tous leurs `$ref` résolus ;
2. que la surface est exactement celle d'AD-2 : quatre opérations REST et les messages `hello`, `heartbeat`, `vote`, `reveal`, `hide`, `clear`, `changeRole`, `sessionState`, `tick` et `error` ;
3. que chaque charge utile référencée par un document a au moins un exemple, et que chaque réponse d'erreur nommée (`BadRequest`, `SessionNotFound`, `PseudoTaken`) a un exemple `examples/problem/<nom-en-kebab>*.json` valide contre le schéma exact de cette réponse ;
4. que chaque exemple est valide contre son schéma ;
5. que les exemples de `sessionState` respectent les règles d'AD-5 qu'un JSON Schema ne peut pas exprimer :
   - pendant un tour caché, seul le destinataire voit sa propre carte, et `summary` vaut `null` ;
   - les participants sont triés : les votants, puis les observateurs, chaque groupe par `joinOrder` ;
   - `progress` compte tous les votants, déconnectés compris ;
   - `summary` correspond aux votes : moyenne au dixième en `HALF_UP`, plus votée avec égalités, min, max, consensus, `?` et `coffee` exclus ;
   - il existe un exemple de tour caché avec le vote d'un autre participant à `null`, et un exemple de tour révélé avec une égalité sur la plus votée.

## Points du contrat à connaître

- **Cartes** : `"0"`, `"1"`, `"2"`, `"3"`, `"5"`, `"8"`, `"13"`, `"21"`, `"?"` et `"coffee"`. Seul le front affiche `☕`.
- **Identifiants** : `sessionId` et `participantToken` font 128 bits en base64url sans remplissage (22 caractères) ; `participantId` est un UUID. Le `participantToken` est un secret : il n'apparaît que dans les réponses de `POST /api/sessions` et de `POST /api/sessions/{sessionId}/participants`, et dans le message `hello`. Jamais dans une URL, un instantané ou un journal.
- **Erreurs REST** : `INVALID_PSEUDO` (400), `SESSION_NOT_FOUND` (404), `PSEUDO_TAKEN` (409). Un corps de requête mal formé donne un 400 sans `code`. Le texte affiché vient du front.
- **Requêtes** : `pseudo` y est la saisie brute. La normalisation (NFC, espaces retirés, 1 à 20 points de code) appartient au domaine, qui répond `INVALID_PSEUDO`.
- **`vote.card`** est une chaîne quelconque ou `null` : une carte hors du paquet est un message bien formé, refusé par le domaine avec `INVALID_CARD`. De même, un `hello` porteur d'un jeton mal formé est traité comme un jeton inconnu (`4401`).
- **Fermetures WebSocket** : `4404` (session inexistante, vérifiée d'abord), `4401` (jeton inconnu ou révoqué, pseudo repris), `1008` (pas de `hello` en premier message dans les 5 s). Pour tout autre code, le client se reconnecte.

## Faire évoluer le contrat

- Une modification d'un message se fait **dans le même changement** que le code des deux côtés (AD-6). Les types Java et TypeScript sont écrits à la main.
- Entre deux versions déployées, le contrat ne change que **par ajout** : jamais de suppression ni de renommage (AD-13).
- Ajouter un endpoint ou un message change la surface fermée (AD-2) : il faut d'abord une décision d'architecture, puis mettre à jour `EXPECTED_OPERATIONS` ou `EXPECTED_MESSAGES` dans `scripts/validate.mjs`.
- Tout nouveau schéma de charge utile doit avoir son dossier d'exemples.
