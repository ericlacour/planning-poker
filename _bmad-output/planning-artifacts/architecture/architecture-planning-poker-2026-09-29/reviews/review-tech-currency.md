# Revue : actualité technique de la spine

Date : 2026-09-29. Objet : `ARCHITECTURE-SPINE.md`. Lentille : chaque décision technique engagée a-t-elle été vérifiée sur le web ou sur le projet, plutôt qu'affirmée de mémoire ?

Les points déjà sourcés dans `research-stack-hosting.md` et `.memlog.md` (Java 25 LTS, Spring Boot 4.1.1 et Java 17 à 26, Angular 22, OpenAPI 3.2.0, AsyncAPI 3.1.0, Maven 3.9.16, PostgreSQL 18, limites Render Free, veille sur message WebSocket) ne sont pas refaits ici.

## Verdict

La stack est **à jour et cohérente**. Aucun composant n'est obsolète ni abandonné. Il reste quatre points à préciser dans la spine, car ils risquent de faire écrire du code faux par un agent : Jackson 3, l'utilisateur root de l'image Temurin, le `PORT` injecté par Render, et la version d'ArchUnit.

## Vérifications

### 1. Node.js 24 LTS et Angular 22 — ✔ confirmé, avec une échéance proche

- Node 24 (Krypton) est en **Active LTS** depuis le 28/10/2025. Il passe en **Maintenance LTS le 20/10/2026**, soit dans trois semaines, et reste supporté jusqu'au **30/04/2028**. Node 26 est « Current » et deviendra LTS le 28/10/2026. Source : https://github.com/nodejs/Release et https://nodejs.org/en/about/previous-releases
- Angular 22.0.x accepte Node `^22.22.3 || ^24.15.0 || ^26.0.0`. Source : https://angular.dev/reference/versions
- **Constat** : « Node.js 24 LTS » est juste. La spine devrait fixer un plancher, **`>=24.15.0`**, sinon un agent peut prendre une 24.x plus ancienne que celle exigée par Angular 22. Elle peut aussi noter que Node 26 deviendra la LTS active fin octobre 2026. Ce n'est pas bloquant : la phase de maintenance de Node 24 dure jusqu'en 2028.

### 2. Images Temurin 25 — ✔ disponibles, ⚠ root par défaut

- Le tag `eclipse-temurin:25-jre` existe (actuellement `25.0.4.1_1-jre`) et repose sur Ubuntu « resolute » (26.04). Il existe aussi des variantes Windows. Source : https://github.com/docker-library/docs/blob/master/eclipse-temurin/README.md
- `25-jre` est publié pour Linux **amd64 et arm64**, ainsi que ppc64le et s390x. Dernière mise à jour : 25/09/2026. Source : https://hub.docker.com/v2/repositories/library/eclipse-temurin/tags/25-jre et https://hub.docker.com/_/eclipse-temurin
- **Constat** : l'image officielle tourne en **root** par défaut, car aucun utilisateur n'est documenté. Ce point n'a pas été vérifié ligne à ligne. AD-12 impose une image non root sous un UID arbitraire du groupe 0. **Correctif** : le Dockerfile doit le faire explicitement, par exemple `USER 1001`, avec `chgrp -R 0` et `chmod -R g=u` sur le dossier de l'application, et `-Djava.io.tmpdir=/tmp`. Il vaut mieux l'écrire dans AD-12 ou dans le seed, car un agent ne le déduira pas de l'image de base. Il faut aussi épingler le tag : `25-jre` suit les mises à jour, et `25.0.x_y-jre` est plus reproductible.

### 3. Spring Boot 4.1 : WebSocket brut et Jackson 3 — ✔ supporté, ⚠ piège pour les agents

