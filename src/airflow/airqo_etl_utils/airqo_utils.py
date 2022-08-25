import json
import pickle
import traceback
from datetime import datetime

import numpy as np
import pandas as pd
import requests

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import remove_invalid_dates, download_file_from_gcs
from .config import configuration
from .constants import DeviceCategory, BamDataType, Tenant, Frequency, DataSource
from .data_validator import DataValidationUtils
from .date import date_to_str
from .utils import Utils
from .weather_data_utils import WeatherDataUtils


class AirQoDataUtils:
    @staticmethod
    def extract_aggregated_raw_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=bigquery_api.raw_measurements_table,
            where_fields={"tenant": "airqo"},
        )

        if measurements.empty:
            return pd.DataFrame([])

        measurements = measurements.dropna(subset=["timestamp"])
        measurements["timestamp"] = measurements["timestamp"].apply(pd.to_datetime)
        averaged_measurements = pd.DataFrame()
        devices_groups = measurements.groupby("device_number")

        for _, device_group in devices_groups:
            device_number = device_group.iloc[0]["device_number"]
            device_site_groups = device_group.groupby("site_id")

            for _, device_site in device_site_groups:
                site_id = device_site.iloc[0]["site_id"]
                data = device_site.sort_index(axis=0)
                averages = pd.DataFrame(data.resample("1H", on="timestamp").mean())
                averages["timestamp"] = averages.index
                averages["device_number"] = device_number
                averages["site_id"] = site_id
                averaged_measurements = averaged_measurements.append(
                    averages, ignore_index=True
                )

        return averaged_measurements

    @staticmethod
    def get_field_8_value(x: str, position: int):

        try:
            values = x.split(",")
            return values[position]
        except Exception as exc:
            print(exc)
            return None

    @staticmethod
    def query_low_cost_sensors_data(
        start_date_time: str, end_date_time: str, device_numbers: list = None
    ) -> pd.DataFrame:
        thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

        airqo_api = AirQoApi()
        airqo_devices = airqo_api.get_devices(tenant="airqo")
        if device_numbers:
            airqo_devices = list(
                filter(
                    lambda x: int(x["device_number"]) in device_numbers, airqo_devices
                )
            )
        read_keys = airqo_api.get_read_keys(devices=airqo_devices)

        measurements = pd.DataFrame()
        field_8_mappings = {
            "altitude": 2,
            "wind_speed": 3,
            "satellites": 4,
            "hdop": 5,
            "device_temperature": 6,
            "device_humidity": 7,
            "temperature": 8,
            "humidity": 9,
            "pressure": 10,
        }

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.THINGSPEAK,
        )

        for device in airqo_devices:
            device_dict = dict(device)

            category = device_dict.get("category", None)
            if category and category == "bam":
                continue

            channel_id = str(device_dict.get("device_number"))
            if device_numbers and int(channel_id) not in device_numbers:
                continue

            read_key = read_keys.get(str(channel_id), "")

            for start, end in dates:

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
                    channel = data["channel"]
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
                    feeds["device_id"] = device_dict.get("name", None)
                    feeds["site_id"] = device_dict.get("site", {}).get("_id", None)
                    feeds["latitude"] = channel["latitude"]
                    feeds["longitude"] = channel["longitude"]
                    del feeds["field8"]
                    measurements = measurements.append(feeds, ignore_index=True)

                except Exception as ex:
                    print(ex)
                    traceback.print_exc()
                    continue

        if measurements.empty:
            return pd.DataFrame()

        measurements = remove_invalid_dates(
            dataframe=measurements, start_time=start_date_time, end_time=end_date_time
        )

        return DataValidationUtils.remove_outliers(measurements)

    @staticmethod
    def flatten_meta_data(meta_data: list) -> list:
        data = []
        for item in meta_data:
            item = dict(item)
            device_numbers = item.get("device_numbers", [])
            if device_numbers:
                item.pop("device_numbers")
                for device_number in device_numbers:
                    data.append({**item, **{"device_number": device_number}})
        return data

    @staticmethod
    def extract_low_cost_sensors_data(
        start_date_time,
        end_date_time,
        device_numbers: list = None,
        meta_data: list = None,
    ) -> pd.DataFrame:
        data = pd.DataFrame()

        if meta_data:
            for value in meta_data:
                value = dict(value)
                measurements = AirQoDataUtils.query_low_cost_sensors_data(
                    start_date_time=value.get("start_date_time", None),
                    end_date_time=value.get("end_date_time", None),
                    device_numbers=[value.get("device_number", None)],
                )
                if measurements.empty:
                    continue
                measurements["latitude"] = value.get("latitude", None)
                measurements["longitude"] = value.get("longitude", None)
                data = data.append(measurements, ignore_index=True)
        else:
            data = AirQoDataUtils.query_low_cost_sensors_data(
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                device_numbers=device_numbers,
            )

        data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm2_5"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)
        data["pm10"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

        return data

    @staticmethod
    def extract_aggregated_mobile_devices_weather_data(
        data: pd.DataFrame,
    ) -> pd.DataFrame:

        weather_data = pd.DataFrame()
        for _, station_data in data.groupby(
            by=["station_code", "start_date_time", "end_date_time"]
        ):
            raw_data = WeatherDataUtils.query_raw_data_from_tahmo(
                start_date_time=station_data.iloc[0]["start_date_time"],
                end_date_time=station_data.iloc[0]["end_date_time"],
                station_codes=[station_data.iloc[0]["station_code"]],
            )
            raw_data = WeatherDataUtils.transform_raw_data(raw_data)
            aggregated_data = WeatherDataUtils.aggregate_data(raw_data)
            aggregated_data["timestamp"] = aggregated_data["timestamp"].apply(
                pd.to_datetime
            )

            for _, row in station_data.iterrows():
                device_weather_data = aggregated_data.copy()
                device_weather_data["device_number"] = row["device_number"]
                device_weather_data["distance"] = row["distance"]
                weather_data = weather_data.append(
                    device_weather_data, ignore_index=True
                )

        devices_weather_data = pd.DataFrame()
        for _, device_weather_data in weather_data.groupby("device_number"):
            for _, time_group in device_weather_data.groupby("timestamp"):
                time_group.sort_values(ascending=True, by="distance", inplace=True)
                time_group.fillna(method="bfill", inplace=True)
                time_group.drop_duplicates(
                    keep="first", subset=["timestamp"], inplace=True
                )
                time_group["device_number"] = device_weather_data.iloc[0][
                    "device_number"
                ]
                del time_group["distance"]
                devices_weather_data = devices_weather_data.append(
                    time_group, ignore_index=True
                )

        return devices_weather_data

    @staticmethod
    def merge_aggregated_mobile_devices_data_and_weather_data(
        measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:

        airqo_data_cols = list(measurements.columns)
        weather_data_cols = list(weather_data.columns)
        intersecting_cols = list(set(airqo_data_cols) & set(weather_data_cols))
        intersecting_cols.remove("timestamp")
        intersecting_cols.remove("device_number")

        for col in intersecting_cols:
            measurements.rename(
                columns={col: f"device_reading_{col}_col"}, inplace=True
            )

        measurements["timestamp"] = measurements["timestamp"].apply(pd.to_datetime)
        measurements["device_number"] = measurements["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        weather_data["timestamp"] = weather_data["timestamp"].apply(pd.to_datetime)
        weather_data["device_number"] = weather_data["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        data = pd.merge(
            measurements,
            weather_data,
            on=["device_number", "timestamp"],
            how="left",
        )

        for col in intersecting_cols:
            data[col].fillna(data[f"device_reading_{col}_col"], inplace=True)
            del data[f"device_reading_{col}_col"]

        return data

    @staticmethod
    def restructure_airqo_mobile_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["tenant"] = "airqo"
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(
            table=big_query_api.airqo_mobile_measurements_table
        )
        return Utils.populate_missing_columns(data=data, cols=cols)

    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        thingspeak_base_url = configuration.THINGSPEAK_CHANNEL_URL

        airqo_api = AirQoApi()
        airqo_devices = airqo_api.get_devices(
            tenant="airqo", category=DeviceCategory.BAM
        )
        read_keys = airqo_api.get_read_keys(devices=airqo_devices)

        bam_data = pd.DataFrame()

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.THINGSPEAK,
        )

        for device in airqo_devices:

            device = dict(device)

            channel_id = str(device.get("device_number"))
            read_key = read_keys.get(str(channel_id), None)
            if not read_key:
                print(f"{channel_id} does not have a read key")
                continue

            for start, end in dates:

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
                    channel = data["channel"]
                    if feeds.empty:
                        print(
                            f"{channel_id} does not have data between {start} and {end}"
                        )
                        continue

                    feeds = feeds[
                        [
                            "field1",
                            "field3",
                            "field6",
                        ]
                    ]
                    feeds.rename(
                        columns={
                            "field1": "timestamp",
                            "field3": "pm2_5",
                            "field6": "status",
                        },
                        inplace=True,
                    )

                    feeds["device_number"] = channel_id
                    feeds["device_id"] = device.get("name", None)
                    feeds["latitude"] = channel["latitude"]
                    feeds["longitude"] = channel["longitude"]

                    bam_data = bam_data.append(feeds, ignore_index=True)
                except Exception as ex:
                    print(ex)
                    traceback.print_exc()

        bam_data["timestamp"] = bam_data["timestamp"].apply(pd.to_datetime)

        return DataValidationUtils.remove_outliers(bam_data)

    @staticmethod
    def aggregate_low_cost_sensors_data(data: pd.DataFrame) -> pd.DataFrame:

        aggregated_data = pd.DataFrame()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)

        for _, device_group in data.groupby("device_number"):
            site_id = device_group.iloc[0]["site_id"]
            device_id = device_group.iloc[0]["device_id"]
            device_number = device_group.iloc[0]["device_number"]

            del device_group["site_id"]
            del device_group["device_id"]
            del device_group["device_number"]

            averages = device_group.resample("1H", on="timestamp").mean()
            averages["timestamp"] = averages.index
            averages["device_id"] = device_id
            averages["site_id"] = site_id
            averages["device_number"] = device_number

            aggregated_data = aggregated_data.append(averages, ignore_index=True)

        return aggregated_data

    @staticmethod
    def process_bam_data(data: pd.DataFrame, data_type: BamDataType) -> pd.DataFrame:

        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data["status"] = data["status"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["tenant"] = "airqo"

        if data_type == BamDataType.OUTLIERS:
            data = data.loc[data["status"] != 0]
        else:
            data = data.loc[data["status"] == 0]

        return data

    @staticmethod
    def process_bam_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.bam_measurements_table)
        return Utils.populate_missing_columns(data=data, cols=cols)

    @staticmethod
    def process_raw_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["tenant"] = str(Tenant.AIRQO)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        return Utils.populate_missing_columns(data=data, cols=cols)

    @staticmethod
    def process_aggregated_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["tenant"] = str(Tenant.AIRQO)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.hourly_measurements_table)
        return Utils.populate_missing_columns(data=data, cols=cols)

    @staticmethod
    def process_data_for_api(data: pd.DataFrame, frequency: Frequency) -> list:
        restructured_data = []

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["timestamp"] = data["timestamp"].apply(date_to_str)
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant="airqo")

        for _, row in data.iterrows():
            try:
                device_number = row["device_number"]
                device_details = list(
                    filter(
                        lambda device: (device["device_number"] == device_number),
                        devices,
                    )
                )[0]

                restructured_data.append(
                    {
                        "device": device_details["name"],
                        "device_id": device_details["_id"],
                        "site_id": row["site_id"],
                        "device_number": device_number,
                        "tenant": str(Tenant.AIRQO),
                        "location": {
                            "latitude": {"value": row["latitude"]},
                            "longitude": {"value": row["longitude"]},
                        },
                        "frequency": str(frequency),
                        "time": row["timestamp"],
                        "average_pm2_5": {
                            "value": row["pm2_5"],
                            "calibratedValue": row["pm2_5_calibrated_value"],
                        },
                        "average_pm10": {
                            "value": row["pm10"],
                            "calibratedValue": row["pm10_calibrated_value"],
                        },
                        "pm2_5": {
                            "value": row["pm2_5"],
                            "calibratedValue": row["pm2_5_calibrated_value"],
                        },
                        "pm10": {
                            "value": row["pm10"],
                            "calibratedValue": row["pm10_calibrated_value"],
                        },
                        "s1_pm2_5": {"value": row["s1_pm2_5"]},
                        "s1_pm10": {"value": row["s1_pm10"]},
                        "s2_pm2_5": {"value": row["s2_pm2_5"]},
                        "s2_pm10": {"value": row["s2_pm10"]},
                        "battery": {"value": row["battery"]},
                        "altitude": {"value": row["altitude"]},
                        "speed": {"value": row["wind_speed"]},
                        "satellites": {"value": row["satellites"]},
                        "hdop": {"value": row["hdop"]},
                        "externalTemperature": {"value": row["temperature"]},
                        "externalHumidity": {"value": row["humidity"]},
                    }
                )

            except Exception as ex:
                traceback.print_exc()
                print(ex)

        return restructured_data

    @staticmethod
    def process_data_for_message_broker(
        data: pd.DataFrame, frequency: Frequency
    ) -> list:
        data["frequency"] = frequency
        return data.to_dict("records")

    @staticmethod
    def merge_aggregated_weather_data(
        airqo_data: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:

        if weather_data.empty:
            return airqo_data

        weather_data["timestamp"] = weather_data["timestamp"].apply(pd.to_datetime)
        airqo_data["timestamp"] = airqo_data["timestamp"].apply(pd.to_datetime)

        airqo_api = AirQoApi()
        sites = []

        for site in airqo_api.get_sites(tenant="airqo"):
            for station in site.get("weather_stations", []):
                sites.append(
                    {
                        "site_id": site.get("_id"),
                        "station_code": station.get("code", None),
                        "distance": station.get("distance", None),
                    }
                )

        sites = pd.DataFrame(sites)

        sites_weather_data = pd.DataFrame()
        weather_data_cols = list(weather_data.columns)

        for _, site_data in sites.groupby("site_id"):
            site_weather_data = weather_data[
                weather_data["station_code"].isin(site_data["station_code"].to_list())
            ]
            if site_weather_data.empty:
                continue

            site_weather_data = pd.merge(
                left=site_weather_data, right=site_data, on="station_code", how="left"
            )

            for _, time_group in site_weather_data.groupby("timestamp"):
                time_group.sort_values(ascending=True, by="distance", inplace=True)
                time_group.fillna(method="bfill", inplace=True)
                time_group.drop_duplicates(
                    keep="first", subset=["timestamp"], inplace=True
                )
                time_group = time_group[weather_data_cols]
                time_group["site_id"] = site_data.iloc[0]["site_id"]
                sites_weather_data = sites_weather_data.append(
                    time_group, ignore_index=True
                )

        airqo_data_cols = list(airqo_data.columns)
        weather_data_cols = list(sites_weather_data.columns)
        intersecting_cols = list(set(airqo_data_cols) & set(weather_data_cols))
        intersecting_cols.remove("timestamp")
        intersecting_cols.remove("site_id")

        for col in intersecting_cols:
            airqo_data.rename(columns={col: f"device_reading_{col}_col"}, inplace=True)

        measurements = pd.merge(
            left=airqo_data,
            right=sites_weather_data,
            how="left",
            on=["site_id", "timestamp"],
        )

        for col in intersecting_cols:
            measurements[col].fillna(
                measurements[f"device_reading_{col}_col"], inplace=True
            )
            del measurements[f"device_reading_{col}_col"]

        return measurements

    @staticmethod
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
                    [
                        [
                            s1_pm2_5,
                            s2_pm2_5,
                            s1_pm10,
                            s2_pm10,
                            temperature,
                            humidity,
                            hour,
                        ]
                    ],
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

    @staticmethod
    def extract_devices_deployment_logs() -> pd.DataFrame:
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant="airqo")
        devices_history = pd.DataFrame()
        for device in devices:

            try:
                maintenance_logs = airqo_api.get_maintenance_logs(
                    tenant="airqo",
                    device=dict(device).get("name", None),
                    activity_type="deployment",
                )

                if not maintenance_logs or len(maintenance_logs) <= 1:
                    continue

                log_df = pd.DataFrame(maintenance_logs)
                log_df = log_df.dropna(subset=["date"])

                log_df["site_id"] = (
                    log_df["site_id"].fillna(method="bfill").fillna(method="ffill")
                )
                log_df = log_df.dropna(subset=["site_id"])

                log_df["start_date_time"] = pd.to_datetime(log_df["date"])
                log_df = log_df.sort_values(by="start_date_time")
                log_df["end_date_time"] = log_df["start_date_time"].shift(-1)
                log_df["end_date_time"] = log_df["end_date_time"].fillna(
                    datetime.utcnow()
                )

                log_df["start_date_time"] = log_df["start_date_time"].apply(
                    lambda x: date_to_str(x)
                )
                log_df["end_date_time"] = log_df["end_date_time"].apply(
                    lambda x: date_to_str(x)
                )

                if len(set(log_df["site_id"].tolist())) == 1:
                    continue

                log_df["device_number"] = device.get("device_number", None)

                devices_history = devices_history.append(
                    log_df[
                        [
                            "start_date_time",
                            "end_date_time",
                            "site_id",
                            "device_number",
                        ]
                    ],
                    ignore_index=True,
                )

            except Exception as ex:
                print(ex)
                traceback.print_exc()

        return devices_history.dropna()

    @staticmethod
    def map_site_ids_to_historical_data(
        data: pd.DataFrame, deployment_logs: pd.DataFrame
    ) -> pd.DataFrame:
        if deployment_logs.empty or data.empty:
            return data

        data = data.copy()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        deployment_logs["start_date_time"] = deployment_logs["start_date_time"].apply(
            pd.to_datetime
        )
        deployment_logs["end_date_time"] = deployment_logs["end_date_time"].apply(
            pd.to_datetime
        )

        for _, device_log in deployment_logs.iterrows():

            device_data = data.loc[
                (data["timestamp"] >= device_log["start_date_time"])
                & (data["timestamp"] <= device_log["end_date_time"])
                & (data["device_number"] == device_log["device_number"])
            ]
            if device_data.empty:
                continue

            temp_device_data = device_data.copy()
            for col in list(temp_device_data.columns):
                temp_device_data.rename(columns={col: f"{col}_temp"}, inplace=True)

            non_device_data = pd.merge(
                left=data,
                right=temp_device_data,
                left_on=["device_number", "timestamp"],
                right_on=["device_number_temp", "timestamp_temp"],
                how="outer",
                indicator=True,
            )
            non_device_data = non_device_data.loc[
                non_device_data["_merge"] == "left_only"
            ].drop("_merge", axis=1)

            non_device_data = non_device_data[list(device_data.columns)]

            device_data["site_id"] = device_log["site_id"]
            data = non_device_data.append(device_data, ignore_index=True)

        return data

    @staticmethod
    def process_airnow_data_for_api(data: pd.DataFrame) -> list:
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
