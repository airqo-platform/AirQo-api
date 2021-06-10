# FROM strimzi/kafka:0.20.1-kafka-2.5.0
# USER root:root
# RUN mkdir -p /opt/kafka/plugins
# RUN mkdir -p /usr/local/share/kafka/plugins
# COPY ./connectors/ /opt/kafka/plugins/
# COPY ./connectors/ /usr/local/share/kafka/plugins/
# USER 1001

FROM quay.io/strimzi/kafka:0.22.1-kafka-2.7.0
USER root:root
RUN wget https://repo1.maven.org/maven2/io/debezium/debezium-connector-mongodb/1.4.2.Final/debezium-connector-mongodb-1.4.2.Final-plugin.tar.gz
RUN tar -xf debezium-connector-mongodb-1.4.2.Final-plugin.tar.gz
COPY ./debezium-connector-mongodb-1.4.2.Final-plugin/ /opt/kafka/plugins/
# COPY ./connectors/ /opt/kafka/plugins/
USER 1001