- **WebSocket** : le starter est toujours `spring-boot-starter-websocket`, auto-configuré pour Tomcat et Jetty embarqués. Pour les tests, il y a `spring-boot-starter-websocket-test`. Le `WebSocketHandler` brut, sans STOMP, reste disponible dans Spring Framework 7. Sources : https://docs.spring.io/spring-boot/reference/messaging/websockets.html et https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide
- **Starters renommés** : `spring-boot-starter-web` devient **`spring-boot-starter-webmvc`**. Source : https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide
- **Jackson** :
  - Spring Boot 4.1.1 utilise **Jackson 3** par défaut (`tools.jackson.core:jackson-databind` 3.1.x). Le bean auto-configuré est un **`JsonMapper`** (`tools.jackson.databind.json.JsonMapper`), plus un `ObjectMapper` Jackson 2.
  - Jackson 2 n'est plus disponible que par le module **déprécié** `spring-boot-jackson2`, « will be removed in a future Spring Boot 4.x release ».
  - Les annotations restent dans `com.fasterxml.jackson.annotation`.
  - Plusieurs éléments sont renommés : `@JsonComponent` devient `@JacksonComponent`, `Jackson2ObjectMapperBuilderCustomizer` devient `JsonMapperBuilderCustomizer`, et les propriétés `spring.jackson.read/write.*` passent sous `spring.jackson.json.*`.
  - Sources : https://docs.spring.io/spring-boot/reference/features/json.html et https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide
- **Implications** :
  - Avec un `WebSocketHandler` brut, **c'est l'adaptateur qui sérialise lui-même** les messages `sessionState` et `error`, et désérialise les intentions. Les agents, entraînés surtout sur Jackson 2, écriront spontanément `com.fasterxml.jackson.databind.ObjectMapper`. Cela échoue à la compilation, ou tire le module déprécié.
  - **Correctif** : ajouter dans les conventions la règle « JSON : Jackson 3 (`tools.jackson.*`), injecter le `JsonMapper` de Spring, ne jamais ajouter `spring-boot-jackson2` ». Dans AD-1, la règle ArchUnit du domaine doit interdire **`tools.jackson..` et `com.fasterxml.jackson..`**, pas seulement « Jackson ».

### 4. ArchUnit — ✔ supporte Java 25, version à inscrire

- Dernière version : **1.5.1** (25/09/2026). Le support de Java 25 (class file 69) est arrivé en 1.4.1, celui de Java 26 en 1.4.2 et celui de Java 27 en 1.5.0. Sources : https://github.com/TNG/ArchUnit/releases et https://repo1.maven.org/maven2/com/tngtech/archunit/archunit-junit5/
- **Correctif** : ajouter `ArchUnit (archunit-junit5) 1.5.1` dans la table Stack. Une version plus ancienne que 1.4.1 ne lit pas les classes Java 25, et un agent pourrait en choisir une de mémoire.

### 5. Render Blueprint — ✔ confirmé, un point de mise en place à noter

- Un seul `render.yaml` peut déclarer :
  - un web service `runtime: docker`, avec `dockerfilePath`, `dockerContext` et `rootDir` ;
  - un site statique `runtime: static`, avec `buildCommand` et `staticPublishPath` ;
  - `plan: free`, `healthCheckPath` et `autoDeployTrigger` (`commit` ou `checksPass`, le champ `autoDeploy` étant déprécié) ;
  - pour le site statique, `headers` et `routes` (réécritures et redirections).
  - Source : https://render.com/docs/blueprint-spec
- Le fallback SPA se fait avec une réécriture `/*` vers `/index.html`. Elle ne s'applique que si aucun fichier n'existe au chemin demandé, ce qui convient aussi à `config.json`. Source : https://render.com/docs/redirects-rewrites
- Les en-têtes des sites statiques utilisent des motifs de chemin (`/*`, `/**/*.css`…). Source : https://render.com/docs/static-site-headers
- **Chemin du blueprint** : Render cherche `render.yaml` à la racine par défaut, mais « you can define your Blueprint file anywhere » : il suffit de renseigner le champ **Blueprint Path** à la création. Le seed place le fichier dans `deploy/render.yaml`, il faut donc renseigner ce chemin. Source : https://render.com/docs/infrastructure-as-code
- **Constat** : il est conseillé de mettre `autoDeployTrigger: checksPass` sur les deux services. Ainsi, un push dont la CI GitHub Actions échoue n'est pas déployé. Il faut aussi fixer `healthCheckPath: /api/health`.
- **Non confirmé** : la page n'indique aucune restriction des Blueprints sur le plan Free. Rien ne l'interdit, mais aucune page ne le dit explicitement non plus.

