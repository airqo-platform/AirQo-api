from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests
from airflow.decorators import dag, task

from airqoApi import AirQoApi
from config import configuration
from message_broker import KafkaBrokerClient
from date import (
    date_to_str_days,
    date_to_str_hours,
    date_to_str,
    str_to_date,
    str_to_str_hours,
    str_to_str_days,
    frequency_time,
)
from utils import (
    get_valid_column_value,
    to_double,
    get_site_and_device_id,
    slack_dag_failure_notification,
    un_fill_nan,
    fill_nan,
    get_column_value,
    save_measurements_to_bigquery,
    get_time_values,
)


def clean_kcca_device_data(group: pd.DataFrame, site_id: str, device_id: str) -> list:
    transformed_data = []
    columns = group.columns

    for index, row in group.iterrows():

        location = str(row["location.coordinates"])
        location = location.replace("[", "").replace("]", "")
        location_coordinates = location.split(",")

        frequency = str(row.get("outputFrequency", "raw"))

        if frequency.lower() == "hour":
            frequency = "hourly"
        elif frequency.lower() == "day":
            frequency = "daily"
        else:
            frequency = "raw"

        row_data = dict(
            {
                "frequency": frequency,
                "time": frequency_time(dateStr=row.get("time"), frequency=frequency),
                "tenant": "kcca",
                "site_id": site_id,
                "device_id": device_id,
                "device": row["deviceCode"],
                "location": dict(
                    {
                        "longitude": dict(
                            {"value": to_double(location_coordinates[0])}
                        ),
                        "latitude": dict({"value": to_double(location_coordinates[1])}),
                    }
                ),
                "pm2_5": {
                    "value": get_valid_column_value(
                        column_name="characteristics.pm2_5ConcMass.raw",
                        series=row,
                        columns_names=columns,
                        data_name="pm2_5",
                    ),
                    "calibratedValue": get_valid_column_value(
                        column_name="characteristics.pm2_5ConcMass.value",
                        series=row,
                        columns_names=columns,
                        data_name="pm2_5",
                    ),
                },
                "pm1": {
                    "value": get_valid_column_value(
                        column_name="characteristics.pm1ConcMass.raw",
                        series=row,
                        columns_names=columns,
                        data_name=None,
                    ),
                    "calibratedValue": get_valid_column_value(
                        column_name="characteristics.pm1ConcMass.value",
                        series=row,
                        columns_names=columns,
                        data_name=None,
                    ),
                },
                "pm10": {
                    "value": get_valid_column_value(
                        column_name="characteristics.pm10ConcMass.raw",
                        series=row,
                        columns_names=columns,
                        data_name="pm10",
                    ),
                    "calibratedValue": get_valid_column_value(
                        column_name="characteristics.pm10ConcMass.value",
                        series=row,
                        columns_names=columns,
                        data_name="pm10",
                    ),
                },
                "externalTemperature": {
                    "value": get_valid_column_value(
                        column_name="characteristics.temperature.value",
                        series=row,
                        columns_names=columns,
                        data_name="externalTemperature",
                    ),
                },
                "externalHumidity": {
                    "value": get_valid_column_value(
                        column_name="characteristics.relHumid.value",
                        series=row,
                        columns_names=columns,
                        data_name="externalHumidity",
                    ),
                },
                "no2": {
                    "value": get_valid_column_value(
                        column_name="characteristics.no2Conc.raw",
                        series=row,
                        columns_names=columns,
                        data_name=None,
                    ),
                    "calibratedValue": get_valid_column_value(
                        column_name="characteristics.no2Conc.value",
                        series=row,
                        columns_names=columns,
                        data_name=None,
                    ),
                },
                "speed": {
                    "value": get_valid_column_value(
                        column_name="characteristics.windSpeed.value",
                        series=row,
                        columns_names=columns,
                        data_name=None,
                    ),
                },
            }
        )

        transformed_data.append(row_data)

    return transformed_data


