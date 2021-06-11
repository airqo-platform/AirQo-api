## Set up kafka locally
```
https://kafka.apache.org/quickstart
```

## Start Schema Registry
```
docker build -t schema-registry .
docker run -d --network=host schema-registry
```

## Creating a Schema
Create a schema `AirQoAccountModel`. Run the following from terminal
```
curl -X POST -H "Content-Type: application/vnd.schemaregistry.v1+json" --data '{"schema": "{\"namespace\": \"net.airqo.models\",  \"type\": \"record\", \"name\": \"AirQoAccountModel\", \"fields\": [{\"name\": \"firstName\", \"type\": \"string\"}, {\"name\": \"lastName\", \"type\": \"string\"},  {\"name\": \"emailAddress\", \"type\": \"string\" }]}"}' http://0.0.0.0:8081/subjects/account-model-value/versions
```

## Viewing available schemas
Checkout the avaialable schemas. `account-model-value` should be part of the list
```
http://0.0.0.0:8081/subjects
```

## Viewing a single schema
View the `AirQoAccountModel` schema
```
http://0.0.0.0:8081/subjects/account-model-value/versions/latest
```

## Generating classes from avsc files
```
java -jar avro-tools-1.10.2.jar compile schema <schema> ./generated-schema/
```

eg 

`java -jar avro-tools-1.10.2.jar compile schema transformed-device-measurements.avsc ./generated-schema/`
