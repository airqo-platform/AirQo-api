import json
import pickle
import traceback
from datetime import timedelta, datetime
from typing import Any

import numpy as np
import pandas as pd
import requests

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import (
    get_device,
    get_valid_value,
    get_weather_data_from_tahmo,
    resample_weather_data,
    resample_data,
    remove_invalid_dates,
    download_file_from_gcs,
    get_frequency,
    get_column_value,
    Utils,
)
from .config import configuration
from .constants import DeviceCategory, BamDataType
from .data_validator import DataValidationUtils
from .date import date_to_str, str_to_date, date_to_str_hours


class AirQoDataUtils:
    @staticmethod
    def get_field_8_value(x: str, position: int):

        try:
            values = x.split(",")
            return values[position]
        except Exception as exc:
            print(exc)
            return None

    @staticmethod
    def query_data_from_thingspeak(
        start_time: str, end_time: str, device_numbers: list = None
    ) -> pd.DataFrame:
        thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

        airqo_api = AirQoApi()
        airqo_devices = airqo_api.get_devices(tenant="airqo")
        airqo_devices = list(
            filter(lambda x: int(x["device_number"]) in device_numbers, airqo_devices)
        )
        read_keys = airqo_api.get_read_keys(devices=airqo_devices)

        measurements = pd.DataFrame()
        field_8_mappings = {
            "altitude": 2,
            "wind_speed": 3,
            "satellites": 4,
            "hdop": 5,
            "internalTemperature": 6,
            "internalHumidity": 7,
            "temperature": 8,
            "humidity": 9,
            "pressure": 10,
        }
        frequency = get_frequency(start_time=start_time, end_time=end_time)

        dates = pd.date_range(start_time, end_time, freq=frequency)
        last_date_time = dates.values[len(dates.values) - 1]
        for device in airqo_devices:

            channel_id = str(device["device_number"])

            if device_numbers and int(channel_id) not in device_numbers:
                continue

            read_key = read_keys.get(str(channel_id), "")

            for date in dates:

                start = date_to_str(date)
                end_date_time = date + timedelta(hours=dates.freq.n)

                if np.datetime64(end_date_time) > last_date_time:
                    end = end_time
                else:
                    end = date_to_str(end_date_time)

                url = f"{thingspeak_base_url}{channel_id}/feeds.json?start={start}&end={end}&api_key={read_key}"
                print(f"{url}")

                try:
                    data = json.loads(
                        requests.get(url, timeout=100.0).content.decode("utf-8")
                    )
                    if (data == -1) or ("feeds" not in data):
                        print(f"No data for {url}")
                        continue

                    feeds = pd.DataFrame(data["feeds"])
                    if feeds.empty:
                        print(
                            f"{channel_id} does not have data between {start} and {end}"
                        )
                        continue

                    feeds = feeds[
                        [
                            "field1",
                            "field2",
                            "field3",
                            "field4",
                            "field5",
                            "field6",
                            "field7",
                            "field8",
                            "created_at",
                        ]
                    ]

                    feeds.rename(
                        columns={
                            "field1": "s1_pm2_5",
                            "field2": "s1_pm10",
                            "field3": "s2_pm2_5",
                            "field4": "s2_pm10",
                            "field5": "latitude",
                            "field6": "longitude",
                            "field7": "battery",
                            "created_at": "timestamp",
                        },
                        inplace=True,
                    )

                    for key, value in field_8_mappings.items():
                        feeds[key] = feeds["field8"].apply(
                            lambda x: AirQoDataUtils.get_field_8_value(x, value)
                        )

                    feeds["device_number"] = channel_id
                    del feeds["field8"]
                    measurements = measurements.append(feeds, ignore_index=True)

                except Exception as ex:
                    print(ex)
                    traceback.print_exc()
                    continue

        measurements = remove_invalid_dates(
            dataframe=measurements, start_time=start_time, end_time=end_time
        )

        return DataValidationUtils.get_validate_values(measurements)

    @staticmethod
    def extract_data_from_thingspeak(
        start_date_time,
        end_date_time,
        device_numbers: list = None,
        meta_data: list = None,
    ) -> pd.DataFrame:
        data = pd.DataFrame()

        if meta_data:
            for value in meta_data:

                latitude = dict(value).get("latitude", None)
                longitude = dict(value).get("longitude", None)
                start_date_time = dict(value).get(
                    "start_date_time",
                )
                end_date_time = dict(value).get("end_date_time")
                device_numbers = dict(value).get("device_numbers", [])

                measurements = AirQoDataUtils.query_data_from_thingspeak(
                    start_time=start_date_time,
                    end_time=end_date_time,
                    device_numbers=device_numbers,
                )
                if latitude:
                    measurements["latitude"] = latitude
                if longitude:
                    measurements["longitude"] = longitude
                data = data.append(measurements, ignore_index=True)
        else:
            data = AirQoDataUtils.query_data_from_thingspeak(
                start_time=start_date_time,
                end_time=end_date_time,
                device_numbers=device_numbers,
            )

        data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

        for column in ["wind_speed", "temperature", "humidity"]:
            if column not in data.columns:
                data[column] = None

        return data

    @staticmethod
    def aggregate_mobile_devices_data(data: pd.DataFrame) -> pd.DataFrame:
        data = data.copy()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["timestamp"] = data["timestamp"].apply(date_to_str_hours)
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)

        device_groups = data.groupby("device_number")
        aggregated_data = pd.DataFrame()

        for _, device_group in device_groups:
            device_number = device_group.iloc[0]["device_number"]

            timestamp_groups = device_group.groupby("timestamp")

            for _, timestamp_group in timestamp_groups:
                sampling_data = timestamp_group.copy()

                latitude = sampling_data.iloc[0]["latitude"]
                longitude = sampling_data.iloc[0]["longitude"]

                averages = pd.DataFrame(
                    sampling_data.resample("1H", on="timestamp").mean()
                )
                averages["timestamp"] = averages.index
                averages.reset_index(drop=True, inplace=True)
                averages["latitude"] = latitude
                averages["longitude"] = longitude
                averages["device_number"] = device_number
                aggregated_data = aggregated_data.append(averages, ignore_index=True)

        return aggregated_data

    @staticmethod
    def extract_mobile_devices_weather_data(
        stations: pd.DataFrame, meta_data: list
    ) -> pd.DataFrame:
        from weather_data_utils import WeatherDataUtils

        meta_data_df = pd.DataFrame(meta_data)
        meta_data_df = meta_data_df[
            ["latitude", "longitude", "start_date_time", "end_date_time"]
        ]
        merged_df = pd.merge(
            left=stations, right=meta_data_df, on=["latitude", "longitude"], how="left"
        )
        merged_df.dropna(inplace=True)
        weather_data = pd.DataFrame()
        for _, row in merged_df.iterrows():
            raw_data = WeatherDataUtils.query_raw_data_from_tahmo(
                start_date_time=row["start_date_time"],
                end_date_time=row["end_date_time"],
                station_codes=[row["station_code"]],
            )
            raw_data = WeatherDataUtils.transform_raw_data(raw_data)
            aggregated_data = WeatherDataUtils.aggregate_data(raw_data)
            latitude = row["latitude"]
            longitude = row["longitude"]
            aggregated_data["latitude"] = latitude
            aggregated_data["longitude"] = longitude

            result = list(
                filter(
                    lambda entry: (
                        entry["latitude"] == latitude
                        and entry["longitude"] == longitude
                    ),
                    meta_data,
                )
            )

            for x in result:
                devices = list(x["device_numbers"])
                for device in devices:
                    aggregated_data["device_number"] = device
                    weather_data = weather_data.append(
                        aggregated_data, ignore_index=True
                    )

        return weather_data

    @staticmethod
    def merge_mobile_devices_data_and_weather_data(
        measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        measurements = measurements.copy()
        weather_data = weather_data.copy()

        measurements["timestamp"] = measurements["timestamp"].apply(pd.to_datetime)
        measurements[["longitude", "latitude"]] = measurements[
            ["longitude", "latitude"]
        ].apply(pd.to_numeric, errors="coerce")
        measurements["device_number"] = measurements["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        weather_data["timestamp"] = weather_data["timestamp"].apply(pd.to_datetime)
        weather_data[["longitude", "latitude"]] = weather_data[
            ["longitude", "latitude"]
        ].apply(pd.to_numeric, errors="coerce")
        weather_data["device_number"] = weather_data["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        measurements.rename(
            columns={
                "temperature": "sensor_temperature",
                "humidity": "sensor_humidity",
                "wind_speed": "sensor_wind_speed",
            },
            inplace=True,
        )
        data = pd.merge(
            measurements,
            weather_data,
            on=["device_number", "latitude", "longitude", "timestamp"],
            how="left",
        )

        if "sensor_temperature" in data.columns:
            data["humidity"] = data["humidity"].fillna(data["sensor_temperature"])
            del data["sensor_humidity"]

        if "sensor_temperature" in data.columns:
            data["temperature"] = data["temperature"].fillna(data["sensor_temperature"])
            del data["sensor_temperature"]

        if "sensor_wind_speed" in data.columns:
            data["wind_speed"] = data["wind_speed"].fillna(data["sensor_wind_speed"])
            del data["sensor_wind_speed"]

        return data

    @staticmethod
    def restructure_airqo_mobile_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["tenant"] = "airqo"
        return data

    @staticmethod
    def extract_bam_data_from_thingspeak(
        start_time: str, end_time: str
    ) -> pd.DataFrame:
        thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

        airqo_api = AirQoApi()
        airqo_devices = airqo_api.get_devices(
            tenant="airqo", category=DeviceCategory.BAM
        )
        read_keys = airqo_api.get_read_keys(devices=airqo_devices)

        bam_data = pd.DataFrame()

        frequency = get_frequency(start_time=start_time, end_time=end_time)

        dates = pd.date_range(start_time, end_time, freq=frequency)
        last_date_time = dates.values[len(dates.values) - 1]
        for device in airqo_devices:

            channel_id = str(device["device_number"])
            read_key = read_keys.get(str(channel_id), None)
            if not read_key:
                print(f"{channel_id} does not have a read key")
                continue

            for date in dates:

                start = date_to_str(date)
                end_date_time = date + timedelta(hours=dates.freq.n)

                if np.datetime64(end_date_time) > last_date_time:
                    end = end_time
                else:
                    end = date_to_str(end_date_time)

                try:
                    url = f"{thingspeak_base_url}{channel_id}/feeds.json?start={start}&end={end}&api_key={read_key}"
                    print(f"{url}")

                    data = json.loads(
                        requests.get(url, timeout=100.0).content.decode("utf-8")
                    )
                    if (data == -1) or ("feeds" not in data):
                        print(f"No data for {url}")
                        continue

                    feeds = pd.DataFrame(data["feeds"])
                    if feeds.empty:
                        print(
                            f"{channel_id} does not have data between {start} and {end}"
                        )
                        continue

                    feeds = feeds[
                        [
                            "field1",
                            "field2",
                            "field3",
                            "field4",
                            "field5",
                            "field6",
                            "field7",
                            "created_at",
                        ]
                    ]
                    feeds.rename(
                        columns={
                            "field1": "pm2_5",
                            "field2": "pm10",
                            "field3": "pm2_5",
                            "field4": "pm10",
                            "field5": "latitude",
                            "field6": "longitude",
                            "field7": "pm10",
                            "created_at": "timestamp",
                        },
                        inplace=True,
                    )

                    feeds["pm2_5"] = feeds["pm2_5"].apply(
                        lambda x: get_valid_value(x, "pm2_5")
                    )
                    feeds["pm10"] = feeds["pm10"].apply(
                        lambda x: get_valid_value(x, "pm10")
                    )
                    feeds["latitude"] = feeds["latitude"].apply(
                        lambda x: get_valid_value(x, "latitude")
                    )
                    feeds["longitude"] = feeds["longitude"].apply(
                        lambda x: get_valid_value(x, "longitude")
                    )

                    feeds["device_number"] = channel_id
                    feeds["device_id"] = device["_id"]
                    feeds["site_id"] = device["site"]["_id"]

                    bam_data = bam_data.append(feeds, ignore_index=True)
                except Exception as ex:
                    print(ex)
                    traceback.print_exc()

        bam_data = remove_invalid_dates(
            dataframe=bam_data, start_time=start_time, end_time=end_time
        )
        return bam_data

    @staticmethod
    def process_bam_data(data: pd.DataFrame, data_type: BamDataType) -> pd.DataFrame:

        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["tenant"] = "airqo"

        if data_type == BamDataType.OUTLIERS:
            data = data.loc[data["status"] != 0]
        else:
            data = data.loc[data["status"] == 0]

        return data

    @staticmethod
    def process_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.bam_measurements_table)
        return Utils.populate_missing_columns(data=data, cols=cols)


def extract_airqo_devices_deployment_history() -> pd.DataFrame:
    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="airqo")
    devices_history = []
    for device in devices:

        try:
            maintenance_logs = airqo_api.get_maintenance_logs(
                tenant="airqo", device=device["name"], activity_type="deployment"
            )

            if not maintenance_logs or len(maintenance_logs) <= 1:
                continue

            log_df = pd.DataFrame(maintenance_logs)
            log_df = log_df.dropna(subset=["date"])

            log_df["site_id"] = (
                log_df["site_id"].fillna(method="bfill").fillna(method="ffill")
            )
            log_df = log_df.dropna(subset=["site_id"])

            log_df["start_time"] = pd.to_datetime(log_df["date"])
            log_df = log_df.sort_values(by="start_time")
            log_df["end_time"] = log_df["start_time"].shift(-1)
            log_df["end_time"] = log_df["end_time"].fillna(datetime.utcnow())

            log_df["start_time"] = log_df["start_time"].apply(lambda x: date_to_str(x))
            log_df["end_time"] = log_df["end_time"].apply(lambda x: date_to_str(x))

            if len(set(log_df["site_id"].tolist())) == 1:
                continue

            for _, raw in log_df.iterrows():
                device_history = {
                    "device": raw["device"],
                    "device_id": device["_id"],
                    "start_time": raw["start_time"],
                    "end_time": raw["end_time"],
                    "site_id": raw["site_id"],
                }

                devices_history.append(device_history)

        except Exception as ex:
            print(ex)
            traceback.print_exc()

    return pd.DataFrame(devices_history)


