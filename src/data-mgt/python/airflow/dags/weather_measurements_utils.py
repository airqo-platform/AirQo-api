import json
from datetime import timedelta, datetime

import pandas as pd
import simplejson as simplejson

from config import configuration
from date import date_to_str_hours
from kafka_client import KafkaBrokerClient
from tahmo import TahmoApi
from utils import get_devices_or_sites, get_column_value


def get_site_ids_from_station(station, sites=None):
    if sites is None:
        sites = []
    station_sites = list(filter(lambda x: x["nearest_tahmo_station"]["code"] == station, sites))

    if not station_sites:
        return []
    site_ids = []
    for site in station_sites:
        site_ids.append(site["_id"])
    return site_ids


def transform_weather_measurements(input_file, output_file, frequency):
    weather_raw_data = pd.read_csv(input_file)

    if weather_raw_data.empty:
        print("No Data for cleaning")
        weather_raw_data.to_csv(output_file, index=False)
        return

    sites = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'airqo', sites=True)
    valid_sites = list(filter(lambda x: "nearest_tahmo_station" in dict(x).keys(), sites))

    temperature = weather_raw_data.loc[weather_raw_data["variable"] == "te", ["value", "variable", "station", "time"]]
    humidity = weather_raw_data.loc[weather_raw_data["variable"] == "rh", ["value", "variable", "station", "time"]]

    humidity["value"] = pd.to_numeric(humidity["value"])
    humidity['value'] = humidity['value'].apply(lambda x: x * 100)

    wind_speed = weather_raw_data.loc[weather_raw_data["variable"] == "ws", ["value", "variable", "station", "time"]]

    data = pd.concat([temperature, humidity, wind_speed])
    data.reset_index(inplace=True)
    weather_data = []

    data["value"] = pd.to_numeric(data["value"])

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

    if frequency == "hourly" or frequency == "daily":

        resample_value = '1H' if frequency == "hourly" else '24H'
        weather_data_df = pd.DataFrame(weather_data)
        weather_data = []

        site_groups = weather_data_df.groupby("siteId")

        for _, site_group in site_groups:
            site_id = site_group.iloc[0]["siteId"]
            site_group.dropna(subset=['time'], inplace=True)
            site_group['time'] = pd.to_datetime(site_group['time'])
            site_group.set_index('time')
            site_group.sort_index(axis=0)

            averages = pd.DataFrame(site_group.resample(resample_value, on='time').mean())

            averages["time"] = averages.index
            averages["time"] = averages["time"].apply(lambda x: date_to_str_hours(x))

            averages["frequency"] = frequency
            averages["siteId"] = site_id

            weather_data.extend(averages.to_dict(orient="records"))

    with open(output_file, 'w', encoding='utf-8') as f:
        simplejson.dump(weather_data, f, ensure_ascii=False, indent=4, ignore_nan=True)
    return


def get_weather_measurements(output_file, start_time=None, end_time=None, time_delta=None):
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

    if start_time is None or end_time is None:

        if time_delta:
            raise Exception("Interval not specified")

        date = datetime.now()
        end_time = date_to_str_hours(date)
        start_time = date_to_str_hours(date - timedelta(hours=time_delta))

        print(start_time + " : " + end_time)

        cols, range_measurements = tahmo_api.get_measurements(start_time, end_time, station_codes)
        measurements.extend(range_measurements)
        if len(columns) == 0:
            columns = cols
    else:
        interval = 12

        dates = pd.date_range(start_time, end_time, freq=f'{interval}H')

        for date in dates:
            start_time = date_to_str_hours(date)
            end_time = date_to_str_hours(date + timedelta(hours=interval))
            print(start_time + " : " + end_time)

            cols, range_measurements = tahmo_api.get_measurements(start_time, end_time, station_codes)
            measurements.extend(range_measurements)
            if len(columns) == 0:
                columns = cols

    if len(measurements) != 0 and len(columns) != 0:
        measurements_df = pd.DataFrame(data=measurements, columns=columns)
    else:
        measurements_df = pd.DataFrame([])

    measurements_df.to_csv(path_or_buf=output_file, index=False)
    return


def save_weather_measurements(input_file):
    file = open(input_file)
    data = json.load(file)

    kafka = KafkaBrokerClient()
    kafka.send_data(data=data, topic=configuration.WEATHER_MEASUREMENTS_TOPIC)
