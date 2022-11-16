#!/bin/bash
kafka/bin/kafka-topics.sh --create --topic app-insights-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
