# Schema Registry setup and usage

## Set up kafka locally

```https
https://kafka.apache.org/quickstart
```

## Start Schema Registry

### Docker

```bash
docker build --build-arg BOOTSTRAP_SERVERS=127.0.0.1:9092 --build-arg HOST_NAME=schema-registry -t stage-airqo-schema-registry .
docker run -d --network=host schema-registry
```

### Kubernetes

Use `stage-schema-registry.yaml` in `AirQo-api/kafka` directory. Update the `SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS` env variable to point to a Kafka cluster.

## Creating a Schema

Create a schema `AirQoAccountModel`. Run the following from terminal

```bash
curl -X POST -H "Content-Type: application/vnd.schemaregistry.v1+json" --data '{"schema": "{\"namespace\": \"net.airqo.models\",  \"type\": \"record\", \"name\": \"AirQoAccountModel\", \"fields\": [{\"name\": \"firstName\", \"type\": \"string\"}, {\"name\": \"lastName\", \"type\": \"string\"},  {\"name\": \"emailAddress\", \"type\": \"string\" }]}"}' http://0.0.0.0:8081/subjects/account-model-value/versions
```

## Viewing available schemas

Checkout the avaialable schemas. `account-model-value` should be part of the list

```http
http://0.0.0.0:8081/subjects
```

## Viewing a single schema

View the `AirQoAccountModel` schema

```http
http://0.0.0.0:8081/subjects/account-model-value/versions/latest
```

## Generating classes from avsc files

Generated classes will be stored under the `generated-schema` directory

### Java

```java
java -jar avro-tools-1.10.2.jar compile schema <schema> ./generated-schema/
```

eg

```java
java -jar avro-tools-1.10.2.jar compile schema transformed-device-measurements.avsc ./generated-schema/
```