def average_airqo_measurements(data: pd.DataFrame, frequency: str) -> pd.DataFrame:
    if len(data) == 0:
        print("events list is empty")
        return pd.DataFrame([])

    devices_groups = data.groupby("device")
    averaged_measurements = []

    for _, device_group in devices_groups:

        try:
            device_measurements = pd.json_normalize(
                device_group.to_dict(orient="records")
            )

            measurement_metadata = device_measurements[
                ["site_id", "device_id", "device", "device_number"]
            ].copy()

            measurement_readings = device_measurements

            del measurement_readings["site_id"]
            del measurement_readings["device_id"]
            del measurement_readings["frequency"]
            del measurement_readings["device"]
            del measurement_readings["device_number"]

            averages = resample_data(measurement_readings, frequency)

            for _, row in averages.iterrows():
                combined_dataset = dict(
                    {
                        **row.to_dict(),
                        **measurement_metadata.iloc[0].to_dict(),
                    }
                )
                averaged_measurements.append(combined_dataset)
        except Exception as ex:
            print(ex)
            traceback.print_exc()

    return pd.DataFrame(averaged_measurements)


def extract_airqo_data_from_thingspeak(start_time: str, end_time: str) -> pd.DataFrame:
    thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

    airqo_api = AirQoApi()
    airqo_devices = airqo_api.get_devices(tenant="airqo")
    read_keys = airqo_api.get_read_keys(devices=airqo_devices)

    channels_data = []

    frequency = get_frequency(start_time=start_time, end_time=end_time)

    def get_field_8_value(x: str, position: int):

        try:
            values = x.split(",")
            return values[position]
        except Exception as exc:
            print(exc)
            return None

    dates = pd.date_range(start_time, end_time, freq=frequency)
    last_date_time = dates.values[len(dates.values) - 1]
    for device in airqo_devices:
        try:

            channel_id = str(device["device_number"])

            for date in dates:

                start = date_to_str(date)
                end_date_time = date + timedelta(hours=dates.freq.n)

                if np.datetime64(end_date_time) > last_date_time:
                    end = end_time
                else:
                    end = date_to_str(end_date_time)

                read_key = read_keys[str(channel_id)]

                channel_url = f"{thingspeak_base_url}{channel_id}/feeds.json?start={start}&end={end}&api_key={read_key}"
                print(f"{channel_url}")

                data = json.loads(
                    requests.get(channel_url, timeout=100.0).content.decode("utf-8")
                )
                if (data != -1) and ("feeds" in data):
                    dataframe = pd.DataFrame(data["feeds"])

                    if dataframe.empty:
                        print(
                            f"{channel_id} does not have data between {start} and {end}"
                        )
                        continue

                    channel_df = pd.DataFrame(
                        data=[],
                        columns=[
                            "time",
                            "s1_pm2_5",
                            "s2_pm2_5",
                            "s1_pm10",
                            "device_id",
                            "site_id",
                            "s2_pm10",
                            "latitude",
                            "longitude",
                            "altitude",
                            "wind_speed",
                            "satellites",
                            "hdop",
                            "internalTemperature",
                            "internalHumidity",
                            "battery",
                            "temperature",
                            "humidity",
                            "pressure",
                            "externalAltitude",
                        ],
                    )

                    channel_df["s1_pm2_5"] = dataframe["field1"].apply(
                        lambda x: get_valid_value(x, "pm2_5")
                    )
                    channel_df["s1_pm10"] = dataframe["field2"].apply(
                        lambda x: get_valid_value(x, "pm10")
                    )
                    channel_df["s2_pm2_5"] = dataframe["field3"].apply(
                        lambda x: get_valid_value(x, "pm2_5")
                    )
                    channel_df["s2_pm10"] = dataframe["field4"].apply(
                        lambda x: get_valid_value(x, "pm10")
                    )
                    channel_df["latitude"] = dataframe["field5"].apply(
                        lambda x: get_valid_value(x, "latitude")
                    )
                    channel_df["longitude"] = dataframe["field6"].apply(
                        lambda x: get_valid_value(x, "longitude")
                    )
                    channel_df["battery"] = dataframe["field7"].apply(
                        lambda x: get_valid_value(x, "battery")
                    )

                    if "field8" in dataframe.columns:
                        try:
                            channel_df["latitude"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 0), "latitude"
                                )
                            )
                            channel_df["longitude"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 1), "longitude"
                                )
                            )
                            channel_df["altitude"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 2), "altitude"
                                )
                            )
                            channel_df["wind_speed"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 3), "wind_speed"
                                )
                            )
                            channel_df["satellites"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 4), "satellites"
                                )
                            )
                            channel_df["hdop"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 5), "hdop"
                                )
                            )
                            channel_df["internalTemperature"] = dataframe[
                                "field8"
                            ].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 6), "externalTemperature"
                                )
                            )
                            channel_df["internalHumidity"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 7), "externalHumidity"
                                )
                            )
                            channel_df["temperature"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 8), "externalTemperature"
                                )
                            )
                            channel_df["humidity"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 9), "externalHumidity"
                                )
                            )
                            channel_df["pressure"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 10), "pressure"
                                )
                            )
                            channel_df["externalAltitude"] = dataframe["field8"].apply(
                                lambda x: get_valid_value(
                                    get_field_8_value(x, 11), "altitude"
                                )
                            )

                        except Exception as ex:
                            traceback.print_exc()
                            print(ex)

                    channel_df["time"] = dataframe["created_at"]
                    channel_df["device_id"] = device["_id"]
                    channel_df["site_id"] = device["site"]["_id"]
                    channel_df["device_number"] = device["device_number"]
                    channel_df["device"] = device["name"]
                    channel_df["frequency"] = "raw"

                    channels_data.extend(channel_df.to_dict(orient="records"))

        except Exception as ex:
            print(ex)
            traceback.print_exc()

    channel_data_df = pd.DataFrame(channels_data)
    clean_channel_data_df = remove_invalid_dates(
        dataframe=channel_data_df, start_time=start_time, end_time=end_time
    )
    return clean_channel_data_df


