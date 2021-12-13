# syntax=docker/dockerfile:1

FROM openjdk:16-alpine3.13 as base

WORKDIR /app

COPY .mvn/ .mvn
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline
COPY src ./src

FROM base as test
RUN ["./mvnw", "test"]

FROM base as dev
CMD ["./mvnw", "spring-boot:run", "-Dspring-boot.run.profiles=api", "-Dspring-boot.run.jvmArguments='-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:8000'"]

FROM base as build
RUN ./mvnw package -Dmaven.test.skip=true
EXPOSE 8080

FROM openjdk:11-jre-slim as staging
COPY --from=build /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=staging,api", "-jar", "/views.jar"]

FROM openjdk:11-jre-slim as production
COPY --from=build /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=production,api", "-jar", "/views.jar"]

FROM base as build-jobs
RUN ./mvnw package -Dmaven.test.skip=true

FROM openjdk:11-jre-slim as view-jobs
COPY --from=build-jobs /app/target/views-0.0.1-SNAPSHOT.jar /views-jobs.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/views-jobs.jar"]

FROM openjdk:11-jre-slim as forecast-job
COPY --from=build-jobs /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=forecast-job", "-jar", "/views.jar"]

FROM openjdk:11-jre-slim as insights-job
COPY --from=build-jobs /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=insights-job", "-jar", "/views.jar"]

FROM openjdk:11-jre-slim as metadata-job
COPY --from=build-jobs /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=metadata-job", "-jar", "/views.jar"]

FROM openjdk:11-jre-slim as measurements-job
COPY --from=build-jobs /app/target/views-0.0.1-SNAPSHOT.jar /views.jar

CMD ["java", "-Djava.security.egd=file:/dev/./urandom", "-Dspring.profiles.active=measurements-job", "-jar", "/views.jar"]
