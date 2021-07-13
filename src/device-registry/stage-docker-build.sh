#!/bin/sh

echo -e "\n ==== 🛠  🔧 🔩 Building API docker image 🔩  🔧  🛠  ==== \n"

# docker build -t us.gcr.io/airqo-250220/airqo-stage-device-registry-api:latest -f Dockerfile.stage.txt .

echo "💪 Build complete API docker image"
echo "💫 Image : us.gcr.io/airqo-250220/airqo-stage-device-registry-api:latest"
echo "🛫 Push the image : docker push us.gcr.io/airqo-250220/airqo-stage-device-registry-api:latest"

echo -e "\n ==== 🛠  🔧 🔩 Building Kafka connections docker image 🔩  🔧  🛠  ==== \n"

# docker build -t us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest -f Dockerfile.kafka.stage .

echo "💪 Build complete Kafka connections docker image"
echo "💫 Image : us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest"
echo -e "🛫 Push the image : docker push us.gcr.io/airqo-250220/airqo-stage-device-registry-kafka-connection:latest \n"

# bash stage-docker-build.sh && bash stage-docker-push.sh