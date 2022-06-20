import math
import traceback
from datetime import timedelta, datetime
from functools import reduce

import numpy as np
import pandas as pd
from google.cloud import storage

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.constants import AirQuality, Pollutant, DataType
from airqo_etl_utils.date import (
    str_to_date,
    date_to_str,
    date_to_str_days,
    date_to_str_hours,
)
from airqo_etl_utils.tahmo import TahmoApi


def measurement_time_to_string(time: str, daily=False):
    date_time = str_to_date(time)
    return date_to_str_days(date_time) if daily else date_to_str_hours(date_time)


def to_double(x):
    try:
        value = float(x)
        return None if (math.isnan(value) or np.isnan(value)) else value
    except Exception:
        return None


def get_valid_value(raw_value, name=None):
    value = to_double(raw_value)

    if name is None or value is None or value is np.nan:
        return value

    if (name == "pm2_5" or name == "pm10") and (value < 1 or value > 1000):
        return None
    elif name == "latitude" and (value < -90 or value > 90):
        return None
    elif name == "longitude" and (value < -180 or value > 180):
        return None
    elif name == "battery" and (value < 2.7 or value > 5):
        return None
    elif (name == "altitude" or name == "hdop") and value < 0:
        return None
    elif name == "satellites" and (value < 0 or value > 50):
        return None
    elif (name == "externalTemperature" or name == "temperature") and (
        value <= 0 or value > 45
    ):
        return None
    elif (name == "externalHumidity" or name == "humidity") and (
        value <= 0 or value > 100
    ):
        return None
    elif name == "pressure":
        return None
    else:
        pass

    return value


def get_site_ids_from_station(station: str, sites: list):
    station_sites = list(
        filter(
            lambda x: str(x["nearest_tahmo_station"]["code"]).lower()
            == station.lower(),
            sites,
        )
    )

    if not station_sites:
        return []
    site_ids = []
    for site in station_sites:
        site_ids.append(site["_id"])

    return site_ids


def get_device_ids_from_station(station: str, sites: list):
    station_sites = list(
        filter(
            lambda x: str(x["nearest_tahmo_station"]["code"]).lower()
            == station.lower(),
            sites,
        )
    )

    if not station_sites:
        return []
    device_ids = []

    for site in station_sites:
        try:
            for device in site["devices"]:
                device_ids.append(device["_id"])
        except KeyError:
            continue

    return device_ids


def resample_data(data: pd.DataFrame, frequency: str) -> pd.DataFrame:
    data = data.dropna(subset=["time"])
    data["time"] = pd.to_datetime(data["time"])
    data = data.sort_index(axis=0)
    if "latitude" in data.columns and "longitude" in data.columns:
        original_df = data[["time", "latitude", "longitude"]]
    else:
        original_df = data[["time"]]

    resample_value = "24H" if frequency.lower() == "daily" else "1H"
    averages = pd.DataFrame(data.resample(resample_value, on="time").mean())

    averages["time"] = averages.index
    averages["time"] = averages["time"].apply(lambda x: date_to_str(x))
    averages = averages.reset_index(drop=True)

    if resample_value == "1H":
        original_df["time"] = original_df["time"].apply(lambda x: date_to_str_hours(x))
    elif resample_value == "24H":
        original_df["time"] = original_df["time"].apply(lambda x: date_to_str_days(x))
    else:
        original_df["time"] = original_df["time"].apply(lambda x: date_to_str(x))

    if "latitude" in original_df.columns and "longitude" in original_df.columns:

        def reset_latitude_or_longitude(time: str, field: str):
            date_row = pd.DataFrame(original_df.loc[original_df["time"] == time])
            if date_row.empty:
                return time
            return (
                date_row.iloc[0]["latitude"]
                if field == "latitude"
                else date_row.iloc[0]["longitude"]
            )

        averages["latitude"] = averages.apply(
            lambda row: reset_latitude_or_longitude(row["time"], "latitude"), axis=1
        )
        averages["longitude"] = averages.apply(
            lambda row: reset_latitude_or_longitude(row["time"], "longitude"), axis=1
        )

    return averages