def average_airqo_data(data: pd.DataFrame, frequency="hourly") -> pd.DataFrame:
    device_groups = data.groupby("device_id")
    sampled_data = []

    for _, device_group in device_groups:
        site_id = device_group.iloc[0]["site_id"]
        device_id = device_group.iloc[0]["device_id"]
        device_number = device_group.iloc[0]["device_number"]
        device = device_group.iloc[0]["device"]

        del device_group["site_id"]
        del device_group["device_id"]
        del device_group["device_number"]
        del device_group["device"]

        averages = resample_data(device_group, frequency)

        averages["frequency"] = frequency.lower()
        averages["device_id"] = device_id
        averages["site_id"] = site_id
        averages["device_number"] = device_number
        averages["device"] = device

        sampled_data.extend(averages.to_dict(orient="records"))

    print(f"after sampling airqo data => {len(sampled_data)}")
    return pd.DataFrame(sampled_data)


# TODO: remove invalid weather values
def extract_airqo_weather_data_from_tahmo(
    start_time: str, end_time: str, frequency="hourly"
) -> pd.DataFrame:
    raw_weather_data = get_weather_data_from_tahmo(
        start_time=start_time, end_time=end_time
    )
    sampled_weather_data = resample_weather_data(
        raw_weather_data=raw_weather_data, frequency=frequency
    )

    return sampled_weather_data


