FROM openjdk:11 as base

WORKDIR /app

COPY .mvn/ .mvn
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline
COPY src ./src

FROM base as test
RUN ["./mvnw", "test"]

FROM base as dev
CMD ["./mvnw", "spring-boot:run", "-Dspring-boot.run.profiles=dev", "-Dspring-boot.run.jvmArguments='-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:8000'"]

FROM base as build
RUN ./mvnw package -Dmaven.test.skip=true
EXPOSE 8080

FROM openjdk:11-jre-slim as staging
COPY --from=build /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=staging", "-jar", "/views.jar"]

FROM openjdk:11-jre-slim as production
COPY --from=build /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=production", "-jar", "/views.jar"]

FROM openjdk:11-jre-slim as local-build

WORKDIR /app

COPY target/views-0.0.1-SNAPSHOT.jar /airqo-views.jar

EXPOSE 8080

CMD ["java", "-Dspring.profiles.active=dev", "-jar", "/airqo-views.jar"]
