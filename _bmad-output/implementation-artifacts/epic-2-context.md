# Epic 2 Context: Personne ne perd sa place

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Une coupure n'a plus de conséquence pour un participant : chacun voit en direct qui est vraiment là, la page se reconnecte d'elle-même, l'inactivité ou un onglet en arrière-plan ne déconnectent jamais, un absent est retiré au bout de 5 min puis remis à sa place de façon transparente à son retour, un pseudo se reprend depuis un autre appareil, plusieurs onglets comptent comme un seul participant, la session s'efface au bout de 24 h, et des plafonds protègent le service public gratuit contre l'épuisement de ses ressources. L'epic 2 est un préalable à la v1.0 et au premier atelier réel.

## Stories

- Story 2.1 : Voir qui est vraiment là
- Story 2.2 : Se reconnecter tout seul après une coupure
- Story 2.3 : Revenir après une longue absence
- Story 2.4 : Reprendre sa place depuis un autre appareil
- Story 2.5 : Une session qui s'efface d'elle-même
- Story 2.6 : Un service qui tient face aux abus

## Requirements & Constraints

- La liste des participants montre pour chacun son pseudo, son rôle et son état de présence (connecté ou non).
- Seul l'état **réseau** compte : l'inactivité de l'utilisateur, un onglet caché ou des minuteries ralenties ne déconnectent jamais.
- Tout changement d'état est diffusé à tous en moins d'une seconde. Une déconnexion explicite (onglet fermé) est diffusée en moins d'une seconde **après que le serveur a constaté la fermeture** ; derrière Render ce constat prend environ 5 s, donc un départ apparaît chez les autres en **6 s au plus** de bout en bout (décision d'équipe du 2026-10-03, mesurée par le test de charge). Une déconnexion brutale est détectée en 15 s au plus, puis diffusée en moins d'une seconde.
- Reconnexion automatique dans le même navigateur : pseudo, rôle et vote du tour en cours conservés ; pendant la coupure, les autres voient le participant déconnecté.
- Retrait au bout de 5 min sans connexion : place et vote du tour supprimés, pseudo libéré, jeton toujours valable ; retour transparent si le pseudo est encore libre, sinon écran Rejoindre.
- Reprise d'un pseudo **déconnecté** depuis un autre appareil, avec son rôle et son vote ; refusée (409 `PSEUDO_TAKEN`) si le participant est connecté. Reprendre le pseudo d'un autre est un risque accepté (confiance d'équipe).
- Expiration 24 h après la création : session, pseudos, votes et jetons supprimés.
- Plafonds réglables (valeurs par défaut) : corps REST 2 Ko (`413`), message WS 4 Ko (fermeture `1009`), 50 sessions (`503 SESSION_LIMIT_REACHED`), 10 créations par minute et par IP (`429 TOO_MANY_REQUESTS` + `Retry-After`), 30 participants par session (`409 SESSION_FULL`). Le test de charge 5 × 13 doit toujours passer sans refus.
- Confidentialité : aucun jeton, pseudo, valeur de vote ou adresse IP dans un journal, une URL ou un instantané.

## Technical Decisions

- **Mutation unique par session sous verrou** : charger → règle du domaine → `version++` seulement si l'état observable (l'instantané) change → `save` → `publish` non bloquant (file bornée par connexion, 2 s / 64 Ko ; une connexion qui déborde est fermée). L'ouverture et la fermeture de chaque connexion, et chaque action du balayeur, passent par cette séquence. La date de dernière activité d'une connexion n'est pas observable : la mettre à jour n'incrémente pas `version` et ne diffuse rien.
- **Présence** : un participant porte une ou plusieurs connexions ; il est `connected=true` tant qu'au moins une est ouverte et vivante ; la fermeture de la dernière le passe aussitôt à `connected=false` (`lastChange.action: PRESENCE`).
- **Vivacité mesurée par le serveur** : ping de protocole WebSocket toutes les 5 s ; une connexion sans pong ni message depuis 15 s est morte et fermée. Aucune minuterie JavaScript du client n'entre dans ce calcul.
- **Tic et signal de vie** : le serveur envoie `tick` toutes les 5 s ; le client considère la connexion perdue sans aucun message depuis 12 s. Le client envoie `heartbeat` toutes les 5 s, uniquement pour garder Render éveillé.
- **Balayeur** toutes les secondes, sous le verrou de chaque session : ferme les connexions mortes, retire les participants sans connexion depuis 5 min (`LEAVE`), supprime les sessions de plus de 24 h en fermant leurs connexions en `4404`.
- **Heure** : uniquement via `java.time.Clock` en UTC, délais en `Duration` ; tests du domaine avec une horloge fixe.
- **Identité** : `participantToken` secret 128 bits, rangé dans `localStorage` sous `pp.token.{sessionId}` (partagé par les onglets), supprimé à la réception de `4401` ou `4404`. Poignée de main : `hello` dans les 5 s ; session vérifiée d'abord (`4404`), puis jeton : actif → reconnexion ; participant retiré dont le pseudo est libre → remis à sa place (même `participantId`, pseudo, rôle, nouveau `joinOrder`, `JOIN`) ; inconnu, révoqué ou pseudo pris → `4401`. Reprise depuis un autre appareil : nouveau jeton, ancien révoqué, ses connexions fermées en `4401`.
- **Reconnexion client** (`SessionService` seul) : immédiate, puis à 1, 2, 4, 8 s, puis toutes les 10 s ; immédiate aussi sur `online` et `visibilitychange` ; rejoue `hello`. Toute fermeture autre que `4401`/`4404` déclenche la reconnexion sans attendre. Le premier `sessionState` après reconnexion est accepté quelle que soit sa `version`.
- **Contrat d'abord** : toute nouvelle réponse ou fermeture (`413`, `429`, `503`, `1009`, codes d'erreur) est décrite dans `openapi.yaml` / `asyncapi.yaml` avec un exemple, par ajout uniquement, dans le même changement que le code des deux côtés.
- Une seule instance en V1, stockage en mémoire derrière `SessionStore`.

