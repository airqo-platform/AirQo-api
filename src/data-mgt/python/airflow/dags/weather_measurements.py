from datetime import timedelta, datetime

import numpy as np
import pandas as pd
from airflow.decorators import dag, task

from config import configuration
from date import date_to_str_hours
from kafka_client import KafkaBrokerClient
from tahmo import TahmoApi
from utils import get_devices_or_sites, get_column_value


def get_site_ids_from_station(station: str, sites: list):
    station_sites = list(filter(lambda x: x["nearest_tahmo_station"]["code"] == station, sites))

    if not station_sites:
        return []
    site_ids = []
    for site in station_sites:
        site_ids.append(site["_id"])
    return site_ids


def transform_weather_measurements(data):
    weather_raw_data = pd.DataFrame(data)

    sites = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'airqo', sites=True)
    valid_sites = list(filter(lambda x: "nearest_tahmo_station" in dict(x).keys(), sites))

    temperature = weather_raw_data.loc[weather_raw_data["variable"] == "te", ["value", "variable", "station", "time"]]
    humidity = weather_raw_data.loc[weather_raw_data["variable"] == "rh", ["value", "variable", "station", "time"]]
    wind_speed = weather_raw_data.loc[weather_raw_data["variable"] == "ws", ["value", "variable", "station", "time"]]

    humidity["value"] = pd.to_numeric(humidity["value"], errors='coerce')
    humidity['value'] = humidity['value'].apply(lambda x: x * 100)

    data = pd.concat([temperature, humidity, wind_speed])
    data.reset_index(inplace=True)
    weather_data = []

    data["value"] = pd.to_numeric(data["value"], errors='coerce')
    data = data.fillna('None')

    data_station_gps = data.groupby('station')
    for _, station_group in data_station_gps:

        station_time_gps = station_group.groupby('time')
        for _, time_group in station_time_gps:

            if time_group.empty:
                continue

            station = time_group.iloc[0]["station"]
            station_sites = get_site_ids_from_station(station, valid_sites)

            if not station_sites:
                continue

            time_series_data = {
                "time": time_group.iloc[0]["time"],
                "humidity": None,
                "temperature": None,
                "windSpeed": None,
                "frequency": "raw",
                "siteId": None
            }

            for _, row in time_group.iterrows():
                if row["variable"] == "rh":
                    time_series_data["humidity"] = get_column_value("value", row, ["value"],
                                                                    data_name="externalHumidity")
                elif row["variable"] == "ws":
                    time_series_data["windSpeed"] = get_column_value("value", row, ["value"],
                                                                     data_name="windSpeed")
                elif row["variable"] == "te":
                    time_series_data["temperature"] = get_column_value("value", row, ["value"],
                                                                       data_name="externalTemperature")
                else:
                    continue

            if time_series_data["time"]:

                for site in station_sites:
                    time_series_data["siteId"] = site
                    weather_data.append(time_series_data)

    weather_data_df = pd.DataFrame(weather_data)
    sampled_data = []

    site_groups = weather_data_df.groupby("siteId")

    for _, site_group in site_groups:
        site_id = site_group.iloc[0]["siteId"]
        site_group.dropna(subset=['time'], inplace=True)
        site_group['time'] = pd.to_datetime(site_group['time'])
        site_group.set_index('time')
        site_group.sort_index(axis=0)

        averages = pd.DataFrame(site_group.resample('1H', on='time').mean())

        averages["time"] = averages.index
        averages["time"] = averages["time"].apply(lambda x: date_to_str_hours(x))

        averages["frequency"] = "hourly"
        averages["siteId"] = site_id

        averages["temperature"] = pd.to_numeric(averages["temperature"], errors='coerce')
        averages["humidity"] = pd.to_numeric(averages["humidity"], errors='coerce')
        averages["windSpeed"] = pd.to_numeric(averages["windSpeed"], errors='coerce')

        averages['temperature'] = averages['temperature'].apply(lambda x: np.nan_to_num(x))
        averages['humidity'] = averages['humidity'].apply(lambda x: np.nan_to_num(x))
        averages['windSpeed'] = averages['windSpeed'].apply(lambda x: np.nan_to_num(x))

        sampled_data.extend(averages.to_dict(orient="records"))

    return sampled_data


def extract_weather_measurements(start_time=None, end_time=None):
    airqo_sites = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'airqo', sites=True)
    station_codes = []
    for site in airqo_sites:
        try:
            if 'nearest_tahmo_station' in dict(site).keys():
                station_codes.append(site['nearest_tahmo_station']['code'])
        except Exception as ex:
            print(ex)

    measurements = []
    columns = []
    tahmo_api = TahmoApi()

    dates = pd.date_range(start_time, end_time, freq='12H')

    for date in dates:
        start_time = date_to_str_hours(date)
        end_time = date_to_str_hours(date + timedelta(hours=12))
        print(start_time + " : " + end_time)

        cols, range_measurements = tahmo_api.get_measurements(start_time, end_time, station_codes)
        measurements.extend(range_measurements)
        if len(columns) == 0:
            columns = cols

    if len(measurements) != 0 and len(columns) != 0:
        measurements_df = pd.DataFrame(data=measurements, columns=columns)
    else:
        measurements_df = pd.DataFrame([])
    measurements_df = measurements_df.fillna('None')
    return measurements_df.to_dict(orient="records")


def load_weather_measurements(data):
    weather_data = {
        "data": data,
        "action": "save"
    }

    print(weather_data)

    kafka = KafkaBrokerClient()
    kafka.send_data(info=weather_data, topic=configuration.WEATHER_MEASUREMENTS_TOPIC)


@dag('Hourly-Historical-Weather-Measurements', schedule_interval=None,
     start_date=datetime(2021, 1, 1), catchup=False, tags=['weather', 'historical', 'hourly'])
def historical_weather_measurements_etl():
    @task(multiple_outputs=True)
    def extract(**kwargs):
        try:
            dag_run = kwargs.get('dag_run')
            start_time = dag_run.conf['startTime']
            end_time = dag_run.conf['endTime']
        except KeyError:
            date = datetime.now()
            end_time = date_to_str_hours(date)
            start_time = date_to_str_hours(date - timedelta(hours=30))

        weather_data = extract_weather_measurements(start_time=start_time, end_time=end_time)

        return dict({"data": weather_data})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = inputs.get("data")

        cleaned_data = transform_weather_measurements(data)
        return dict({"data": cleaned_data})

    @task()
    def load(inputs: dict):
        weather_data = inputs.get("data")
        load_weather_measurements(data=weather_data)

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag('Hourly-Weather-Measurements', schedule_interval="@hourly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['weather', 'hourly'])
def hourly_weather_measurements_etl():
    @task(multiple_outputs=True)
    def extract():
        start_time = date_to_str_hours(datetime.utcnow() - timedelta(hours=3))
        end_time = date_to_str_hours(datetime.utcnow())

        hourly_kcca_data = extract_weather_measurements(start_time=start_time, end_time=end_time)

        return dict({"data": hourly_kcca_data})

    @task(multiple_outputs=True)
    def transform(inputs: dict):
        data = inputs.get("data")
        cleaned_data = transform_weather_measurements(data)

        return dict({"data": cleaned_data})

    @task()
    def load(inputs: dict):
        weather_data = inputs.get("data")
        load_weather_measurements(data=weather_data)

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


historical_weather_measurements_etl_dag = historical_weather_measurements_etl()
hourly_weather_measurements_etl_dag = hourly_weather_measurements_etl()