def restructure_airqo_data_for_api(data: pd.DataFrame) -> list:
    restructured_data = []

    columns = list(data.columns)

    for _, data_row in data.iterrows():
        device_data = dict(
            {
                "device": data_row["device"],
                "device_id": data_row["device_id"],
                "site_id": data_row["site_id"],
                "device_number": data_row["device_number"],
                "tenant": "airqo",
                "location": {
                    "latitude": {
                        "value": get_column_value(
                            column="latitude", series=data_row, columns=columns
                        )
                    },
                    "longitude": {
                        "value": get_column_value(
                            column="longitude", series=data_row, columns=columns
                        )
                    },
                },
                "frequency": data_row["frequency"],
                "time": data_row["time"],
                "average_pm2_5": {
                    "value": data_row["raw_pm2_5"],
                    "calibratedValue": data_row["pm2_5"],
                },
                "average_pm10": {
                    "value": data_row["raw_pm10"],
                    "calibratedValue": data_row["pm10"],
                },
                "pm2_5": {
                    "value": get_column_value(
                        column="s1_pm2_5", series=data_row, columns=columns
                    )
                },
                "pm10": {
                    "value": get_column_value(
                        column="s1_pm10", series=data_row, columns=columns
                    )
                },
                # "pm2_5": {
                #     "value": get_column_value("pm2_5", data_row, columns, "pm2_5"),
                #     "rawValue": get_column_value("raw_pm2_5", data_row, columns, "pm2_5"),
                #     "calibratedValue": get_column_value("calibrated_pm2_5", data_row, columns, "pm2_5")
                # },
                # "pm10": {
                #     "value": get_column_value("pm10", data_row, columns, "pm10"),
                #     "rawValue": get_column_value("raw_pm10", data_row, columns, "pm10"),
                #     "calibratedValue": get_column_value("calibrated_pm10", data_row, columns, "pm10")
                # },
                "s1_pm2_5": {
                    "value": get_column_value(
                        column="s1_pm2_5", series=data_row, columns=columns
                    )
                },
                "s1_pm10": {
                    "value": get_column_value(
                        column="s1_pm10", series=data_row, columns=columns
                    )
                },
                "s2_pm2_5": {
                    "value": get_column_value(
                        column="s2_pm2_5", series=data_row, columns=columns
                    )
                },
                "s2_pm10": {
                    "value": get_column_value(
                        column="s2_pm10", series=data_row, columns=columns
                    )
                },
                "battery": {
                    "value": get_column_value(
                        column="voltage", series=data_row, columns=columns
                    )
                },
                "altitude": {
                    "value": get_column_value(
                        column="altitude", series=data_row, columns=columns
                    )
                },
                "speed": {
                    "value": get_column_value(
                        column="wind_speed", series=data_row, columns=columns
                    )
                },
                "satellites": {
                    "value": get_column_value(
                        column="no_sats", series=data_row, columns=columns
                    )
                },
                "hdop": {
                    "value": get_column_value(
                        column="hdope", series=data_row, columns=columns
                    )
                },
                "externalTemperature": {
                    "value": get_column_value(
                        column="temperature", series=data_row, columns=columns
                    )
                },
                "externalHumidity": {
                    "value": get_column_value(
                        column="humidity", series=data_row, columns=columns
                    )
                },
            }
        )

        restructured_data.append(device_data)

    return restructured_data


