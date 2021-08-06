FROM maven:3.8.1-jdk-11-slim as build
WORKDIR /home/app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src/ /home/app/src
RUN mvn compile assembly:single -DskipTest

FROM quay.io/strimzi/kafka:0.22.1-kafka-2.7.0
USER root:root
COPY --from=build /home/app/target/kcca-source-connector-jar-with-dependencies.jar /opt/kafka/plugins/kcca/
USER 1001