def query_kcca_measurements(frequency: str, start_time: str, end_time: str):
    api_url = f"{configuration.CLARITY_API_BASE_URL}measurements?startTime={start_time}&endTime={end_time}"

    if frequency == "hourly":
        api_url = f"{api_url}&outputFrequency=hour"
    elif frequency == "daily":
        api_url = f"{api_url}&outputFrequency=day"
    else:
        api_url = f"{api_url}&outputFrequency=minute"

    headers = {"x-api-key": configuration.CLARITY_API_KEY, "Accept-Encoding": "gzip"}
    results = requests.get(api_url, headers=headers)
    if results.status_code != 200:
        print(f"{results.content}")
        return []
    return results.json()


def extract_kcca_measurements(start_time: str, end_time: str, freq: str) -> list:
    if freq.lower() == "hourly":
        interval = "6H"
    elif freq.lower() == "daily":
        interval = "48H"
    else:
        interval = "1H"

    dates = pd.date_range(start_time, end_time, freq=interval)
    measurements = []
    last_date_time = dates.values[len(dates.values) - 1]

    for date in dates:

        start = date_to_str(date)
        end_date_time = date + timedelta(hours=dates.freq.n)

        if np.datetime64(end_date_time) > last_date_time:
            end = end_time
        else:
            end = date_to_str(end_date_time)

        print(start_time + " : " + end_time)

        range_measurements = query_kcca_measurements(freq, start, end)
        measurements.extend(range_measurements)

    measurements_df = pd.json_normalize(measurements)
    return measurements_df.to_dict(orient="records")


def transform_kcca_measurements_for_api(unclean_data) -> list:
    data = pd.DataFrame(unclean_data)
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="kcca")
    device_gps = data.groupby("deviceCode")
    cleaned_measurements = []
    for _, group in device_gps:
        device_name = group.iloc[0]["deviceCode"]

        site_id, device_id = get_site_and_device_id(devices, device_name=device_name)

        if site_id and device_id:
            cleaned_data = clean_kcca_device_data(group, site_id, device_id)

            if cleaned_data:
                cleaned_measurements.extend(cleaned_data)

    return cleaned_measurements


def transform_kcca_data(data: list, destination: str, frequency: str) -> list:
    restructured_data = []

    data_df = pd.DataFrame(data)
    columns = list(data_df.columns)

    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="kcca")

    for _, data_row in data_df.iterrows():
        device_name = data_row["deviceCode"]
        site_id, _ = get_site_and_device_id(devices, device_name=device_name)
        if not site_id:
            continue

        location = str(data_row["location.coordinates"])
        location = location.replace("[", "").replace("]", "")
        location_coordinates = location.split(",")

        device_data = dict(
            {
                "time": str_to_date(data_row["time"])
                if destination.lower() == "bigquery"
                else frequency_time(dateStr=data_row["time"], frequency=frequency),
                "tenant": "kcca",
                "site_id": site_id,
                "device_number": 0,
                "device": device_name,
                "latitude": location_coordinates[1],
                "longitude": location_coordinates[0],
                "pm2_5": get_column_value(
                    column="characteristics.pm2_5ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "pm10": get_column_value(
                    column="characteristics.pm10ConcMass.value",
                    columns=columns,
                    series=data_row,
                ),
                "s1_pm2_5": get_column_value(
                    column="characteristics.pm2_5ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "s1_pm10": get_column_value(
                    column="characteristics.pm10ConcMass.raw",
                    columns=columns,
                    series=data_row,
                ),
                "s2_pm2_5": None,
                "s2_pm10": None,
                "pm2_5_calibrated_value": get_column_value(
                    column="characteristics.pm2_5ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "pm10_calibrated_value": get_column_value(
                    column="characteristics.pm10ConcMass.calibratedValue",
                    columns=columns,
                    series=data_row,
                ),
                "altitude": get_column_value(
                    column="characteristics.altitude.value",
                    columns=columns,
                    series=data_row,
                ),
                "wind_speed": get_column_value(
                    column="characteristics.windSpeed.value",
                    columns=columns,
                    series=data_row,
                ),
                "external_temperature": get_column_value(
                    column="characteristics.temperature.value",
                    columns=columns,
                    series=data_row,
                ),
                "external_humidity": get_column_value(
                    column="characteristics.relHumid.value",
                    columns=columns,
                    series=data_row,
                ),
            }
        )

        restructured_data.append(device_data)

    return restructured_data