def restructure_airnow_data_for_api_storage(data: pd.DataFrame) -> list:
    restructured_data = []

    for _, data_row in data.iterrows():
        restructured_data.append(
            {
                "tenant": "airqo",
                "time": data_row["timestamp"],
                "frequency": "hourly",
                "site_id": data_row["site_id"],
                "device_number": data_row["device_number"],
                "device": data_row["device"],
                "device_id": data_row["device_id"],
                "location": {
                    "latitude": {"value": data_row["latitude"]},
                    "longitude": {"value": data_row["longitude"]},
                },
                "pm2_5": {"value": data_row["pm2_5"]},
                "s1_pm2_5": {"value": data_row["s1_pm2_5"]},
                "s2_pm2_5": {"value": data_row["s2_pm2_5"]},
                "pm10": {"value": data_row["pm10"]},
                "s1_pm10": {"value": data_row["s1_pm10"]},
                "s2_pm10": {"value": data_row["s2_pm10"]},
                "no2": {"value": data_row["no2"]},
                "pm1": {"value": data_row["pm1"]},
                "external_temperature": {"value": data_row["external_temperature"]},
                "external_humidity": {"value": data_row["external_humidity"]},
                "speed": {"value": data_row["wind_speed"]},
            }
        )

    return restructured_data


