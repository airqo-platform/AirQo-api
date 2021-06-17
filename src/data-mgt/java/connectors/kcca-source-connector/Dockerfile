FROM maven:3.8.1-jdk-11-slim as build
COPY src /home/app/src
COPY pom.xml /home/app
WORKDIR /home/app
RUN mvn dependency:resolve
RUN mvn assembly:assembly -DskipTest

FROM quay.io/strimzi/kafka:0.22.1-kafka-2.7.0
USER root:root
COPY --from=build /home/app/target/kcca-source-connector-jar-with-dependencies.jar /opt/kafka/plugins/kcca/
USER 1001