import math
from datetime import timedelta, datetime

import numpy as np
import pandas as pd
from google.cloud import storage

from .constants import AirQuality, Pollutant
from .date import (
    date_to_str,
)


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
    elif (name == "altitude" or name == "hdop") and value <= 0:
        return None
    elif name == "satellites" and (value <= 0 or value > 50):
        return None
    elif (name == "temperature") and (value <= 0 or value > 45):
        return None
    elif (name == "humidity") and (value <= 0 or value > 99):
        return None
    elif name == "pressure" and (value < 30 or value > 110):
        return None
    else:
        pass

    return value


def to_double(x):
    try:
        value = float(x)
        return None if (math.isnan(value) or np.isnan(value)) else value
    except Exception:
        return None


def download_file_from_gcs(bucket_name: str, source_file: str, destination_file: str):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_file)
    blob.download_to_filename(destination_file)
    print(
        f"file: {destination_file} downloaded from bucket: {bucket_name} successfully"
    )
    return destination_file


def remove_invalid_dates(
    dataframe: pd.DataFrame, start_time: str, end_time: str
) -> pd.DataFrame:
    start = pd.to_datetime(start_time)
    end = pd.to_datetime(end_time)

    date_time_column = "time" if "time" in list(dataframe.columns) else "timestamp"

    dataframe[date_time_column] = pd.to_datetime(dataframe[date_time_column])
    dataframe.set_index([date_time_column], inplace=True)

    time_data_frame = dataframe.loc[
        (dataframe.index >= start) & (dataframe.index <= end)
    ]

    time_data_frame[date_time_column] = time_data_frame.index
    time_data_frame[date_time_column] = time_data_frame[date_time_column].apply(
        date_to_str
    )

    return time_data_frame.reset_index(drop=True)


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
        start_date_time = dag_run.conf["start_date_time"]
        end_date_time = dag_run.conf["end_date_time"]
    except KeyError:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=interval_in_days)
        start_date_time = datetime.strftime(start_date, "%Y-%m-%dT00:00:00Z")
        end_date_time = datetime.strftime(end_date, "%Y-%m-%dT11:59:59Z")

    return start_date_time, end_date_time


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


def get_device(devices=None, channel_id=None, device_id=None) -> dict:
    if devices is None:
        devices = []

    result = (
        list(filter(lambda x: x["device_number"] == channel_id, devices))
        if channel_id
        else list(filter(lambda x: x["_id"] == device_id, devices))
    )
    return {} if not result else result[0]
