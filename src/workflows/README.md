# Workflows.

This folder contains functionality for running various AirQo workflow scripts using Apache Airflow framework, an open-source workflow management platform for data
engineering pipelines.

## Environment Setup

- Add the `.env` file to directory. This can be obtained from secret manager (`workflows-env-file`)
- Add the `google_application_credentials.json` (`workflows-google-application-credentials`), `airnow_countries_metadata.json` (`airflow-airnow-countries-metadata`) and `plume_labs_metadata.json` (`airflow-plume-labs-metadata`) files to the `meta_data` folder in this directory. Create the `meta_data folder` if it does not exist. 

## Running the utility functions locally
Follow these steps if you wish to run the various scripts locally without entirely launching Airflow, otherwise we recommend running using Docker

### Create a virtual environment

```bash
python3 -m venv venv
```

### Activate your environment

#### Linux or MacOS

```bash
source venv/bin/activate
```

#### Windows

```bash
source venv\bin\activate
```

### Install requirements

```bash
pip install -r dev-requirements.txt
```
## Running using Docker

### Prerequisites

- Docker
- Docker compose (>= v1.29.2)
- Docker compose (>= 1.29.2)
- You have set up your environment following the [Environment Setup](#environment-setup)  instructions.

### Starting all containers

```bash
sh run.sh  
```
### Running workflows only

```bash
sh run-workflows-only.sh  
```

**Note for Windows users:** There is a command in the sh files that requires to be modified / uncommented for windows 

Wait for the webserver to be available by checking its status at <http://localhost:8080/health>. Visit the admin web ui
at <http://localhost:8080/home>. Use `airflow` for username and password

### Interacting with kafka

#### Accessing the container

```bash
docker exec -it message-broker bash
```

#### Viewing messages

```bash
kafka/bin/kafka-console-consumer.sh --topic <topic> --from-beginning --bootstrap-server localhost:9092
```

Replace ```<topic>``` with the topic you want to listen to. For example ```hourly-measurements-topic```

#### Stop viewing messages

```bash
Ctrl + c
```

#### Exit container

```bash
exit
```

### Stop containers

```bash
Ctrl + c
```

### Cleanup

```bash
sh clean.sh  
```