def map_site_ids_to_historical_measurements(
    data: pd.DataFrame, deployment_logs: pd.DataFrame
) -> pd.DataFrame:
    if deployment_logs.empty or data.empty:
        return data

    airqo_api = AirQoApi()
    devices = airqo_api.get_devices(tenant="airqo")

    mapped_data = []

    devices_logs_df = pd.DataFrame(deployment_logs)
    devices_logs_df["start_time"] = devices_logs_df["start_time"].apply(
        lambda x: str_to_date(x)
    )
    devices_logs_df["end_time"] = devices_logs_df["end_time"].apply(
        lambda x: str_to_date(x)
    )
    date_time_column = "time" if "time" in list(data.columns) else "timestamp"
    for _, data_row in data.iterrows():
        device = get_device(devices, device_id=data_row["device_id"])

        if not device:
            continue

        site_id = device.get("site").get("_id")
        date_time = str_to_date(data_row[date_time_column])
        device_logs = devices_logs_df[devices_logs_df["device_id"] == device.get("_id")]

        if not device_logs.empty:
            for _, log in device_logs.iterrows():
                if log["start_time"] <= date_time <= log["end_time"]:
                    site_id = log["site_id"]

        data_row["site_id"] = site_id

        mapped_data.append(data_row.to_dict())

    return pd.DataFrame(mapped_data)


def restructure_airqo_data_for_message_broker(data: pd.DataFrame) -> list:
    restructured_data = []

    columns = list(data.columns)

    for _, data_row in data.iterrows():
        device_data = dict(
            {
                "time": data_row["time"],
                "tenant": "airqo",
                "site_id": data_row["site_id"],
                "device_number": data_row["device_number"],
                "frequency": data_row["frequency"],
                "device": data_row["device"],
                "latitude": get_column_value(
                    column="latitude", columns=columns, series=data_row
                ),
                "longitude": get_column_value(
                    column="longitude", columns=columns, series=data_row
                ),
                "pm2_5": get_column_value(
                    column="pm2_5", columns=columns, series=data_row
                ),
                "pm10": get_column_value(
                    column="pm10", columns=columns, series=data_row
                ),
                "s1_pm2_5": get_column_value(
                    column="s1_pm2_5", columns=columns, series=data_row
                ),
                "s1_pm10": get_column_value(
                    column="s1_pm10", columns=columns, series=data_row
                ),
                "s2_pm2_5": get_column_value(
                    column="s2_pm2_5", columns=columns, series=data_row
                ),
                "s2_pm10": get_column_value(
                    column="s2_pm10", columns=columns, series=data_row
                ),
                "pm2_5_calibrated_value": get_column_value(
                    column="calibrated_pm2_5", columns=columns, series=data_row
                ),
                "pm10_calibrated_value": get_column_value(
                    column="calibrated_pm10", columns=columns, series=data_row
                ),
                "altitude": get_column_value(
                    column="altitude", columns=columns, series=data_row
                ),
                "wind_speed": get_column_value(
                    column="wind_speed", columns=columns, series=data_row
                ),
                "external_temperature": get_column_value(
                    column="temperature", columns=columns, series=data_row
                ),
                "external_humidity": get_column_value(
                    column="humidity", columns=columns, series=data_row
                ),
            }
        )

        restructured_data.append(device_data)

    return restructured_data


