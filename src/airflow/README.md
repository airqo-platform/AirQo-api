# Run locally

## Prerequisites

- Docker and Docker compose

Add [google_application_credentials.json](https://drive.google.com/file/d/18lW3Kc-N4n1tnnFOvtxko4rwuL5VfXyu/view?usp=sharing)
and [.env](https://drive.google.com/file/d/1iTSBXvhoYC9IOV1qRPr9LJv6MbES-3_P/view?usp=sharing) files to the `dags` folder. Run the command below to start all containers.

```bash
sh run.sh  
```

Visit the admin web ui. Use `airflow` for username and password

```http request
http://localhost:8080/home 
```

## Interacting with kafka

### Accessing the container

```bash
docker exec -it message-broker bash
```

### Viewing messages

```bash
kafka/bin/kafka-console-consumer.sh --topic <topic> --from-beginning --bootstrap-server localhost:9092
```

### Stop viewing messages

```bash
Ctrl + c
```

### Exit container

```bash
exit
```

## Stop containers

```bash
Ctrl + c
```

## Cleanup

```bash
sh clean.sh  
```
