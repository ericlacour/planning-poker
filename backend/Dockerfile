# Image du webservice, compatible OpenShift dès la V1 (AD-12).

FROM eclipse-temurin:25.0.4.1_1-jdk-noble AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src/ src/
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:25.0.4.1_1-jre-noble
# UID arbitraire possible : l'application appartient au groupe 0, avec les droits du propriétaire.
RUN useradd --uid 10001 --gid 0 --no-create-home --home-dir /app app
WORKDIR /app
COPY --from=build /build/target/planning-poker.jar app.jar
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 10001
# Aucune écriture hors de /tmp ; configuration par variables d'environnement (PORT, ALLOWED_ORIGINS).
EXPOSE 8080
ENTRYPOINT ["java", "-Djava.io.tmpdir=/tmp", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
