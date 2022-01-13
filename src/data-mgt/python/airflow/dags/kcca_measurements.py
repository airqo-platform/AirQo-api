from datetime import datetime
from datetime import timedelta

import pandas as pd
from airflow.decorators import dag, task

from config import configuration
from date import date_to_str_hours, date_to_str_days
from kcca_measurements_utils import query_kcca_measurements, clean_kcca_device_data
from utils import get_devices_or_sites, get_site_and_device_id, save_measurements_via_api


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
    dataframe = measurements_df.where(pd.notnull(measurements_df), None)
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
