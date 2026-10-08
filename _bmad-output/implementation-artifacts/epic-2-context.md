# Epic 2 Context: Personne ne perd sa place

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Rendre l'outil robuste aux aléas d'un vrai atelier : une coupure de réseau, un téléphone verrouillé, un onglet en arrière-plan, un changement d'appareil ou un redémarrage du serveur ne doivent jamais faire perdre sa place, son rôle ni son vote à un participant, ni laisser la page figée. L'epic ajoute la présence en direct, la reconnexion automatique, le retrait des absents puis leur retour transparent, la reprise du pseudo depuis un autre appareil, l'expiration des sessions au bout de 24 h, et des plafonds qui protègent le service public et gratuit contre l'épuisement de ses ressources. Toute coupure doit être visible, et aucun clic ne doit partir dans le vide (constats F1 et F2 de la rétrospective de l'epic 1).

## Stories

- Story 2.1 : Voir qui est vraiment là
- Story 2.2 : Se reconnecter tout seul après une coupure
- Story 2.3 : Revenir après une longue absence
- Story 2.4 : Reprendre sa place depuis un autre appareil
- Story 2.5 : Une session qui s'efface d'elle-même
- Story 2.6 : Un service qui tient face aux abus

## Requirements & Constraints

- **Présence réseau uniquement :** l'inactivité de l'utilisateur et un onglet en arrière-plan (minuteries ralenties) ne déconnectent jamais. Plusieurs onglets du même navigateur forment un seul participant, `connected` tant qu'au moins une connexion est ouverte et vivante.
- **Délais de diffusion :** une déconnexion explicite est diffusée en moins de 1 s après le constat serveur (6 s au plus de bout en bout derrière Render) ; une déconnexion brutale est détectée en 15 s au plus, puis diffusée en moins de 1 s.
- **Reconnexion (même navigateur) :** pseudo, rôle et vote intacts ; les autres voient le participant déconnecté pendant la coupure.
- **Retrait :** au bout de 10 min sans connexion, le participant est retiré, son vote du tour en cours est supprimé et son pseudo redevient libre. À son retour, il est remis à sa place automatiquement si son pseudo est encore libre ; sinon, il voit l'écran Rejoindre avec le pseudo prérempli.
- **Reprise depuis un autre appareil :** possible seulement pour un participant déconnecté (même identité, rôle et vote). Un pseudo connecté est refusé en 409 `PSEUDO_TAKEN`. L'usurpation est un risque accepté.
- **Expiration :** la session est supprimée 24 h après sa création, avec pseudos, votes et jetons. Ensuite, le lien affiche « Session introuvable ».
- **Redémarrage serveur :** perdre les sessions en mémoire est un risque accepté, mais l'utilisateur doit passer par « actions désactivées », puis « Reconnexion… », puis « Session introuvable ».
- **Veille Render :** l'application ne doit jamais s'endormir tant qu'une session a des participants connectés.
- **Plafonds (réglables par configuration, avec ces valeurs par défaut) :** corps REST de 2 Ko au plus (`413`, refusé sans lecture complète) ; message WebSocket de 4 Ko au plus (fermeture `1009`) ; 50 sessions au plus (`503` `SESSION_LIMIT_REACHED`) ; 10 créations par minute et par IP cliente au plus (`429` `TOO_MANY_REQUESTS` avec `Retry-After`, IP lue depuis `X-Forwarded-For` de Render) ; 30 participants par session au plus (`409` `SESSION_FULL`). Les expirations et les retraits libèrent des places. Le test de charge (5 × 13 participants) doit toujours passer sans refus.
- **Confidentialité :** aucun jeton, pseudo, vote caché ni adresse IP dans les journaux ; aucun jeton dans une URL ni dans un instantané. Les compteurs par IP vivent en mémoire et sont purgés au bout d'une minute.

## Technical Decisions

- **Point unique de mutation :** l'ouverture et la fermeture de connexion, le retrait, l'expiration et la reprise passent tous sous le verrou de la session (charger → règle → `version++` si l'état observable change → `save` → `publish`). La date de dernière activité d'une connexion n'est **pas** observable : elle n'incrémente pas `version` et ne diffuse rien. `publish` n'est jamais bloquant (file bornée par connexion, 2 s / 64 Ko ; un débordement ferme en `4500`).
- **Vivacité serveur :** ping de protocole toutes les 5 s ; une connexion sans pong ni message depuis 15 s est morte. Un `tick` applicatif part aussi toutes les 5 s.
- **Balayeur :** il passe toutes les secondes, sous verrou. Il ferme les connexions mortes, retire les absents (10 min) et supprime les sessions (24 h, fermeture `4404`). Toute heure est lue via `java.time.Clock` en UTC, et les délais sont des `Duration`. Les seuils sont testés dans le domaine avec une horloge fixe.
- **`lastChange.action` :** `PRESENCE` (changement de connexion), `LEAVE` (retrait), `JOIN` (retour après retrait).
- **Identité :** `participantToken` (secret de 128 bits, `SecureRandom`) dans `localStorage` sous `pp.token.{sessionId}`, partagé par les onglets. Après `hello` (dans les 5 s), le serveur vérifie la session (`4404`), puis le jeton (`4401` si inconnu, révoqué, ou si le pseudo a été repris). Un jeton reste valable jusqu'à l'expiration, même après un retrait. Le retour après retrait conserve le `participantId`, le pseudo et le rôle, avec un nouveau `joinOrder`. Une reprise émet un nouveau jeton, révoque l'ancien et ferme en `4401` les connexions qui l'utilisaient encore. Le client supprime le jeton sur `4401` et sur `4404`.
- **Client (`SessionService`, seul propriétaire du WebSocket) :** connexion perdue après 12 s sans aucun message, ou **immédiatement** sur toute fermeture autre que `4401`/`4404`. Il retente tout de suite, puis après 1, 2, 4 et 8 s, puis toutes les 10 s, ainsi que sur `online` et `visibilitychange`. Chaque tentative rejoue `hello`. Il envoie un `heartbeat` toutes les 5 s, uniquement pour garder Render éveillé. Il accepte le premier `sessionState` après reconnexion quelle que soit sa `version`, sans mise à jour optimiste. Aucun calcul métier côté front.
- **Contrat :** il n'évolue que par ajout. `openapi.yaml` gagne les réponses `413`/`429`/`503` et les codes `SESSION_FULL`, `SESSION_LIMIT_REACHED` et `TOO_MANY_REQUESTS` (en `problem+json`, avec un exemple chacun) ; `asyncapi.yaml` gagne la fermeture `1009`.
- **Stockage :** il passe par le port `SessionStore` (`find`, `save`, `delete`, `all` pour le balayeur), en mémoire, sur une seule instance.

## UX & Interaction Patterns

- **Participant déconnecté :** pseudo en `muted-foreground`, pastille grise et libellé « déconnecté », sans changement d'opacité ; sa carte garde son aspect, et il reste compté dans le M de « N votes sur M » jusqu'à son retrait. L'information ne passe jamais par la couleur seule.
- **Ma coupure :** la main et les boutons de la barre d'action sont désactivés dès que la perte est constatée. Après 2 s, le bandeau ambre « Reconnexion… » s'affiche sous la barre du haut ; il ne bloque pas la table et disparaît au retour. Aucune page ne doit rester figée sans retour.
- **Retour après une longue absence :** remise en place transparente, sans autre écran que « Reconnexion… ».
- **Pseudo repris :** écran Rejoindre avec le pseudo prérempli et « Ta place a été reprise depuis un autre appareil. »
- **Session disparue :** « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. » avec « Créer une session ».
- **Refus des plafonds** (saisie conservée, bouton réactivé) : « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. » et « Trop de sessions créées depuis ton réseau. Patiente une minute. » sous le bouton de l'accueil ; « Cette session est complète. » sous le champ de Rejoindre. Ces libellés sont à reprendre mot pour mot, au tutoiement.

## Cross-Story Dependencies

- L'epic s'appuie sur l'epic 1 : contrat, poignée de main `hello`/jeton, `sessionState`, `SessionService`, retour après rafraîchissement, et test de charge de la story 1.5.
- La story 2.1 (connexions multiples par participant, ping/pong, balayeur) sert de base aux stories 2.2, 2.3 et 2.5.
- Les stories 2.3 et 2.4 partagent les règles de jeton (validité après retrait, révocation, `4401`). Le client de la story 2.2 doit traiter `4401` et `4404` sans relancer de reconnexion.
- La story 2.6 réutilise la reconnexion de la 2.2 (fermeture `1009`), ainsi que les libérations de places des stories 2.3 (retrait) et 2.5 (expiration).
- Le test Playwright de l'onglet en arrière-plan pendant 20 min est introduit dans la story 2.2, et le parcours complet est repris dans l'epic 3.
