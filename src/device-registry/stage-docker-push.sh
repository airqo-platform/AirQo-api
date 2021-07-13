#!/bin/sh

echo -e "\n ==== 🛫  Pushing API docker image 🛫   ==== \n"
echo -e "\nHope you have built us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest\n"

# docker push us.gcr.io/airqo-250220/airqo-stage-device-registry-api:latest

echo "💪 Push complete"
echo "💫 Image : us.gcr.io/airqo-250220/airqo-stage-device-registry-api:latest"

echo -e "\n ==== 🛫  Pushing Kafka connections docker image 🛫   ==== \n"
echo -e "\nHope you have built us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest\n"

# docker push us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest

echo "💪 Push complete"
echo -e "💫 Image : us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest \n"
