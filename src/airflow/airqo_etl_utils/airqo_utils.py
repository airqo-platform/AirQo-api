import pickle
import traceback
from datetime import datetime

import numpy as np
import pandas as pd
import pymongo as pm

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import download_file_from_gcs
from .config import configuration
from .constants import DeviceCategory, Tenant, Frequency, DataSource, DataType
from .data_validator import DataValidationUtils
from .date import date_to_str
from .thingspeak_api import ThingspeakApi
from .utils import Utils
from .weather_data_utils import WeatherDataUtils


class AirQoDataUtils:
    @staticmethod
    def extract_uncalibrated_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        hourly_uncalibrated_data = bigquery_api.query_data(
            table=bigquery_api.hourly_measurements_table,
            null_cols=["pm2_5_calibrated_value"],
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.AIRQO,
        )

        return DataValidationUtils.remove_outliers(hourly_uncalibrated_data)

    @staticmethod
    def extract_data_from_bigquery(
        start_date_time, end_date_time, frequency: Frequency
    ) -> pd.DataFrame:
        bigquery_api = BigQueryApi()
        if frequency == Frequency.RAW:
            table = bigquery_api.raw_measurements_table
        elif frequency == Frequency.HOURLY:
            table = bigquery_api.hourly_measurements_table
        else:
            table = ""
        raw_data = bigquery_api.query_data(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=Tenant.AIRQO,
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        cols = data.columns.to_list()
        cols.remove("timestamp")
        cols.remove("device_number")
        data.dropna(subset=cols, how="all", inplace=True)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["duplicated"] = data.duplicated(
            keep=False, subset=["device_number", "timestamp"]
        )

        if True not in data["duplicated"].values:
            return data

        duplicated_data = data.loc[data["duplicated"]]
        not_duplicated_data = data.loc[~data["duplicated"]]

        for _, by_device_number in duplicated_data.groupby(by="device_number"):
            for _, by_timestamp in by_device_number.groupby(by="timestamp"):
                by_timestamp = by_timestamp.copy()
                by_timestamp.fillna(inplace=True, method="ffill")
                by_timestamp.fillna(inplace=True, method="bfill")
                by_timestamp.drop_duplicates(
                    subset=["device_number", "timestamp"], inplace=True, keep="first"
                )
                not_duplicated_data = pd.concat(
                    [not_duplicated_data, by_timestamp], ignore_index=True
                )

        return not_duplicated_data

    @staticmethod
    def extract_aggregated_raw_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=bigquery_api.raw_measurements_table,
            tenant=Tenant.AIRQO,
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
    def flatten_field_8(device_category: DeviceCategory, field_8: str = None):
        values = field_8.split(",") if field_8 else ""
        series = pd.Series(dtype=float)
        mappings = (
            configuration.AIRQO_BAM_CONFIG
            if device_category == DeviceCategory.BAM
            else configuration.AIRQO_LOW_COST_CONFIG
        )

        for key, value in mappings.items():
            try:
                series[value] = values[key]
            except Exception as ex:
                print(ex)
                series[value] = None

        return series

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
    def extract_mobile_low_cost_sensors_data(
        meta_data: list,
    ) -> pd.DataFrame:
        data = pd.DataFrame()

        for value in meta_data:
            value = dict(value)
            measurements = AirQoDataUtils.extract_devices_data(
                start_date_time=value.get("start_date_time"),
                end_date_time=value.get("end_date_time"),
                device_numbers=[value.get("device_number")],
                device_category=DeviceCategory.LOW_COST,
            )
            if measurements.empty:
                continue
            measurements["latitude"] = value.get("latitude", None)
            measurements["longitude"] = value.get("longitude", None)
            data = data.append(measurements, ignore_index=True)

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
            if raw_data.empty:
                continue

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
    def extract_devices_data(
        start_date_time: str,
        end_date_time: str,
        device_category: DeviceCategory,
        device_numbers: list = None,
        remove_outliers: bool = True,
    ) -> pd.DataFrame:
        """
        Returns a dataframe of AiQo sensors measurements.

        :param start_date_time: start date time
        :param end_date_time: end date time
        :param device_category: BAM or low cost sensors
        :param device_numbers: list of device numbers whose data you want to extract. Defaults to all AirQo devices
        :param remove_outliers: Removes outliers if set to true.
        :return: a dataframe of measurements recorded between start date time and end date time
        """

        airqo_api = AirQoApi()
        thingspeak_api = ThingspeakApi()
        devices = airqo_api.get_devices(
            tenant=Tenant.AIRQO, device_category=device_category
        )

        if device_numbers:
            devices = list(
                filter(lambda x: int(x["device_number"]) in device_numbers, devices)
            )

        if device_category == DeviceCategory.BAM:
            other_fields_cols = []
            field_8_cols = [x for x in configuration.AIRQO_BAM_CONFIG.values()]
        else:
            field_8_cols = [x for x in configuration.AIRQO_LOW_COST_CONFIG.values()]
            other_fields_cols = [
                "s1_pm2_5",
                "s1_pm10",
                "s2_pm2_5",
                "s2_pm10",
                "battery",
            ]

        data_columns = [
            "device_number",
            "device_id",
            "site_id",
            "latitude",
            "longitude",
            "timestamp",
        ]
        data_columns.extend(field_8_cols)
        data_columns.extend(other_fields_cols)
        data_columns = list(set(data_columns))

        read_keys = airqo_api.get_thingspeak_read_keys(devices=devices)

        devices_data = pd.DataFrame()
        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.THINGSPEAK,
        )

        for device in devices:
            device_number = device.get("device_number", None)
            read_key = read_keys.get(device_number, None)

            if read_key is None or device_number is None:
                print(f"{device_number} does not have a read key")
                continue

            for start, end in dates:
                data = thingspeak_api.query_data(
                    device_number=device_number,
                    start_date_time=start,
                    end_date_time=end,
                    read_key=read_key,
                )

                if data.empty:
                    print(
                        f"{device_number} does not have data between {start} and {end}"
                    )
                    continue

                meta_data = data.attrs.pop("meta_data", {})

                if "field8" not in data.columns.to_list():
                    data = DataValidationUtils.fill_missing_columns(
                        data=data, cols=data_columns
                    )
                else:
                    data[field_8_cols] = data["field8"].apply(
                        lambda x: AirQoDataUtils.flatten_field_8(
                            device_category=device_category, field_8=x
                        )
                    )

                data["device_number"] = device_number
                data["device_id"] = device.get("device_id")
                data["site_id"] = device.get("site_id")

                if device_category == DeviceCategory.BAM:
                    data["latitude"] = meta_data.get("latitude", None)
                    data["longitude"] = meta_data.get("longitude", None)

                if device_category == DeviceCategory.LOW_COST:
                    data.rename(
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

                devices_data = pd.concat(
                    [devices_data, data[data_columns]], ignore_index=True
                )

        if remove_outliers:
            if "vapor_pressure" in devices_data.columns.to_list():
                devices_data.loc[:, "vapor_pressure"] = devices_data[
                    "vapor_pressure"
                ].apply(DataValidationUtils.convert_pressure_values)
            devices_data = DataValidationUtils.remove_outliers(devices_data)

        return devices_data

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

            aggregated_data = pd.concat([aggregated_data, averages], ignore_index=True)

        return aggregated_data

    @staticmethod
    def clean_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        data = DataValidationUtils.remove_outliers(data)
        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data.loc[:, "tenant"] = str(Tenant.AIRQO)
        data = data.copy().loc[data["status"] == 0]
        data.rename(columns=configuration.AIRQO_BAM_MAPPING, inplace=True)

        big_query_api = BigQueryApi()
        required_cols = big_query_api.get_columns(
            table=big_query_api.bam_measurements_table
        )

        data = Utils.populate_missing_columns(data=data, cols=required_cols)
        data = data[required_cols]

        return data

    @staticmethod
    def clean_low_cost_sensor_data(data: pd.DataFrame) -> pd.DataFrame:
        data = DataValidationUtils.remove_outliers(data)
        data.loc[:, "timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm2_5"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)
        data["pm10"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

        return data

    @staticmethod
    def format_data_for_bigquery(
        data: pd.DataFrame, data_type: DataType
    ) -> pd.DataFrame:
        data.loc[:, "timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data.loc[:, "tenant"] = str(Tenant.AIRQO)
        big_query_api = BigQueryApi()
        if data_type == DataType.UNCLEAN_BAM_DATA:
            cols = big_query_api.get_columns(
                table=big_query_api.raw_bam_measurements_table
            )
        elif data_type == DataType.CLEAN_BAM_DATA:
            cols = big_query_api.get_columns(table=big_query_api.bam_measurements_table)
        elif data_type == DataType.UNCLEAN_LOW_COST_DATA:
            cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        elif data_type == DataType.CLEAN_LOW_COST_DATA:
            cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        elif data_type == DataType.AGGREGATED_LOW_COST_DATA:
            cols = big_query_api.get_columns(
                table=big_query_api.hourly_measurements_table
            )
        else:
            raise Exception("invalid data type")
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
    def process_latest_data(
        data: pd.DataFrame, device_category: DeviceCategory
    ) -> pd.DataFrame:
        cols = data.columns.to_list()
        if device_category == DeviceCategory.BAM:
            if "pm2_5" not in cols:
                data.loc[:, "pm2_5"] = None

            if "pm10" not in cols:
                data.loc[:, "pm10"] = None

            if "no2" not in cols:
                data.loc[:, "no2"] = None

            data["s1_pm2_5"] = data["pm2_5"]
            data["pm2_5_raw_value"] = data["pm2_5"]
            data["pm2_5_calibrated_value"] = data["pm2_5"]

            data["s1_pm10"] = data["pm10"]
            data["pm10_raw_value"] = data["pm10"]
            data["pm10_calibrated_value"] = data["pm10"]

            data["no2_raw_value"] = data["no2"]
            data["no2_calibrated_value"] = data["no2"]

        else:
            data["pm2_5"] = data["pm2_5_calibrated_value"]
            data["pm10"] = data["pm10_calibrated_value"]

            data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
            data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

            data["pm2_5"] = data["pm2_5"].fillna(data["pm2_5_raw_value"])
            data["pm10"] = data["pm10"].fillna(data["pm10_raw_value"])

        data.loc[:, "tenant"] = str(Tenant.AIRQO)
        data.loc[:, "device_category"] = str(device_category)

        return data

    @staticmethod
    def process_data_for_api(data: pd.DataFrame, frequency: Frequency) -> list:
        """
        Formats device measurements into a format required by the events endpoint.

        :param data: device measurements
        :param frequency: frequency of the measurements.
        :return: a list of measurements
        """

        restructured_data = []

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["timestamp"] = data["timestamp"].apply(date_to_str)
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant=Tenant.AIRQO)

        for _, row in data.iterrows():
            try:
                device_number = row["device_number"]
                device_details = list(
                    filter(
                        lambda device: (device["device_number"] == device_number),
                        devices,
                    )
                )[0]
                row_data = {
                    "device": device_details["name"],
                    "device_id": device_details["_id"],
                    "site_id": row["site_id"],
                    "device_number": device_number,
                    "tenant": str(Tenant.AIRQO),
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

                if row_data["site_id"] is None or row_data["site_id"] is np.nan:
                    row_data.pop("site_id")

                restructured_data.append(row_data)

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

        weather_data.loc[:, "timestamp"] = weather_data["timestamp"].apply(
            pd.to_datetime
        )
        airqo_data.loc[:, "timestamp"] = airqo_data["timestamp"].apply(pd.to_datetime)

        airqo_api = AirQoApi()
        sites = []

        for site in airqo_api.get_sites(tenant=Tenant.AIRQO):
            sites.extend(
                [
                    {
                        "site_id": site.get("_id"),
                        "station_code": station.get("code", None),
                        "distance": station.get("distance", None),
                    }
                    for station in site.get("weather_stations", [])
                ]
            )

        sites = pd.DataFrame(sites)

        sites_weather_data = pd.DataFrame()
        weather_data_cols = list(weather_data.columns)

        for _, by_site in sites.groupby("site_id"):
            site_weather_data = weather_data[
                weather_data["station_code"].isin(by_site["station_code"].to_list())
            ]
            if site_weather_data.empty:
                continue

            site_weather_data = pd.merge(site_weather_data, by_site, on="station_code")

            for _, by_timestamp in site_weather_data.groupby("timestamp"):
                by_timestamp.sort_values(ascending=True, by="distance", inplace=True)
                by_timestamp.fillna(method="bfill", inplace=True)
                by_timestamp.drop_duplicates(
                    keep="first", subset=["timestamp"], inplace=True
                )
                by_timestamp = by_timestamp[weather_data_cols]

                by_timestamp.loc[:, "site_id"] = by_site.iloc[0]["site_id"]
                sites_weather_data = pd.concat(
                    [sites_weather_data, by_timestamp], ignore_index=True
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
        devices = airqo_api.get_devices(tenant=Tenant.AIRQO)
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
    def flag_faults(df):
        if not isinstance(df, pd.DataFrame):
            raise ValueError("Input must be a dataframe")

        required_columns = ["device_name", "s1_pm2_5", "s2_pm2_5"]
        if not set(required_columns).issubset(set(df.columns.to_list())):
            raise ValueError(
                f"Input must have the following columns: {required_columns}"
            )

        result = pd.DataFrame(
            columns=["device_name", "correlation_fault", "missing_data_fault"]
        )
        for device in df["device_name"].unique():
            device_df = df[df["device_name"] == device]
            corr = device_df["s1_pm2_5"].corr(device_df["s2_pm2_5"])
            correlation_fault = 1 if corr < 0.9 else 0
            missing_data_fault = 0
            for col in ["s1_pm2_5", "s2_pm2_5"]:
                null_series = device_df[col].isna()
                if (null_series.rolling(window=6).sum() >= 6).any():
                    missing_data_fault = 1
                    break

            temp = pd.DataFrame(
                {
                    "device_name": [device],
                    "correlation_fault": [correlation_fault],
                    "missing_data_fault": [missing_data_fault],
                }
            )
            result = pd.concat([result, temp], ignore_index=True)
        result = result[
            (result["correlation_fault"] == 1) | (result["missing_data_fault"] == 1)
        ]
        result["created_at"] = datetime.now().isoformat(timespec="seconds")
        return result

    @staticmethod
    def save_faulty_devices(data: pd.DataFrame):
        """Save or update faulty devices to MongoDB"""
        with pm.MongoClient(configuration.MONGO_URI) as client:
            db = client[configuration.MONGO_DATABASE_NAME]
            records = data.to_dict("records")

            bulk_ops = [
                pm.UpdateOne(
                    {"device_name": record["device_name"]},
                    {"$set": record},
                    upsert=True,
                )
                for record in records
            ]

            try:
                db.faulty_devices_1.bulk_write(bulk_ops)
            except Exception as e:
                print(f"Error saving faulty devices to MongoDB: {e}")

            print("Faulty devices saved/updated to MongoDB")
