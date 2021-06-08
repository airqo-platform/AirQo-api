FROM quay.io/strimzi/kafka:0.22.1-kafka-2.7.0
USER root:root
COPY ./target/airqo-source-connector-jar-with-dependencies.jar /opt/kafka/plugins/airqo/
USER 1001