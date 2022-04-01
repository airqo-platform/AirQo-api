#!/bin/bash
kafka/bin/kafka-topics.sh --create --topic "$INSIGHTS_MEASUREMENTS_TOPIC" --partitions 1 --bootstrap-server message-broker:9092
kafka/bin/kafka-topics.sh --create --topic "$HOURLY_MEASUREMENTS_TOPIC" --partitions 1 --bootstrap-server message-broker:9092