def resample_weather_data(
    raw_weather_data: pd.DataFrame, frequency: str
) -> pd.DataFrame:
    if raw_weather_data.empty:
        return raw_weather_data.to_dict(orient="records")

    airqo_api = AirQoApi()
    sites = airqo_api.get_sites(tenant="airqo")
    valid_sites = list(
        filter(lambda x: "nearest_tahmo_station" in dict(x).keys(), sites)
    )

    temperature = raw_weather_data.loc[
        raw_weather_data["variable"] == "te", ["value", "variable", "station", "time"]
    ]
    humidity = raw_weather_data.loc[
        raw_weather_data["variable"] == "rh", ["value", "variable", "station", "time"]
    ]
    wind_speed = raw_weather_data.loc[
        raw_weather_data["variable"] == "ws", ["value", "variable", "station", "time"]
    ]

    humidity["value"] = pd.to_numeric(humidity["value"], errors="coerce")
    humidity["value"] = humidity["value"].apply(lambda x: x * 100)

    data = pd.concat([temperature, humidity, wind_speed])
    data.reset_index(inplace=True)
    devices_weather_data = []

    data["value"] = pd.to_numeric(data["value"], errors="coerce", downcast="float")
    data = data.fillna(0)

    data_station_gps = data.groupby("station")

    for _, station_group in data_station_gps:

        device_weather_data = []
        station = station_group.iloc[0]["station"]

        try:

            # resampling station values
            temperature = resample_data(
                station_group.loc[station_group["variable"] == "te", ["value", "time"]],
                frequency,
            )
            temperature.columns = ["temperature", "time"]
            humidity = resample_data(
                station_group.loc[station_group["variable"] == "rh", ["value", "time"]],
                frequency,
            )
            humidity.columns = ["humidity", "time"]
            wind_speed = resample_data(
                station_group.loc[station_group["variable"] == "ws", ["value", "time"]],
                frequency,
            )
            wind_speed.columns = ["wind_speed", "time"]

            data_frames = [temperature, humidity, wind_speed]

            station_df = reduce(
                lambda left, right: pd.merge(left, right, on=["time"], how="outer"),
                data_frames,
            )
            station_df["frequency"] = frequency

            # mapping device to station
            station_devices = get_device_ids_from_station(station, valid_sites)

            if len(station_devices) == 0:
                continue

            for device_id in station_devices:
                device_station_df = station_df.copy(deep=True)
                device_station_df["device_id"] = device_id
                device_weather_data.extend(device_station_df.to_dict(orient="records"))

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            continue

        devices_weather_data.extend(device_weather_data)

    return pd.DataFrame(devices_weather_data)


def download_file_from_gcs(bucket_name: str, source_file: str, destination_file: str):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_file)
    blob.download_to_filename(destination_file)
    print(
        f"file: {destination_file} downloaded from bucket: {bucket_name} successfully"
    )
    return destination_file


def get_frequency(start_time: str, end_time: str) -> str:
    diff_days = round(
        (str_to_date(end_time) - str_to_date(start_time)).total_seconds() / 86400
    )

    if diff_days >= 5:
        frequency = "96H"
    elif diff_days <= 1:
        diff_hours = round(
            (str_to_date(end_time) - str_to_date(start_time)).seconds / 3600
        )
        frequency = "1H" if diff_hours <= 0 else f"{diff_hours}H"
    else:
        frequency = f"{round(diff_days * 24)}H"

    return frequency


def get_airqo_api_frequency(freq: str) -> str:
    if freq == "hourly":
        return "168H"
    elif freq == "daily":
        return "720H"
    else:
        return "5H"


def get_weather_data_from_tahmo(
    start_time=None, end_time=None, tenant="airqo"
) -> pd.DataFrame:
    airqo_api = AirQoApi()
    airqo_sites = airqo_api.get_sites(tenant=tenant)
    station_codes = []
    for site in airqo_sites:
        try:
            if "nearest_tahmo_station" in dict(site).keys():
                station_codes.append(site["nearest_tahmo_station"]["code"])
        except Exception as ex:
            print(ex)

    measurements = []
    tahmo_api = TahmoApi()

    frequency = get_frequency(start_time=start_time, end_time=end_time)
    dates = pd.date_range(start_time, end_time, freq=frequency)
    last_date_time = dates.values[len(dates.values) - 1]

    for date in dates:

        start = date_to_str(date)
        end_date_time = date + timedelta(hours=dates.freq.n)

        if np.datetime64(end_date_time) > last_date_time:
            end = end_time
        else:
            end = date_to_str(end_date_time)

        print(start + " : " + end)

        range_measurements = tahmo_api.get_measurements(start, end, station_codes)
        measurements.extend(range_measurements)

    if len(measurements) != 0:
        measurements_df = pd.DataFrame(data=measurements)
    else:
        measurements_df = pd.DataFrame(
            [], columns=["value", "variable", "station", "time"]
        )
        return measurements_df.to_dict(orient="records")

    clean_measurements_df = remove_invalid_dates(
        dataframe=measurements_df, start_time=start_time, end_time=end_time
    )
    return clean_measurements_df


