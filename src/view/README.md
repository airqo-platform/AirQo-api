# Running the application

## Using Command line

### Exposing the API

Generate the API docs

```bash
./mvnw package
```

Spin up the API

```bash
./mvnw springboot:run -Dspring.profiles.active=api
```

[Link to API Docs](http://localhost:8080/api/v1/view/docs/index.html)

### Connecting to a message broker

Create an instance of kafka. You can follow the Quickstart guide. [Kafka Quickstart](https://kafka.apache.org/quickstart)

Using a separate termial, create the kafka topics to be used by the microservice. Refer to the quickstart quide on how to create topics. <https://kafka.apache.org/quickstart#quickstart_createtopic>

```bash
bin/kafka-topics.sh --create --topic app-insights-measurements-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
bin/kafka-topics.sh --create --topic hourly-measurements-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
bin/kafka-topics.sh --create --topic devices-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
bin/kafka-topics.sh --create --topic sites-topic --partitions 1 --replication-factor 1 --bootstrap-server view-message-broker:9092
```

### Consume data from the message broker

```bash
./mvnw springboot:run -Dspring.profiles.active=messageBroker
```

### Creating dummy data

Using a separate termials, run kafka producers for sites, devices, measurements and insights.

#### Insights

```bash
bin/kafka-console-producer.sh --topic sites-topic --bootstrap-server localhost:9092
```

Create dummy insights data

```json
[{ "time": "2022-02-21T02:00:00Z", "pm2_5": 72, "pm10": 85, "empty": true, "forecast": true, "frequency": "HOURLY", "siteId": "site-01" }, { "time": "2022-02-20T23:00:00Z", "pm2_5": 8, "pm10": 5, "empty": false, "forecast": false, "frequency": "HOURLY", "siteId": "site-02" }, { "time": "2022-02-20T00:00:00Z", "pm2_5": 11, "pm10": 10, "empty": false, "forecast": false, "frequency": "DAILY", "siteId": "site-01" }, { "time": "2022-02-20T00:00:00Z", "pm2_5": 21, "pm10": 29, "empty": false, "forecast": true, "frequency": "DAILY", "siteId": "site-02" }]
```

## Using Docker Compose

### Start containers

```bash
sh setup/run.sh  
```

## Using Docker compose

### Stop containers

```bash
Ctrl + c
```

### Cleanup

```bash
sh clean.sh  
```

## Useful commands

```bash
./mvnw compile
```
