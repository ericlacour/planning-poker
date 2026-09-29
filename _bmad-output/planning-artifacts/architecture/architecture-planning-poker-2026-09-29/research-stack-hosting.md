# Recherche : stack et hébergement gratuit (planning poker)

Date de la recherche : 2026-09-29. Chaque fait porte sa source. Les mentions **[NON CONFIRMÉ]** signalent ce que je n'ai pas pu vérifier sur une page officielle.

---

## 1. Java

- **Java 25 = LTS en vigueur**, GA le 16/09/2025. Les LTS sont 8, 11, 17, 21 et 25. Source : https://en.wikipedia.org/wiki/Java_version_history et https://openjdk.org/projects/jdk/25/
- **Dernière GA = JDK 27**, sortie le 15/09/2026. C'est une version non-LTS (support court). Source : https://openjdk.org/projects/jdk/27/ et https://docs.oracle.com/en-us/iaas/releasenotes/java-management/jdk-27-release-note.htm
- JDK 26 est sorti le 17/03/2026. La prochaine LTS prévue est **Java 29** (sept. 2027). Source : https://en.wikipedia.org/wiki/Java_version_history
- **Recommandation** : Java 25 LTS. Spring Boot 4.1.1 est déclaré compatible jusqu'à Java 26, pas encore Java 27 (voir §2).

## 2. Framework backend

### Spring Boot
- **Version courante : Spring Boot 4.1.1** (page projet). Source : https://spring.io/projects/spring-boot
- Spring Boot 4.0.0 est GA depuis le 20/11/2025, sur Spring Framework 7 et Jakarta EE 11. Source : https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now/
- Exigences système de 4.1.1 : **Java 17 minimum, compatible jusqu'à Java 26**, **Spring Framework 7.0.9+**, Tomcat 11.0.x / Jetty 12.1.x (Servlet 6.1), Maven 3.6.3+ ou Gradle 8.14+/9.x. Source : https://docs.spring.io/spring-boot/system-requirements.html
- Spring Framework 7 prend comme base Jakarta Servlet 6.1 et WebSocket 2.2. Source : https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes
- **WebSocket** : il y a deux modèles.
  - `WebSocketHandler` brut : texte ou binaire, sans sémantique de messages.
  - **STOMP** comme sous-protocole : il apporte les destinations, le pub/sub et le broker simple en mémoire. Spring rappelle que « WebSocket defines two types of messages (text and binary), but their content is undefined », d'où l'intérêt d'un sous-protocole. Source : https://docs.spring.io/spring-framework/reference/web/websocket/stomp.html
- **Virtual threads : désactivés par défaut.** On les active avec `spring.threads.virtual.enabled=true` (Java 21+). Source : https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html
- Les release notes de 4.1 ne disent rien de nouveau sur les virtual threads ou WebSocket. Nouveautés : support gRPC, améliorations Jackson. Source : https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.1-Release-Notes
- **[NON CONFIRMÉ]** Les dates de fin de support OSS des branches 3.5.x, 4.0.x et 4.1.x : la page de support n'a pas pu être lue.

### Quarkus
- Dernière version : **3.39.5** (24/09/2026). Les flux LTS actifs sont 3.33 LTS (25/03/2026), 3.27 LTS et 3.20 LTS. Source : https://quarkus.io/blog/tag/release/
- WebSocket via l'extension **WebSockets Next** (`quarkus-websockets-next`). Source : https://quarkus.io/extensions/io.quarkus/quarkus-websockets-next/

### Micronaut
- **Micronaut 5.0.0 GA le 20/05/2026**, avec Java 25 comme base. La **5.1.0** est sortie le 27/07/2026. Sources : https://micronaut.io/2026/05/20/micronaut-framework-5-0-0-released/ , https://micronaut.io/2026/04/27/micronaut-framework-5-0-with-java-25-baseline/ , https://micronaut.io/2026/07/27/micronaut-framework-5-1-0-release/

### Verdict framework
Pour une petite équipe dont le code est largement écrit par des agents IA, **Spring Boot 4.1** est le choix le plus répandu et le mieux documenté. Les agents y seront donc les plus fiables. Côté WebSocket, STOMP avec le broker simple en mémoire colle au modèle « état en mémoire, instance unique ».

Quarkus démarre plus vite et consomme moins de mémoire, ce qui compte sur un hôte à 512 Mo / 0,1 vCPU. C'est une alternative crédible si l'hôte retenu est très contraint.

