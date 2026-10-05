# Addendum au PRD : Planning Poker pour ateliers d'affinage

Ce document complète le PRD à l'intention de l'architecture et de la conception UX. Il n'ajoute aucune exigence : il ne contient que des pistes et des contraintes.

## Pistes techniques (recommandations, à confirmer dans l'architecture)

### Temps réel et cohérence partagée

- **Connexion persistante (FR-16, FR-17) :** la diffusion en temps réel et les actions simultanées appellent une connexion persistante entre le navigateur et le serveur (WebSocket ou équivalent), avec un serveur qui fait autorité sur l'état. Pour FR-17, ce serveur applique les actions dans leur ordre d'arrivée et diffuse l'état complet obtenu.
- **Détection des déconnexions (FR-16) :** un battement de cœur (ping/pong) toutes les 5 s environ, avec un délai d'expiration de 15 s, permet de respecter le délai de détection d'une déconnexion brutale.

### Accès et identité

- **Lien de session (NFR-6) :** un identifiant aléatoire d'au moins 128 bits répond à l'exigence.
- **Jeton de participant (FR-7, FR-8) :** pour FR-7, le navigateur peut conserver un jeton de participant propre à la session, par exemple dans le stockage local, et le présenter à la reconnexion. Ce jeton est partagé entre les onglets d'un même navigateur. Pour FR-8, le pseudo d'un participant déconnecté peut être repris depuis un autre appareil sans ce jeton.
- **Jeton d'un participant retiré (FR-7, FR-9) :** le jeton d'un participant retiré pour absence reste valable. S'il revient alors que son pseudo est encore libre, le serveur le remet à sa place.
- **Jeton refusé (FR-7, FR-8) :** le serveur refuse le jeton si le participant a été repris depuis un autre appareil (FR-8), ou si son pseudo a été pris par quelqu'un d'autre après son retrait. La page revient alors à l'écran pour rejoindre la session, avec le pseudo prérempli.

### État des sessions

- **Persistance (NFR-1, FR-4) :** NFR-1 accepte de perdre les sessions si le serveur plante ou redémarre. Un état gardé **en mémoire sur le serveur** suffit donc, sans base de données ni stockage externe. L'expiration à 24 h de FR-4 peut passer par un simple nettoyage périodique. Comme l'état ne vit que sur le serveur, celui-ci suffit aussi à assurer la reconnexion de FR-7 : le participant retrouve son vote tant que le serveur tourne.
- **Stockage isolé derrière une interface (NFR-9) :** il est recommandé de faire passer l'accès à l'état des sessions par une interface simple, par exemple lire, écrire et supprimer une session. En V1, cette interface est implémentée en mémoire. Plus tard, pour un hébergement d'entreprise avec plusieurs instances, on pourra la brancher sur un stockage partagé, comme Redis, sans toucher au reste du code.

### Hébergement et exploitation

- **Choix de l'hébergeur gratuit :** l'architecture a retenu Render Free (§9 du PRD). Les critères étaient la mise en veille après inactivité (NFR-1b, NFR-2), les limites sur les WebSockets (NFR-4) et les redémarrages (NFR-1).
- **Délai d'un départ derrière Render (FR-16) :** Render met environ 5 s à transmettre au webservice la fermeture d'une connexion WebSocket, alors que les autres diffusions restent sous la seconde. Après le test de charge du 03/10/2026 (`deploy/README.md`), l'équipe a accepté qu'un départ s'affiche en 6 s au plus.
- **Veille pendant une séance (NFR-1b) :** il faut vérifier que l'hébergeur ne met pas l'application en veille alors que des WebSockets sont ouverts, car sur certaines offres gratuites, seules les requêtes HTTP comptent comme activité. NFR-1b en fait un critère éliminatoire. Une parade possible consiste à envoyer régulièrement un signal de vie depuis les navigateurs connectés.
- **Démarrage à froid (NFR-2) :** le serveur endormi ne peut pas afficher lui-même « Réveil du serveur… ». Il est donc recommandé de l'afficher depuis une page statique servie à part, par exemple sur un CDN ou un hébergement statique. Cette page interroge le serveur jusqu'à ce qu'il réponde et gère aussi le délai de 3 min : message d'indisponibilité et bouton pour réessayer.
- **Redéploiement (NFR-1) :** ne pas redéployer pendant un atelier, puisqu'un redéploiement efface les sessions.

## Précisions pour la conception UX

- **Scénarios de référence :** les parcours UJ-1 à UJ-3 (PRD §2.2).
- **Sur téléphone (NFR-5) :** les cartes doivent être assez grandes pour le doigt, la liste des participants doit rester consultable, et les actions révéler, masquer et effacer doivent rester accessibles sans défilement excessif.
- **États à rendre visibles :** « Réveil du serveur… » puis indisponibilité avec bouton pour réessayer (NFR-2), « Reconnexion… » (FR-7), lien invalide ou expiré (FR-3), pseudo refusé (FR-2), écran pour rejoindre avec le pseudo pré-rempli (FR-7), participant déconnecté, « a voté » ou « n'a pas voté » (FR-6, FR-12), tour caché ou tour révélé, moyenne et consensus (FR-14).
- **Référence à dépasser :** Scrum Poker Online, avec la même simplicité, mais sans aucune publicité.