def remove_invalid_dates(
    dataframe: pd.DataFrame, start_time: str, end_time: str
) -> pd.DataFrame:
    start = pd.to_datetime(start_time)
    end = pd.to_datetime(end_time)

    dataframe["time"] = pd.to_datetime(dataframe["time"])
    data_frame = dataframe.set_index(["time"])

    time_data_frame = data_frame.loc[
        (data_frame.index >= start) & (data_frame.index <= end)
    ]

    time_data_frame["time"] = time_data_frame.index
    time_data_frame["time"] = time_data_frame["time"].apply(lambda x: date_to_str(x))
    time_data_frame = time_data_frame.reset_index(drop=True)

    return time_data_frame


def get_column_value(column: str, columns: list, series: pd.Series):
    return series[column] if column in columns else None


def get_valid_column_value(column_name, series, columns_names, data_name):
    if column_name in columns_names:
        value = to_double(series[column_name])
        return get_valid_value(value, data_name)

    return None


def get_site_and_device_id(devices, channel_id=None, device_name=None):
    try:
        if channel_id is not None:
            result = list(
                filter(lambda device: (device["device_number"] == channel_id), devices)
            )
        elif device_name is not None:
            result = list(
                filter(lambda device: (device["name"] == device_name), devices)
            )
        else:
            return None, None

        if not result:
            print("Device not found")
            return None, None

        return result[0]["site"]["_id"], result[0]["_id"]
    except Exception as ex:
        print(ex)
        print(
            f"Site ID for device => {device_name}/ channel Id => {channel_id} not found "
        )
        return None, None


def get_date_time_values(interval_in_days: int = 1, **kwargs):
    try:
        dag_run = kwargs.get("dag_run")
        start_date_time = dag_run.conf["startDateTime"]
        end_date_time = dag_run.conf["endDateTime"]
    except KeyError:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=interval_in_days)
        start_date_time = datetime.strftime(start_date, "%Y-%m-%dT00:00:00Z")
        end_date_time = datetime.strftime(end_date, "%Y-%m-%dT11:59:59Z")

    return start_date_time, end_date_time


def get_tenant(**kwargs) -> str:
    try:
        dag_run = kwargs.get("dag_run")
        tenant = dag_run.conf["tenant"]
    except KeyError:
        tenant = None

    return tenant


def get_air_quality(value: float, pollutant: Pollutant):
    if pollutant == Pollutant.PM10:
        if value <= 50.99:
            return AirQuality.GOOD
        elif 51.00 <= value <= 100.99:
            return AirQuality.MODERATE
        elif 101.00 <= value <= 250.99:
            return AirQuality.UNHEALTHY_FSGs
        elif 251.00 <= value <= 350.99:
            return AirQuality.UNHEALTHY
        elif 351.00 <= value <= 430.99:
            return AirQuality.VERY_UNHEALTHY
        else:
            return AirQuality.HAZARDOUS
    elif pollutant == Pollutant.PM2_5:
        if value <= 12.09:
            return AirQuality.GOOD
        elif 12.1 <= value <= 35.49:
            return AirQuality.MODERATE
        elif 35.5 <= value <= 55.49:
            return AirQuality.UNHEALTHY_FSGs
        elif 55.5 <= value <= 150.49:
            return AirQuality.UNHEALTHY
        elif 150.5 <= value <= 250.49:
            return AirQuality.VERY_UNHEALTHY
        else:
            return AirQuality.HAZARDOUS
    else:
        return None


def format_dataframe_column_type(
    dataframe: pd.DataFrame,
    data_type: DataType,
    columns: list,
) -> pd.DataFrame:
    if not columns:
        return dataframe
    if data_type == DataType.FLOAT:
        dataframe[columns] = dataframe[columns].apply(pd.to_numeric, errors="coerce")

    if data_type == DataType.TIMESTAMP:
        dataframe[columns] = dataframe[columns].apply(pd.to_datetime, errors="coerce")

    if data_type == DataType.TIMESTAMP_STR:
        dataframe[columns] = dataframe[columns].apply(pd.to_datetime, errors="coerce")

        def _date_to_str(date: datetime):
            try:
                return date_to_str(date=date)
            except Exception:
                return None

        for column in columns:
            dataframe[column] = dataframe[column].apply(_date_to_str)

    return dataframe


def get_device(devices=None, channel_id=None, device_id=None):
    if devices is None:
        devices = []

    result = (
        list(filter(lambda x: x["device_number"] == channel_id, devices))
        if channel_id
        else list(filter(lambda x: x["_id"] == device_id, devices))
    )
    return None if not result else result[0]