Micronaut a une base d'utilisateurs plus restreinte. *(Ce verdict est une appréciation, pas un fait sourcé.)*

## 3. Angular

- **Version stable : Angular 22** (sortie le 03/06/2026, support actif jusqu'en 06/2027, LTS jusqu'en 06/2028). v21 est passée en LTS, v20 en LTS jusqu'au 28/11/2026. Mineures prévues : 22.2 la semaine du 21/09/2026 et **v23 vers juin 2027**. Le cycle annoncé est désormais d'**une majeure tous les 12 mois**. Source : https://angular.dev/reference/releases
- **Node.js pour v22.0.x : ^22.22.3, ^24.15.0 ou ^26.0.0.** TypeScript >=6.0 <6.1, RxJS ^6.5.3 ou ^7.4.0. Source : https://angular.dev/reference/versions
- **Détection de changements** :
  - **Zoneless par défaut depuis v21** : « Zoneless is the default in Angular v21+ ». Source : https://angular.dev/guide/zoneless
  - **OnPush par défaut en v22**. Signal Forms, Angular Aria et `resource` passent en stable. Source : annonce officielle https://x.com/angular/status/2062279116913570003 et https://angular.dev/events/v22
  - Le modèle réactif recommandé repose donc sur les **signals**.
- **Build** : l'application builder (esbuild, avec le serveur de dev Vite) est le défaut pour tout `ng new`. Source : https://angular.dev/tools/cli/build-system-migration
- **Vitest** est le runner de tests par défaut depuis v21. Source : https://www.heise.de/en/news/Angular-21-says-goodbye-to-zone-js-11086368.html
- **Composants standalone par défaut depuis v19.0.0**. Source : https://angular.dev/guide/components
- **WebSocket côté client** :
  - Angular ne fournit pas d'API WebSocket dédiée. Les options usuelles sont `webSocket()` de RxJS (`rxjs/webSocket`, un Subject bidirectionnel) ou l'API native `WebSocket`. Référence : https://rxjs.dev/api/webSocket/webSocket
  - Si le backend utilise STOMP, le client JS courant est `@stomp/stompjs`.
  - **[NON CONFIRMÉ]** Je n'ai trouvé aucune recommandation officielle Angular sur WebSocket, et la page RxJS n'a pas pu être lue en détail.

## 4. PostgreSQL

- **PostgreSQL 18** est la version majeure stable (GA le 25/09/2025). Mineure 18.6 au 13/08/2026. Sources : https://www.postgresql.org/about/news/postgresql-18-released-3142/ , https://endoflife.date/postgresql
- **[NON CONFIRMÉ]** PostgreSQL 19 était en bêta à la mi-2026 et sa GA était attendue « plus tard dans l'année ». Je n'ai pas vérifié si elle est sortie au 29/09/2026 : à contrôler sur https://www.postgresql.org/docs/release/

## 5. Hébergeurs gratuits (conteneur Docker + WebSocket)

### Render (free web service)
- **Ressources** : 512 Mo RAM / 0,1 CPU, 750 h d'instance par mois et par workspace. Au-delà, les services Free sont suspendus jusqu'au mois suivant. Sources : https://render.com/blog/free-tier , https://render.com/docs/free
- **Mise en veille** : le service s'arrête après **15 min sans requête HTTP entrante NI message WebSocket entrant**. Ce changement date du **24/02/2026** ; avant, seuls les messages HTTP comptaient. Source : https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages
  - Une **connexion WebSocket ouverte mais silencieuse ne suffit donc pas**. Le client doit envoyer un message applicatif (heartbeat) moins de 15 min après le précédent.
  - **[NON CONFIRMÉ]** J'ignore si les trames ping/pong de contrôle comptent comme « message ».
- **Réveil** : « approximately one minute », ce qui **dépasse l'exigence de 30 s**. Source : https://render.com/docs/free
- **WebSocket** : pas de timeout fixe. Les connexions sont coupées au remplacement de l'instance (déploiement, redémarrage), et « Render might restart a Free web service at any time ». Sources : https://render.com/docs/websocket , https://render.com/docs/free
- **Carte bancaire** : non requise. Source : https://render.com/docs/free
- **HTTPS** : TLS géré inclus. Source : https://render.com/blog/free-tier

