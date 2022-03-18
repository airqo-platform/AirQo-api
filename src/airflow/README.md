# Apache Airflow

This folder contains functionality for running apache airflow, an open-source workflow management platform for data engineering pipelines.

## Environment Setup

Add your [google_application_credentials.json](https://drive.google.com/file/d/18lW3Kc-N4n1tnnFOvtxko4rwuL5VfXyu/view?usp=sharing)
and [.env](https://drive.google.com/file/d/1iTSBXvhoYC9IOV1qRPr9LJv6MbES-3_P/view?usp=sharing) files to this directory.

## Running the utility functions

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

### Run the main function

The `main.py` accepts atleast one argument which specifies the utilty functions you want to run. Output of every task/function is a csv file containing data generated after execution.

| Argument         | Purpose|
|---------------------------|------------------|
| airqo_hourly_data | Runs AirQo ETL functions |
| kcca_hourly_data | Runs KCCA ETL functions   |

For example

```bash
python main.py airqo_hourly_data
```

You may specify additinal arguments for `start_date_time` and `end_date_time`. For example

```bash
python main.py airqo_hourly_data 2022-01-01T10:00:00Z 2022-01-01T17:00:00Z
```

## Running using Docker

### Prerequisites

- Docker
- Docker compose
- You have setup your environment using the [Environment Setup](#environment-setup)  instructions.

### Starting all containers

```bash
sh run.sh  
```

Wait for the webserver to be available by checking its status at <http://localhost:8080/health>.
Visit the admin web ui at <http://localhost:8080/home>. Use `airflow` for username and password

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