### 6. `application/problem+json` (RFC 9457) dans Spring 7 — ✔ confirmé

- Spring Framework prend en charge RFC 9457 via `ProblemDetail`, `ErrorResponse`, `ErrorResponseException` et `ResponseEntityExceptionHandler`, et produit `application/problem+json`. Le champ `code` s'ajoute avec `problemDetail.setProperty("code", "PSEUDO_TAKEN")`, qui l'aplatit au premier niveau du JSON. On peut aussi sous-classer `ProblemDetail`. Source : https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
- Remarque : l'aplatissement de `properties` passe par un mixin Jackson enregistré par Spring. C'est un argument de plus pour s'en tenir au `JsonMapper` fourni par Spring (point 3). Pour que les erreurs natives de Spring MVC sortent aussi en problem+json, il faut `spring.mvc.problemdetails.enabled=true`, ou un `@ControllerAdvice` qui étend `ResponseEntityExceptionHandler`. Ce détail est à préciser dans la story.

### 7. `PORT` sur Render — ✔ confirmé, ⚠ la valeur n'est pas 8080

- Tout web service Render doit écouter sur `0.0.0.0`. **`PORT` vaut 10000 par défaut** sur tous les web services, et il est modifiable dans le dashboard ou par une variable d'environnement. Render détecte le port ouvert, et le déploiement échoue s'il n'en détecte aucun. Source : https://render.com/docs/web-services et https://render.com/docs/environment-variables
- **Constat** : AD-12 (« 8080, ou la valeur de `PORT` si elle est fournie ») est compatible. Sur Render, l'application écoutera sur 10000, sauf si le blueprint fixe `PORT=8080`. **Correctif** :
  - écrire `server.port=${PORT:8080}` ;
  - forcer `server.address` à `0.0.0.0`, ou laisser la valeur par défaut de Tomcat, qui écoute sur toutes les interfaces ;
  - éventuellement fixer `PORT: 8080` dans `render.yaml`, pour garder le même port partout.

## Récapitulatif des correctifs proposés

| # | Élément | Statut | Correctif |
| --- | --- | --- | --- |
| 1 | Node 24 | ✔ avec échéance | Plancher `>=24.15.0` ; Node 24 passe en maintenance le 20/10/2026 |
| 2 | Temurin 25 | ⚠ root par défaut | Dockerfile : `USER` non root, `chgrp 0` / `chmod g=u` ; épingler le tag complet |
| 3 | Jackson 3 | ⚠ piège pour les agents | Convention « `tools.jackson.*`, `JsonMapper` de Spring, pas de `spring-boot-jackson2` » ; ArchUnit interdit les deux paquets Jackson dans `domain` ; starter `webmvc` et non `web` |
| 4 | ArchUnit | ⚠ version absente | Ajouter `1.5.1` à la table Stack (Java 25 exige au moins 1.4.1) |
| 5 | Render Blueprint | ✔ | Renseigner le Blueprint Path `deploy/render.yaml` ; `autoDeployTrigger: checksPass` ; `healthCheckPath: /api/health` |
| 6 | problem+json | ✔ | Rien, sinon activer les problem details pour les erreurs natives de Spring MVC |
| 7 | `PORT` Render | ⚠ 10000 par défaut | `server.port=${PORT:8080}`, ou `PORT=8080` dans le blueprint |