### Koyeb (Free Instance)
- **Ressources** : 512 Mo RAM, 0,1 vCPU, 2 Go SSD. Une seule instance gratuite par organisation, à Francfort ou Washington. Usage prod déconseillé. Source : https://www.koyeb.com/docs/reference/instances
- **Mise en veille** : **scale-to-zero après 1 h sans trafic**, non désactivable en Free.
  - Réveil en 1 à 5 s (Deep Sleep, le défaut) ou ~200 ms (Light Sleep, en preview). Il faut y ajouter le démarrage de la JVM sur 0,1 vCPU, que je n'ai pas mesuré.
  - Sur WebSocket, la doc dit seulement : « You can wake a Service up using a WebSocket connection, but that connection may only live for a few minutes ». Source : https://www.koyeb.com/docs/run-and-scale/scale-to-zero
  - **[NON CONFIRMÉ]** Un tiers affirme que l'arrêt n'a lieu qu'en l'absence de connexion persistante (WebSocket ou HTTP/2), mais je ne l'ai pas retrouvé tel quel sur la page officielle. Source : https://www.srvrlss.io/provider/koyeb/
- **Carte bancaire** : la FAQ dit « We require a credit card to prevent fraud and abuse ». Elle ajoute qu'on n'est jamais facturé pour le service `free`. Source : https://www.koyeb.com/docs/faqs/pricing

### Google Cloud Run
- **Free tier** (facturation *request-based*) : 2 M requêtes, 180 000 vCPU-s et 360 000 GiB-s par mois, 1 Go de sortie depuis l'Amérique du Nord. Source : https://docs.cloud.google.com/free/docs/free-cloud-features
- **WebSocket** : supporté.
  - « A Cloud Run instance that has any open WebSocket connection is considered active, so CPU is allocated and the service is billed as instance-based billing. » Source : https://docs.cloud.google.com/run/docs/triggering/websockets
  - Une connexion ouverte **garde donc l'instance active**, mais elle est **facturée**.
  - **[NON CONFIRMÉ]** Le free tier applicable en instance-based : la page tarifaire n'a pas pu être lue.
- **Timeout** : chaque connexion WebSocket est une requête soumise au **timeout, 5 min par défaut et 60 min au maximum**. Le client doit donc se reconnecter au moins toutes les heures. Source : https://docs.cloud.google.com/run/docs/configuring/request-timeout
- **Instances** : l'affinité de session est « best effort ». Avec l'état en mémoire, il faut imposer `max-instances=1`. Source : https://docs.cloud.google.com/run/docs/triggering/websockets
- **min-instances** : les instances minimales sont facturées même au repos, d'où un coût non nul. Source : https://docs.cloud.google.com/run/docs/tips/services-cost-optimization
- **Estimation** (calcul, pas un fait sourcé) : 180 000 vCPU-s représentent environ 50 h/mois à 1 vCPU.
- **Carte bancaire** : **[NON CONFIRMÉ]** un compte de facturation GCP est a priori requis.

### Fly.io
- **Plus de free allowance pour les nouveaux comptes.** On a seulement un essai de « 2 hours of machine runtime or 7 days », et les machines d'essai s'arrêtent après 5 min. Ensuite, les apps s'arrêtent sans moyen de paiement. Source : https://docs.fly.io/about/free-trial/
- **Carte bancaire** : « All organizations … require a credit card on file ». Source : https://docs.fly.io/about/pricing/
- **Verdict : ✘ (non gratuit).**

### Railway
- **Offre** : essai de 5 $ sur 30 jours (1 Go RAM), puis plan Free à **1 $ de crédit par mois**, sans report. Pas de carte requise. Source : https://docs.railway.com/reference/pricing/free-trial
- **Veille (serverless)** : après 5 à 10 min sans trafic sortant. Le premier appel peut renvoyer une 502. Source : https://docs.railway.com/reference/app-sleeping
  - **[NON CONFIRMÉ]** La doc ne parle pas explicitement de WebSocket.
- **Estimation** (non sourcée) : 1 $/mois ne suffit pas pour faire tourner une JVM en continu.

