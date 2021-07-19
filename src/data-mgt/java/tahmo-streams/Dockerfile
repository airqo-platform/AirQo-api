FROM maven:3.8.1-jdk-11-slim as build
WORKDIR /home/app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src/ /home/app/src
RUN mvn assembly:single -DskipTest

FROM openjdk:11-jre-slim
COPY --from=build /home/app/target/tahmo-streams-jar-with-dependencies.jar /usr/local/lib/tahmo-streams.jar
ENTRYPOINT ["java","-jar","/usr/local/lib/tahmo-streams.jar"]