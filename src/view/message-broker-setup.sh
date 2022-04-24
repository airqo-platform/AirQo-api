#!/bin/bash
kafka/bin/kafka-topics.sh --create --topic app-insights-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
kafka/bin/kafka-topics.sh --create --topic hourly-measurements-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
kafka/bin/kafka-topics.sh --create --topic sites-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
kafka/bin/kafka-topics.sh --create --topic devices-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