### Oracle Cloud Always Free (VM Ampere A1)
- **Limites A1 : 2 OCPU et 12 Go RAM au total** (1 500 OCPU-h et 9 000 Go-h par mois), sur une ou deux VM. Source : https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- **Changement 2026** : l'allocation a été **divisée par deux** (de 4 OCPU / 24 Go à 2 / 12) le **15/06/2026**, sans annonce. Les instances au-delà des nouvelles limites sont terminées à partir du 18/08/2026. Les comptes Pay As You Go garderaient les anciennes limites. Source : https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/
- **Autres ressources** : 200 Go de block storage, **10 To de sortie par mois**, un load balancer flexible à 10 Mbps. Source : même page Oracle.
- **Récupération des VM inactives** : Oracle reprend une VM si, sur 7 jours, le CPU au 95e percentile est < 20 % **et** le réseau < 20 % **et** la mémoire < 20 % (A1). Source : même page Oracle.
  - Une JVM avec k3s occupe généralement plus de 20 % de 12 Go de mémoire, mais c'est **à mesurer**. Si ce n'est pas le cas, il existe un **risque de récupération** en période creuse.
  - **[NON CONFIRMÉ]** Il est souvent dit que passer en Pay As You Go évite la récupération. Je ne l'ai pas trouvé explicitement.
