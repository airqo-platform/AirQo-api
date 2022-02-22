# syntax=docker/dockerfile:1

FROM openjdk:16-alpine3.13 as base

WORKDIR /app

COPY .mvn/ .mvn
COPY mvnw pom.xml ./
COPY src ./src

FROM base as test
RUN ["./mvnw", "test"]

FROM base as dev
CMD ["./mvnw", "spring-boot:run", "-Dspring-boot.run.profiles=api,messageBroker", "-Dspring-boot.run.jvmArguments='-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:8000'"]

FROM base as build
RUN ./mvnw package -Dmaven.test.skip=true

FROM openjdk:11-jre-slim as api
COPY --from=build /app/target/view-0.0.1-SNAPSHOT.jar /view.jar
EXPOSE 8080
CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=api", "-jar", "/view.jar"]

FROM openjdk:11-jre-slim as message-broker
COPY --from=build /app/target/view-0.0.1-SNAPSHOT.jar /message-broker.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom",  "-Dspring.profiles.active=messageBroker", "-jar", "/message-broker.jar"]

FROM noahnsimbe/kafka-docker as kafka-setup
USER root
COPY message-broker-setup.sh /usr/local/bin/message-broker-setup.sh
RUN chmod 777 /usr/local/bin/message-broker-setup.sh
ENTRYPOINT ["/usr/local/bin/message-broker-setup.sh"]
