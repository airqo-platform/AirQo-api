# Calibrate
## Kafka
Building the docker image
```commandline
DOCKER_BUILDKIT=1 docker build --build-arg BOOTSTRAP_SERVERS=127.0.0.1:9092 --build-arg SCHEMA_REGISTRY=http://127.0.0.1:8081 -f Kafka.Dockerfile -t calibrate-kafka . 
```
