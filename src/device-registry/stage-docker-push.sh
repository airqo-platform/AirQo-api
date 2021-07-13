#!/bin/sh

echo -e "\n ==== 🚚  🚁 Pushing API docker image 🛫   ==== \n"
echo -e "\nHope you have built airqo-stage-device-registry-kafka-connection:latest\n"

# docker push airqo-stage-device-registry-api:latest

echo "💪 Push complete"
echo "💫 Image : airqo-stage-device-registry-api:latest"

echo -e "\n ==== 🚚  🚁 Pushing Kafka connections docker image 🛫   ==== \n"
echo -e "\nHope you have built airqo-stage-device-registry-kafka-connection:latest\n"

# docker push airqo-stage-device-registry-kafka-connection:latest

echo "💪 Push complete"
echo -e "💫 Image : airqo-stage-device-registry-kafka-connection:latest \n"
