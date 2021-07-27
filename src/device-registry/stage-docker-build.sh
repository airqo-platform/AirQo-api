#!/bin/sh

echo -e "\n ==== 🛠  🔧 🔩 Building API docker image 🔩  🔧  🛠  ==== \n"

# docker build -t airqo-stage-device-registry-api:latest -f Dockerfile.stage.txt .

echo "💪 Build complete API docker image"
echo "💫 Image : airqo-stage-device-registry-api:latest"
echo "🛫 Push the image : docker push airqo-stage-device-registry-api:latest"

echo -e "\n ==== 🛠  🔧 🔩 Building Kafka connections docker image 🔩  🔧  🛠  ==== \n"

# docker build -t airqo-stage-device-registry-kafka:latest -f Dockerfile.kafka.stage .

echo "💪 Build complete Kafka connections docker image"
echo "💫 Image : airqo-stage-device-registry-kafka:latest"
echo -e "🛫 Push the image : docker push airqo-stage-device-registry-kafka:latest \n"