@dag(
    "KCCA-Hourly-Measurements",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "hourly"],
)
def hourly_measurements_etl():
    @task(multiple_outputs=True)
    def extract(**kwargs):
        try:
            dag_run = kwargs.get("dag_run")
            frequency = dag_run.conf["frequency"]
            start_time = dag_run.conf["startTime"]
            end_time = dag_run.conf["endTime"]
        except KeyError:
            frequency = "hourly"
            start_time = date_to_str_hours(datetime.utcnow() - timedelta(hours=4))
            end_time = date_to_str_hours(datetime.utcnow())

        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq=frequency
        )

        return dict({"data": fill_nan(kcca_data)})

    @task()
    def send_hourly_measurements_to_api(inputs: dict):
        data = un_fill_nan(inputs.get("data"))
        kcca_data = transform_kcca_measurements_for_api(data)

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    @task()
    def send_hourly_measurements_to_message_broker(airqo_data: dict):
        data = un_fill_nan(airqo_data.get("data"))
        kcca_restructured_data = transform_kcca_data(
            data=data, destination="messageBroker", frequency="hourly"
        )

        info = {
            "data": kcca_restructured_data,
            "action": "new",
        }

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

    @task()
    def send_hourly_measurements_to_bigquery(kcca_data: dict):
        data = un_fill_nan(kcca_data.get("data"))
        kcca_restructured_data = transform_kcca_data(
            data=data, destination="bigquery", frequency="hourly"
        )
        table_id = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        save_measurements_to_bigquery(
            measurements=kcca_restructured_data, table_id=table_id
        )

    extracted_data = extract()
    send_hourly_measurements_to_message_broker(extracted_data)
    send_hourly_measurements_to_api(extracted_data)
    send_hourly_measurements_to_bigquery(extracted_data)


@dag(
    "KCCA-Raw-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "raw"],
)
def raw_measurements_etl():
    @task(multiple_outputs=True)
    def extract():
        start_time = date_to_str(datetime.utcnow() - timedelta(hours=1))
        end_time = date_to_str(datetime.utcnow())

        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="raw"
        )

        return dict({"data": fill_nan(data=kcca_data)})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = un_fill_nan(inputs.get("data"))

        cleaned_data = transform_kcca_measurements_for_api(data)
        return dict({"data": fill_nan(data=cleaned_data)})

    @task()
    def load(inputs: dict):
        kcca_data = un_fill_nan(inputs.get("data"))

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag(
    "KCCA-Daily-Measurements",
    schedule_interval="0 2 * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "daily"],
)
def daily_measurements_etl():
    @task(multiple_outputs=True)
    def extract():
        start_time = date_to_str_days(datetime.utcnow() - timedelta(days=3))
        end_time = date_to_str_days(datetime.utcnow())

        daily_kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="daily"
        )

        return dict({"data": fill_nan(data=daily_kcca_data)})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = un_fill_nan(inputs.get("data"))
        cleaned_data = transform_kcca_measurements_for_api(data)

        return dict({"data": fill_nan(data=cleaned_data)})

    @task()
    def load(inputs: dict):
        kcca_data = un_fill_nan(inputs.get("data"))

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag(
    "Kcca-Historical-Hourly-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "hourly", "historical"],
)
def historical_hourly_measurements_etl():
    @task()
    def extract(**kwargs):
        start_time, end_time = get_time_values(**kwargs)
        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="hourly"
        )

        return dict({"data": fill_nan(kcca_data)})

    @task()
    def load(kcca_data: dict, **kwargs):
        data = un_fill_nan(kcca_data.get("data"))

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            kcca_transformed_data = transform_kcca_data(
                data=data, destination="bigquery", frequency="hourly"
            )
            table_id = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
            save_measurements_to_bigquery(
                measurements=kcca_transformed_data, table_id=table_id
            )

        else:
            kcca_transformed_data = transform_kcca_measurements_for_api(data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=kcca_transformed_data, tenant="kcca")

    extract_data = extract()
    load(extract_data)


raw_measurements_etl_dag = raw_measurements_etl()
hourly_measurements_etl_dag = hourly_measurements_etl()
daily_measurements_etl_dag = daily_measurements_etl()
historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