- **Autres points** : **pas de mise en veille** (VM permanente), WebSocket et HTTPS à gérer soi-même (Ingress, Caddy ou Traefik avec Let's Encrypt), A1 uniquement dans la région d'origine.
- **Carte bancaire** : exigée à l'inscription, non débitée sans upgrade. Source : https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
- **Architecture** : ARM64, donc des images Docker multi-arch sont nécessaires.

### Northflank (Developer Sandbox)
- **Offre** : 2 services, 2 jobs, 1 addon (base de données), gratuits. **« Always-on compute – no sleeping »**. Sources : https://northflank.com/pricing , https://northflank.com/docs/v1/application/billing/pricing-on-northflank
- **Carte bancaire** : « All users must add a payment method to start creating resources ». Source : https://northflank.com/docs/v1/application/billing/pricing-on-northflank
- Usage prod explicitement déconseillé.
- **[NON CONFIRMÉ]** La taille CPU/RAM par service en Sandbox n'est pas publiée ; il faut vérifier qu'une JVM y tient. Les limites WebSocket et les changements 2026 ne sont pas vérifiés non plus.

### Autres options repérées
- **Google Compute Engine e2-micro Always Free** : une VM permanente (us-west1, us-central1 ou us-east1), 30 Go de disque, 1 Go de sortie par mois. Source : https://docs.cloud.google.com/free/docs/free-cloud-features
  - C'est une alternative VM à Oracle, mais e2-micro est très petit (≈1 Go RAM, **[NON CONFIRMÉ]**), ce qui est juste pour k3s + JVM.

### Frontend statique séparé
- **Cloudflare Pages** (gratuit) : requêtes statiques illimitées, 500 builds par mois. Il convient à une SPA Angular qui appelle une API hébergée ailleurs. Sources : https://dev.to/nayankyada/cloudflare-pages-pricing-2026-free-tier-limits-workers-costs-when-to-upgrade-2ono , https://developers.cloudflare.com/pages/functions/pricing/
- **Netlify et GitHub Pages** : **[NON CONFIRMÉ]** limites 2026 non vérifiées. Les deux servent techniquement un build statique.
- **Conséquences** :
  - Il faudra configurer le CORS et l'origine WebSocket côté Spring, et prévoir le fallback SPA (`index.html`).
  - Séparer le frontend **éloigne** du modèle « un pod front » visé pour Kubernetes. Un conteneur Nginx servant le build reste plus portable.

## 6. Voie entreprise : k3s sur Oracle Always Free

- Le pattern est **documenté et courant**. Exemples :
  - Dépôt Terraform + k3s + Argo CD sur Always Free : https://github.com/nsudhanva/k3s-oracle
  - Guide k3s gratuit : https://garutilorenzo.github.io/deploy-kubernetes-for-free-oracle-cloud/
  - Tutoriel « production-ready » : https://dev.to/pavan_madduri/deploying-a-production-ready-k3s-cluster-on-oci-always-free-arm-instances-mmj
  - Tutoriel Oracle officiel (OKE sur Arm) : https://docs.oracle.com/en/learn/arm_oke_cluster_oci/index.html
- **Attention** : beaucoup de ces tutoriels datent d'avant la réduction à 2 OCPU / 12 Go (§5). Un cluster à nœud unique (k3s server et agent sur une VM de 2 OCPU / 12 Go) reste raisonnable pour front + back + PostgreSQL.
- **Portabilité** : les manifests standard (Deployment, Service, Ingress) sont portables vers un Kubernetes ou OpenShift d'entreprise. Sur OpenShift, il faudra adapter : Routes ou Ingress, et des images qui tournent en non-root avec un UID arbitraire. *(Appréciation, non sourcée.)*

---

## Tableau comparatif (exigences dures)

Légende : ✔ satisfait · ✘ non satisfait · ? non confirmé / à tester

| Hébergeur | Docker | WebSocket | Pas de veille avec WS connectés | Réveil ≤ 30 s | ~65 WS simultanés | HTTPS | 0 € récurrent | Sans CB |
|---|---|---|---|---|---|---|---|---|
| Render Free | ✔ | ✔ | ? (✔ seulement si heartbeat applicatif < 15 min) | ✘ (~1 min + JVM) | ? (0,1 CPU / 512 Mo) | ✔ | ✔ (750 h/mois) | ✔ |
| Koyeb Free | ✔ | ✔ | ? (doc ambiguë) | ✔ plateforme (1–5 s), ? JVM | ? (0,1 vCPU / 512 Mo) | ✔ | ✔ | ✘ |
| Cloud Run | ✔ | ✔ (timeout max 60 min) | ✔ (instance active) | ? (JVM, à mesurer) | ✔ | ✔ | ? (instance-based facturée, free tier incertain) | ? |
| Fly.io | ✔ | ✔ | — | — | — | ✔ | ✘ (essai 2 h / 7 j) | ✘ |
| Railway | ✔ | ? | ? | ? | ? | ✔ | ✘ (1 $/mois ne suffit pas) | ✔ |
| Oracle Always Free A1 + k3s | ✔ | ✔ (auto-géré) | ✔ (VM permanente) | ✔ (pas de veille) | ✔ (2 OCPU / 12 Go) | ✔ (Let's Encrypt à gérer) | ✔ (risque de récupération si inactif) | ✘ |
| Northflank Sandbox | ✔ | ? | ✔ (always-on) | ✔ | ? (ressources non publiées) | ✔ | ✔ | ✘ |
| Cloudflare Pages (front seul) | ✘ (statique) | n/a | n/a | ✔ | n/a | ✔ | ✔ | ? |

## Recommandations

1. **Oracle Cloud Always Free (VM A1 2 OCPU / 12 Go) + k3s.**
   - C'est la seule option vérifiée qui soit à la fois gratuite, sans veille et assez dimensionnée pour une JVM et 65 WebSocket.
   - Elle permet dès la V1 d'utiliser des **pods et manifests Kubernetes** portables vers l'infrastructure d'entreprise, et d'accueillir PostgreSQL plus tard.
   - Risques : carte bancaire requise, limites réduites sans préavis en 2026 (précédent de confiance), politique de récupération des VM inactives (à surveiller ou à contourner par un passage en PAYG, **non confirmé**), images ARM64 et TLS/Ingress à opérer soi-même.
2. **Northflank Developer Sandbox**, en option PaaS de repli.
   - Always-on sans veille, 2 services (front + back) et 1 base de données gratuits, déploiement de conteneurs.
   - **À valider par un test** : les ressources CPU/RAM par service (non publiées), le comportement WebSocket et la tenue d'une JVM. La carte bancaire est requise.
   - **Render Free** vient juste derrière. Il est sans carte bancaire et garde le service actif sur les messages WebSocket depuis 02/2026 (avec un heartbeat client < 15 min). Mais le réveil d'environ 1 minute enfreint la règle des 30 s, et 0,1 CPU / 512 Mo est serré pour Spring Boot.

**Stack conseillée** (synthèse) : Java 25 LTS · Spring Boot 4.1.x (Spring Framework 7) avec WebSocket STOMP et broker simple en mémoire · Angular 22 (zoneless, signals, OnPush par défaut, standalone, esbuild) sur Node 24 LTS · PostgreSQL 18 (plus tard).

## Points non confirmés (récapitulatif)
- Dates de fin de support des branches Spring Boot 3.5, 4.0 et 4.1.
- GA de PostgreSQL 19 au 29/09/2026.
- Recommandation officielle Angular pour WebSocket (RxJS ou natif).
- Koyeb : une WebSocket ouverte empêche-t-elle le scale-to-zero ?
- Render : les ping/pong comptent-ils comme « message WebSocket » ?
- Cloud Run : free tier en facturation instance-based, et carte bancaire requise ou non.
- Railway : comportement WebSocket en mode serverless.
- Northflank : ressources par service en Sandbox, et évolutions 2026.
- Oracle : le passage en PAYG soustrait-il à la récupération des VM inactives ?
- Limites 2026 de Netlify et GitHub Pages.
- Temps de démarrage réel d'une JVM Spring Boot sur 0,1 vCPU.
