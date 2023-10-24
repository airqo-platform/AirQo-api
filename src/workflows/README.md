# Workflows

This folder contains functionality for running various AirQo workflow scripts using Apache Airflow framework, an open-source workflow management platform for data
engineering pipelines.

## Environment Setup

- Add the `.env` file to directory. This can be obtained from secret manager (`workflows-env-file`)
- Add the `google_application_credentials.json` (`workflows-google-application-credentials`), `airnow_countries_metadata.json` (`airflow-airnow-countries-metadata`) and `plume_labs_metadata.json` (`airflow-plume-labs-metadata`) files to the `meta_data` folder in this directory. Create the `meta_data folder` if it does not exist. 

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

The `main.py` accepts one mandatory argument `--action` which specifies the utility functions you want to run. Output of
every task/function is a csv file containing data generated after execution.

| Argument         | Purpose|
|---------------------------|------------------|
| airqo_hourly_data | AirQo ETL functions |
| kcca_hourly_data | KCCA ETL functions   |
| weather_data | Weather data ETL functions   |
| data_warehouse | Data warehouse ETL functions   |
| daily_insights_data | App Daily Insights ETL functions   |
| forecast_insights_data | App Forecast Insights ETL functions   |
| meta_data | Functions for updating sites and device on BigQuery   |

For example

```bash
python main.py --action=airqo_hourly_data
```

You may specify additional arguments for `start` and `end`. For example

```bash
python main.py --action=airqo_hourly_data --start-2022-01-01T10:00:00Z --end=2022-01-01T17:00:00Z
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

## Working with DAGs

### Scheduling DAGs for historical data

#### Using the UI

Specify `startDateTime` and `endDateTime` in the dag config using the format `YYYY-MM-ddTHH:mm:ssZ`

#### Using the API

Specify the `start_date_time`, `end_date_time`, interval between DAG instances and the name of the DAG. For example the
command below creates multiple instances of the AirQo historical data DAG that stream data between `2022-01-01`
to `2022-04-01` with an interval of 20 minutes between the instances

```bash
python schedule-dag.py --start=2022-01-01T00:00:00Z --end=2022-04-01T00:00:00Z --logical_date_minutes_interval=20 --dag=airqo_historical_hourly_data
```

| DAG                                   | Description      |
|---------------------------------------|------------------|
| `airqo_historical_hourly_data`        | Historical hourly AirQo data |
| `kcca_historical_hourly_data`         | Historical hourly KCCA data |
| `data_warehouse`                      | Data warehouse |
| `historical_hourly_weather_data`      | Historical hourly weather data |
| `app_historical_daily_insights`       | Historical daily app insights |
| `app_historical_hourly_insights`      | Historical hourly app insights |
| `historical_raw_weather_data`         | Historical raw  weather data |
| `airqo_historical_raw_data`           | Historical raw AirQo data |
| `kcca_historical_raw_data`            | Historical raw KCCA data |

## BigQuery Schemas

Schema files are located in the `schema` folder in the `airqo_etl_utils` package i.e  `airqo_etl_utils/schema`

| Schema file               | Description      | Partitioning     | Clustering order       |
|---------------------------|------------------|------------------|------------------|
| `measurements.json` | Schema for the table that stores device measurements such as `pm2.5`, `pm10` | Partitioned by `MONTH` on `timestamp`. Requires a partition filter | `tenant`,`site_id`,`device`,`timestamp` |
| `weather_data.json` | Schema for the table that stores weather data from other data sources such as `precipitation`, `wind_gusts`, `wind_direction` | Partitioned by `MONTH` on `timestamp`. Requires a partition filter | `tenant`,`site_id`,`timestamp` |
| `data_warehouse.json` | Schema for the table that stores device measurements, weather data and site information for example `pm2.5`, `wind_gusts`, `site_landform_270`  | Partitioned by `MONTH` on `timestamp`. Requires a partition filter | `tenant`,`site_id`,`device_name`,`timestamp` |
| `sites.json` | Schema for the table that stores site details  | Not Partitioned | `tenant`,`id` |
| `devices.json` | Schema for the table that stores device details  | Not Partitioned | `tenant`,`site_id`,`id` |
