# Workflows

This folder contains functionality for running various AirQo workflow scripts using Apache Airflow framework, an open-source workflow management platform for data engineering pipelines.

## Environment Setup

- Just add the `.env` file to directory. This can be obtained from secret manager (`workflows-env-file`)
- Add the `google_application_credentials.json` (`workflows-google-application-credentials`), `airnow_countries_metadata.json` (`airflow-airnow-countries-metadata`) and `plume_labs_metadata.json` (`airflow-plume-labs-metadata`) files to the `meta-data` folder in this directory. Create the `meta-data folder` if it does not exist.

## 1. Running the utility functions locally

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

## 2. Running using Docker

### Prerequisites

- Docker
- Docker compose (>= v2.26.1)
- You have set up your environment following the [Environment Setup](#environment-setup) instructions.

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

Replace `<topic>` with the topic you want to listen to. For example `hourly-measurements-topic`

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

## 3. Running on GCP Cloud Shell

You can access the GCP cloud shell on your browser. Follow this guide <https://cloud.google.com/shell/docs/launching-cloud-shell>

### Zip and Upload Workflows Folder

- After making your changes, zip your workflows folder, and upload it onto the cloud shell terminal.
- Unzip it using the command `unzip workflows.zip`.
- cd into the workflows folder.

### Running workflows only

Run this command.

```bash
sh run-workflows-only.sh
```

Note: You may need to run this command to initialize your Cloud shell if you haven't already or if you're facing authentication errors.
`export LD_LIBRARY_PATH=/usr/local/lib`

### Access Preview.

Access the web preview in your Browser by clicking on the web preview button and proceed to login.

### TODO

Update documentation on docker compose and kubernetes configurations
