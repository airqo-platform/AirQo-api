FROM maven:3.8.5-jdk-11-slim as build
WORKDIR /home/app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src/ /home/app/src
RUN mvn package

# https://github.com/strimzi/strimzi-kafka-operator/releases
FROM quay.io/strimzi/kafka:0.29.0-kafka-3.2.0
USER root:root
COPY --from=build /home/app/target/purple-air-measurements-connector.jar /opt/kafka/plugins/airqo/
USER 1001