## UX & Interaction Patterns

- Participant déconnecté : pseudo en `muted-foreground`, pastille de présence grise (`presence-offline`) et libellé « déconnecté » ; opacité inchangée ; sa carte garde son aspect (dos, vide ou face) ; il reste compté dans le M de « N votes sur M » tant qu'il n'est pas retiré. L'information ne passe jamais par la couleur seule.
- Reconnexion (moi) : main et boutons désactivés aussitôt la perte constatée ; après 2 s de coupure, bandeau ambre « Reconnexion… » sous la barre du haut (seul usage de l'ambre) ; la table reste visible ; aucune mise à jour optimiste.
- Retour après longue absence : remis à sa place sans écran intermédiaire, seulement via « Reconnexion… ».
- Ancien appareil après reprise : écran Rejoindre, pseudo prérempli, « Ta place a été reprise depuis un autre appareil. ».
- Session expirée : « Cette session n'existe plus. Elle a peut-être expiré, ou le serveur a redémarré. » + « Créer une session ».
- Libellés des plafonds (validés) : « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. », « Trop de sessions créées depuis ton réseau. Patiente une minute. », « Cette session est complète. ».

## Cross-Story Dependencies

- 2.1 pose la présence multi-connexions, le ping de protocole et le balayeur ; 2.3 et 2.5 ajoutent des règles à ce même balayeur.
- 2.2 (reconnexion client) s'appuie sur la détection serveur de 2.1 et sur les codes de fermeture ; 2.6 réutilise sa reconnexion après `1009`.
- 2.3 libère des places comptées par le plafond de participants de 2.6 ; 2.5 libère des places comptées par le plafond de sessions.
- 2.4 dépend de l'état « déconnecté » de 2.1 ; avec le délai accepté, le pseudo reste « déjà pris » environ 5 s après la fermeture de l'onglet sur l'ancien appareil.
- Rétrospective de l'epic 1 : au début de l'epic, extraire le squelette commun des cas d'usage et noter le délai du `hello` avant de le programmer ; faire passer la CI sur les branches de story.