def restructure_airqo_data(data: pd.DataFrame, destination: str) -> Any:
    data["raw_pm2_5"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
    data["raw_pm10"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

    if "calibrated_pm2_5" in data.columns:
        data["pm2_5"] = data["calibrated_pm2_5"]
    else:
        data["calibrated_pm2_5"] = None
        data["pm2_5"] = None

    if "calibrated_pm10" in data.columns:
        data["pm10"] = data["calibrated_pm10"]
    else:
        data["calibrated_pm10"] = None
        data["pm10"] = None

    data["pm2_5"] = data["pm2_5"].fillna(data["raw_pm2_5"])
    data["pm10"] = data["pm10"].fillna(data["raw_pm10"])

    devices = AirQoApi().get_devices(tenant="airqo")
    formatted_data = pd.DataFrame()
    device_groups = data.groupby("device_number")

    for _, device_group in device_groups:
        device_number = device_group.iloc[0]["device_number"]
        device_details = get_device(devices=devices, channel_id=device_number)
        device_group["device"] = device_details.get("name", None)
        device_group["device_id"] = device_details.get("_id", None)
        formatted_data = formatted_data.append(device_group, ignore_index=True)

    destination = destination.lower()

    if destination == "api":
        return restructure_airqo_data_for_api(formatted_data)
    elif destination == "message-broker":
        return restructure_airqo_data_for_message_broker(formatted_data)
    elif destination == "app-insights":
        from app_insights_utils import format_airqo_data_to_insights

        return format_airqo_data_to_insights(formatted_data)
    elif destination == "bigquery":
        return restructure_airqo_data_for_bigquery(formatted_data)
    else:
        raise Exception("Invalid Destination")


def restructure_airqo_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:

    if "time" in list(data.columns) and "timestamp" not in list(data.columns):
        data["timestamp"] = data["time"]
        del data["time"]

    data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
    data["tenant"] = "airqo"

    columns = [
        "timestamp",
        "tenant",
        "site_id",
        "device_number",
        "device",
        "latitude",
        "longitude",
        "pm2_5",
        "s1_pm2_5",
        "s2_pm2_5",
        "raw_pm2_5",
        "calibrated_pm2_5",
        "pm10",
        "s1_pm10",
        "s2_pm10",
        "raw_pm10",
        "calibrated_pm10",
        "no2",
        "raw_no2",
        "calibrated_no2",
        "pm1",
        "calibrated_pm1",
        "raw_pm1",
        "temperature",
        "humidity",
        "wind_speed",
        "altitude",
    ]

    for col in columns:
        if col not in list(data.columns):
            data[col] = None

    return data.rename(
        columns={
            "humidity": "external_humidity",
            "temperature": "external_temperature",
            "raw_no2": "no2_raw_value",
            "raw_pm1": "pm1_raw_value",
            "raw_pm10": "pm10_raw_value",
            "raw_pm2_5": "pm2_5_raw_value",
            "calibrated_pm2_5": "pm2_5_calibrated_value",
            "calibrated_pm10": "pm10_calibrated_value",
            "calibrated_no2": "no2_calibrated_value",
            "calibrated_pm1": "pm1_calibrated_value",
        }
    )


def merge_airqo_and_weather_data(
    airqo_data: pd.DataFrame, weather_data: pd.DataFrame
) -> pd.DataFrame:
    if weather_data.empty:
        return airqo_data

    airqo_data["frequency"] = airqo_data["frequency"].apply(lambda x: str(x).lower())
    weather_data["frequency"] = weather_data["frequency"].apply(
        lambda x: str(x).lower()
    )

    if ("site_id" in weather_data.columns) and ("site_id" in airqo_data.columns):
        weather_data.drop(columns=["site_id"], inplace=True)

    merged_data = pd.merge(
        airqo_data,
        weather_data,
        on=["device_id", "time", "frequency"],
        how="left",
    )

    def merge_values(dataframe: pd.DataFrame, variable: str) -> pd.DataFrame:
        dataframe[variable] = dataframe[f"{variable}_x"].apply(
            lambda x: get_valid_value(x, variable)
        )
        dataframe[variable] = dataframe[variable].fillna(dataframe[f"{variable}_y"])
        dataframe = dataframe.drop(columns=[f"{variable}_x", f"{variable}_y"], axis=1)
        return dataframe

    if (
        "temperature_y" in merged_data.columns
        and "temperature_x" in merged_data.columns
    ):
        merged_data = merge_values(merged_data, "temperature")

    if "humidity_y" in merged_data.columns and "humidity_x" in merged_data.columns:
        merged_data = merge_values(merged_data, "humidity")

    if "wind_speed_y" in merged_data.columns and "wind_speed_x" in merged_data.columns:
        merged_data = merge_values(merged_data, "wind_speed")

    return merged_data


def calibrate_using_pickle_file(measurements: pd.DataFrame) -> list:
    if measurements.empty:
        return []

    pm_2_5_model_file = download_file_from_gcs(
        bucket_name="airqo_prediction_bucket",
        source_file="PM2.5_calibrate_model.pkl",
        destination_file="pm2_5_model.pkl",
    )

    pm_10_model_file = download_file_from_gcs(
        bucket_name="airqo_prediction_bucket",
        source_file="PM10_calibrate_model.pkl",
        destination_file="pm10_model.pkl",
    )

    rf_regressor = pickle.load(open(pm_2_5_model_file, "rb"))
    lasso_regressor = pickle.load(open(pm_10_model_file, "rb"))

    calibrated_measurements = []

    for _, row in measurements:
        try:
            calibrated_row = row
            hour = pd.to_datetime(row["time"]).hour
            s1_pm2_5 = row["s1_pm2_5"]
            s2_pm2_5 = row["s2_pm2_5"]
            s1_pm10 = row["s1_pm10"]
            s2_pm10 = row["s2_pm10"]
            temperature = row["temperature"]
            humidity = row["humidity"]

            input_variables = pd.DataFrame(
                [[s1_pm2_5, s2_pm2_5, s1_pm10, s2_pm10, temperature, humidity, hour]],
                columns=[
                    "s1_pm2_5",
                    "s2_pm2_5",
                    "s1_pm10",
                    "s2_pm10",
                    "temperature",
                    "humidity",
                    "hour",
                ],
                dtype="float",
                index=["input"],
            )

            input_variables["avg_pm2_5"] = (
                input_variables[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1).round(2)
            )
            input_variables["avg_pm10"] = (
                input_variables[["s1_pm10", "s2_pm10"]].mean(axis=1).round(2)
            )
            input_variables["error_pm10"] = np.abs(
                input_variables["s1_pm10"] - input_variables["s2_pm10"]
            )
            input_variables["error_pm2_5"] = np.abs(
                input_variables["s1_pm2_5"] - input_variables["s2_pm2_5"]
            )
            input_variables["pm2_5_pm10"] = (
                input_variables["avg_pm2_5"] - input_variables["avg_pm10"]
            )
            input_variables["pm2_5_pm10_mod"] = (
                input_variables["pm2_5_pm10"] / input_variables["avg_pm10"]
            )
            input_variables = input_variables.drop(
                ["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10"], axis=1
            )

            # reorganise columns
            input_variables = input_variables[
                [
                    "avg_pm2_5",
                    "avg_pm10",
                    "temperature",
                    "humidity",
                    "hour",
                    "error_pm2_5",
                    "error_pm10",
                    "pm2_5_pm10",
                    "pm2_5_pm10_mod",
                ]
            ]

            calibrated_pm2_5 = rf_regressor.predict(input_variables)[0]
            calibrated_pm10 = lasso_regressor.predict(input_variables)[0]

            calibrated_row["calibrated_pm2_5"] = calibrated_pm2_5
            calibrated_row["calibrated_pm10"] = calibrated_pm10

            calibrated_measurements.append(calibrated_row.to_dict(orient="records"))

        except Exception as ex:
            traceback.print_exc()
            print(ex)
            continue

    return calibrated_measurements


def calibrate_using_api(measurements: pd.DataFrame) -> list:
    if measurements.empty:
        return []

    data_df_groups = measurements.groupby("time")
    airqo_api = AirQoApi()
    calibrated_measurements = []

    for _, time_group in data_df_groups:

        try:
            data = time_group
            date_time = data.iloc[0]["time"]

            calibrate_body = data.to_dict(orient="records")

            calibrated_values = airqo_api.get_calibrated_values(
                time=date_time, calibrate_body=calibrate_body
            )

            for value in calibrated_values:
                try:
                    data.loc[
                        (data["device_id"] == value["device_id"])
                        & (data["time"] == date_time),
                        "calibrated_pm2_5",
                    ] = value["calibrated_PM2.5"]
                    data.loc[
                        (data["device_id"] == value["device_id"])
                        & (data["time"] == date_time),
                        "calibrated_pm10",
                    ] = value["calibrated_PM10"]
                except Exception as ex:
                    traceback.print_exc()
                    print(ex)
                    continue

            calibrated_measurements.extend(data.to_dict(orient="records"))

        except Exception as ex:
            traceback.print_exc()
            print(ex)
            continue

    return calibrated_measurements


def calibrate_hourly_airqo_measurements(
    measurements: pd.DataFrame, method: str = "api"
) -> pd.DataFrame:
    measurements["s1_pm2_5"] = measurements["s1_pm2_5"].apply(
        lambda x: get_valid_value(x, "pm2_5")
    )
    measurements["s2_pm2_5"] = measurements["s2_pm2_5"].apply(
        lambda x: get_valid_value(x, "pm2_5")
    )
    measurements["s1_pm10"] = measurements["s1_pm10"].apply(
        lambda x: get_valid_value(x, "pm10")
    )
    measurements["s2_pm10"] = measurements["s2_pm10"].apply(
        lambda x: get_valid_value(x, "pm10")
    )

    if "temperature" in measurements.columns:
        measurements["temperature"] = measurements["temperature"].apply(
            lambda x: get_valid_value(x, "temperature")
        )
    else:
        measurements["temperature"] = None

    if "humidity" in measurements.columns:
        measurements["humidity"] = measurements["humidity"].apply(
            lambda x: get_valid_value(x, "humidity")
        )
    else:
        measurements["humidity"] = None

    uncalibrated_data = measurements.loc[
        (measurements["s1_pm2_5"].isnull())
        | (measurements["s1_pm10"].isnull())
        | (measurements["s2_pm2_5"].isnull())
        | (measurements["s2_pm10"].isnull())
        | (measurements["temperature"].isnull())
        | (measurements["humidity"].isnull())
    ]

    calibration_data_df = measurements.dropna(
        subset=["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10", "temperature", "humidity"]
    )
    calibrated_measurements = []

    if not calibration_data_df.empty:
        if method.lower() == "pickle":
            calibrated_data = calibrate_using_pickle_file(calibration_data_df)
        else:
            calibrated_data = calibrate_using_api(calibration_data_df)

        calibrated_measurements.extend(calibrated_data)

    calibrated_measurements.extend(uncalibrated_data.to_dict(orient="records"))

    return pd.DataFrame(calibrated_measurements)
