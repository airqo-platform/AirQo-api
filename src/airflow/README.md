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
| airqo_hourly_data | AirQo ETL functions |
| kcca_hourly_data | KCCA ETL functions   |
| weather_data | Weather data ETL functions   |
| data_warehouse | Data warehouse ETL functions   |
| daily_insights_data | App Daily Insights ETL functions   |
| forecast_insights_data | App Forecast Insights ETL functions   |

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
- You have set up your environment following the [Environment Setup](#environment-setup)  instructions.

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

## Working with dags

ETL dags for historical data require you to specify `startDateTime` and `endDateTime` in the dag config using the format `YYYY-MM-ddTHH:mm:ssZ`

## BigQuery Schemas

Schema files are located in the `schema` folder in the `airqo_etl_utils` package  i.e  `airqo_etl_utils/schema`

| Schema file               | Description      | Partitioning     | Clustering order       |
|---------------------------|------------------|------------------|------------------|
| `measurements.json` | Schema for the table that stores device measurements such as `pm2.5`, `pm10` | Partitioned by `MONTH` on `timestamp`. Requires a partition filter | `tenant`,`site_id`,`device`,`timestamp` |
| `weather_data.json` | Schema for the table that stores weather data from other data sources such as `precipitation`, `wind_gusts`, `wind_direction` | Partitioned by `MONTH` on `timestamp`. Requires a partition filter | `tenant`,`site_id`,`timestamp` |
| `data_warehouse.json` | Schema for the table that stores device measurements, weather data and site information for example `pm2.5`, `wind_gusts`, `site_landform_270`  | Partitioned by `MONTH` on `timestamp`. Requires a partition filter | `tenant`,`site_id`,`device_name`,`timestamp` |
