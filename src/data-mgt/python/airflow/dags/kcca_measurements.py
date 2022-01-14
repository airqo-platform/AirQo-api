from datetime import datetime, timedelta

import pandas as pd
import requests
from airflow.decorators import dag, task

from config import configuration
from date import date_to_str_days
from date import date_to_str_hours
from utils import get_devices_or_sites, get_column_value, to_double, get_site_and_device_id
from utils import save_measurements_via_api


def clean_kcca_device_data(group: pd.DataFrame, site_id: str, device_id: str) -> list:
    transformed_data = []
    columns = group.columns

    for index, row in group.iterrows():

        location = str(row["location.coordinates"])
        location = location.replace('[', '').replace(']', '')
        location_coordinates = location.split(",")

        frequency = str(row.get("outputFrequency", "raw"))

        if frequency.lower() == "hour":
            frequency = "hourly"
        elif frequency.lower() == "day":
            frequency = "daily"
        else:
            frequency = "raw"

        row_data = dict({
            "frequency": frequency,
            "time": row.get("time"),
            "tenant": "kcca",
            "site_id": site_id,
            "device_id": device_id,
            "device": row["deviceCode"],
            "location": dict({
                "longitude": dict({"value": to_double(location_coordinates[0])}),
                "latitude": dict({"value": to_double(location_coordinates[1])})}
            ),
            "pm2_5": {
                "value": get_column_value("characteristics.pm2_5ConcMass.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.pm2_5ConcMass.value", row, columns),
            },
            "pm1": {
                "value": get_column_value("characteristics.pm1ConcMass.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.pm1ConcMass.value", row, columns),
            },
            "pm10": {
                "value": get_column_value("characteristics.pm10ConcMass.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.pm10ConcMass.value", row, columns),
            },
            "externalTemperature": {
                "value": get_column_value("characteristics.temperature.value", row, columns),
            },
            "externalHumidity": {
                "value": get_column_value("characteristics.relHumid.value", row, columns),
            },
            "no2": {
                "value": get_column_value("characteristics.no2Conc.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.no2Conc.value", row, columns),
            },
            "speed": {
                "value": get_column_value("characteristics.windSpeed.value", row, columns),
            },
        })

        transformed_data.append(row_data)

    return transformed_data


def query_kcca_measurements(frequency: str, start_time: str, end_time: str):
    api_url = f"{configuration.CLARITY_API_BASE_URL}measurements?" \
              f"startTime={start_time}&endTime={end_time}"

    if frequency == "hourly":
        api_url = f"{api_url}&outputFrequency=hour"
    elif frequency == "daily":
        api_url = f"{api_url}&outputFrequency=day"
    else:
        api_url = f"{api_url}&outputFrequency=minute"

    headers = {'x-api-key': configuration.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    results = requests.get(api_url, headers=headers)
    if results.status_code != 200:
        print(f"{results.content}")
        return []
    return results.json()


def extract_kcca_measurements(start_time: str, end_time: str, freq: str) -> list:
    if freq.lower() == "hourly":
        interval = "6H"
        time_delta = 6
    elif freq.lower() == "daily":
        interval = "48H"
        time_delta = 48
    else:
        interval = "1H"
        time_delta = 1

    dates = pd.date_range(start_time, end_time, freq=interval)
    measurements = []

    for date in dates:
        start_time = date_to_str_hours(date)
        end_time = date_to_str_hours(date + timedelta(hours=time_delta))
        print(start_time + " : " + end_time)

        range_measurements = query_kcca_measurements(freq, start_time, end_time)
        measurements.extend(range_measurements)

    measurements_df = pd.json_normalize(measurements)
    dataframe = measurements_df.fillna('None')
    return dataframe.to_dict(orient="records")


def transform_kcca_measurements(unclean_data) -> list:
    data = pd.DataFrame(unclean_data)

    devices = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'kcca', sites=False)
    device_gps = data.groupby('deviceCode')
    cleaned_measurements = []
    for _, group in device_gps:
        device_name = group.iloc[0]['deviceCode']

        site_id, device_id = get_site_and_device_id(devices, device_name=device_name)

        if site_id and device_id:
            cleaned_data = clean_kcca_device_data(group, site_id, device_id)

            if cleaned_data:
                cleaned_measurements.extend(cleaned_data)

    return cleaned_measurements


@dag('KCCA-Historical-Measurements', schedule_interval=None,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['kcca', 'historical'])
def kcca_historical_measurements_etl():
    @task(multiple_outputs=True)
    def extract(**kwargs):
        try:
            dag_run = kwargs.get('dag_run')
            frequency = dag_run.conf['frequency']
            start_time = dag_run.conf['startTime']
            end_time = dag_run.conf['endTime']
        except KeyError:
            frequency = 'hourly'
            start_time = date_to_str_hours(datetime.utcnow() - timedelta(hours=24))
            end_time = date_to_str_hours(datetime.utcnow())

        kcca_data = extract_kcca_measurements(start_time=start_time, end_time=end_time, freq=frequency)

        return dict({"data": kcca_data})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = inputs.get("data")

        cleaned_data = transform_kcca_measurements(data)
        return dict({"data": cleaned_data})

    @task()
    def load(inputs: dict):
        kcca_data = inputs.get("data")
        save_measurements_via_api(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag('KCCA-Hourly-Measurements', schedule_interval="@hourly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['kcca', 'hourly'])
def kcca_hourly_measurements_etl():
    @task(multiple_outputs=True)
    def extract():
        start_time = date_to_str_hours(datetime.utcnow() - timedelta(hours=3))
        end_time = date_to_str_hours(datetime.utcnow())

        hourly_kcca_data = extract_kcca_measurements(start_time=start_time, end_time=end_time, freq='hourly')

        return dict({"data": hourly_kcca_data})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = inputs.get("data")
        cleaned_data = transform_kcca_measurements(data)

        return dict({"data": cleaned_data})

    @task()
    def load(inputs: dict):
        kcca_data = inputs.get("data")
        save_measurements_via_api(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag('KCCA-Daily-Measurements', schedule_interval="@daily",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['kcca', 'daily'])
def kcca_daily_measurements_etl():
    @task(multiple_outputs=True)
    def extract():
        start_time = date_to_str_days(datetime.utcnow() - timedelta(days=3))
        end_time = date_to_str_days(datetime.utcnow())

        daily_kcca_data = extract_kcca_measurements(start_time=start_time, end_time=end_time, freq='daily')

        return dict({"data": daily_kcca_data})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = inputs.get("data")
        cleaned_data = transform_kcca_measurements(data)

        return dict({"data": cleaned_data})

    @task()
    def load(inputs: dict):
        kcca_data = inputs.get("data")
        save_measurements_via_api(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


kcca_historical_measurements_etl_dag = kcca_historical_measurements_etl()
kcca_hourly_measurements_etl_dag = kcca_hourly_measurements_etl()
kcca_daily_measurements_etl_dag = kcca_daily_measurements_etl()
