# Running locally

## Prerequisites

- Docker 
- Docker compose

Add [google_application_credentials.json](https://drive.google.com/file/d/18lW3Kc-N4n1tnnFOvtxko4rwuL5VfXyu/view?usp=sharing) to the `airflow_utils` folder
and [.env](https://drive.google.com/file/d/1iTSBXvhoYC9IOV1qRPr9LJv6MbES-3_P/view?usp=sharing) files to this directory and the `airflow_utils` folder. 

## Starting all containers.

```bash
sh run.sh  
```
Wait for the webserver to be available by checking its status at ```http://localhost:8080/health```.
Visit the admin web ui at ```http://localhost:8080/home```. Use `airflow` for username and password

## Interacting with kafka

### Accessing the container

```bash
docker exec -it message-broker bash
```

### Viewing messages

```bash
kafka/bin/kafka-console-consumer.sh --topic <topic> --from-beginning --bootstrap-server localhost:9092
```
Replace ```<topic>``` with the topic you want to listen to. For example ```hourly-measurements-topic```
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
