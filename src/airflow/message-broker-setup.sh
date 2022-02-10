#!/bin/bash
kafka/bin/kafka-topics.sh --create --topic app-insights-measurements-topic --partitions 1 --bootstrap-server message-broker:9092
kafka/bin/kafka-topics.sh --create --topic hourly-measurements-topic --partitions 1 --bootstrap-server message-broker:9092
