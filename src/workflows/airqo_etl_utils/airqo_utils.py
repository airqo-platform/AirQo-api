from datetime import datetime, timezone
import ast
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Union, Generator

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .config import configuration as Config
from .constants import (
    DeviceCategory,
    DeviceNetwork,
    Frequency,
    DataType,
    CityModels,
    CountryModels,
)
from .data_validator import DataValidationUtils
from .date import date_to_str, DateUtils
from .ml_utils import GCSUtils
from .utils import Utils
from .datautils import DataUtils
from .weather_data_utils import WeatherDataUtils

import logging

logger = logging.getLogger(__name__)


class AirQoDataUtils:
    @staticmethod
    def extract_uncalibrated_data(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        hourly_uncalibrated_data = bigquery_api.query_data(
            table=bigquery_api.hourly_measurements_table,
            null_cols=["pm2_5_calibrated_value"],
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.AIRQO,
        )

        return DataValidationUtils.remove_outliers(hourly_uncalibrated_data)

    @staticmethod
    def map_and_extract_data(
        data_mapping: Dict[str, Union[str, Dict[str, List[str]]]],
        data: Union[List[Any], Dict[str, Any]],
    ) -> pd.DataFrame:
        """
        Map and extract specified fields from input data based on a provided mapping and extraction fields.

        Args:
            data_mapping (Dict[str, str]): A dictionary mapping source keys to target keys.
                Example: {"pm25": "pm2_5", "pm10": "pm10", "tp": "temperature"}
            data (Dict[str, Any]|): Input data containing raw key-value pairs to map and extract.
                Example:
                {
                    "pm25": {"conc": 21, "aqius": 73, "aqicn": 30},
                    "pm10": {"conc": 37, "aqius": 34, "aqicn": 37},
                    "pr": 100836,
                    "hm": 28,
                    "tp": 39.7,
                    "ts": "2024-11-24T13:14:40.000Z"
                }

        Returns:
            pd.Series: A pandas Series containing the mapped and extracted data.
        """

        def process_single_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
            """
            Process a single dictionary entry and map its data based on the mapping.

            Args:
                entry (Dict[str, Any]): A single data entry.

            Returns:
                Dict[str, Any]: A dictionary with the mapped data.
            """
            row_data = {}

            # Process 'field8' mapping
            if "field8" in entry and isinstance(entry["field8"], str):
                field8_mapping = data_mapping.get("field8")
                try:
                    field8_values: List[str] = entry.pop("field8").split(",")
                    for index, target_key in field8_mapping.items():
                        if target_key not in row_data:
                            row_data[target_key] = (
                                field8_values[index]
                                if index < len(field8_values)
                                else None
                            )
                except (ValueError, TypeError, AttributeError) as e:
                    logger.warning(f"Error processing field8: {e}")

            # Process the remaining fields
            if isinstance(entry, dict):
                for key, value_data in entry.items():
                    target_key = data_mapping.get(key, None)
                    target_value = None
                    if isinstance(target_key, dict):
                        target_value = target_key.get("value")
                        target_key = target_key.get("key")

                    if target_key and target_key not in row_data:
                        if isinstance(value_data, dict):
                            extracted_value = AirQoDataUtils._extract_nested_value(
                                value_data, target_value
                            )
                        else:
                            extracted_value = value_data
                        row_data[target_key] = extracted_value
            return row_data

        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            raise ValueError(
                f"Invalid data format. Expected a dictionary or a list of dictionaries got {type(data)}"
            )

        processed_rows = [process_single_entry(entry) for entry in data]

        return pd.DataFrame(processed_rows)

    def _extract_nested_value(data: Dict[str, Any], key: str) -> Any:
        """
        Helper function to extract a nested value from a dictionary.

        Args:
            data (Dict[str, Any]): The input dictionary containing nested data.
            key (str): The key to extract the value for.

        Returns:
            Any: The extracted value or None if not found.
        """
        return data.get(key)

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
        meta_data: list, resolution: Frequency
    ) -> pd.DataFrame:
        data = pd.DataFrame()

        for value in meta_data:
            value = dict(value)
            measurements = DataUtils.extract_devices_data(
                start_date_time=value.get("start_date_time"),
                end_date_time=value.get("end_date_time"),
                device_numbers=[value.get("device_number")],
                resolution=resolution,
                device_category=DeviceCategory.LOWCOST,
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

            raw_data = DataUtils.transform_weather_data(raw_data)
            aggregated_data = DataUtils.aggregate_weather_data(raw_data)
            aggregated_data["timestamp"] = pd.to_datetime(aggregated_data["timestamp"])

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
        airqo_data_cols = measurements.columns.to_list()
        weather_data_cols = weather_data.columns.to_list()
        intersecting_cols = list(set(airqo_data_cols) & set(weather_data_cols))
        intersecting_cols.remove("timestamp")
        intersecting_cols.remove("device_number")

        for col in intersecting_cols:
            measurements.rename(
                columns={col: f"device_reading_{col}_col"}, inplace=True
            )

        measurements["timestamp"] = pd.to_datetime(measurements["timestamp"])
        measurements["device_number"] = measurements["device_number"].apply(
            lambda x: pd.to_numeric(x, errors="coerce", downcast="integer")
        )

        weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"])
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
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["network"] = "airqo"
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(
            table=big_query_api.airqo_mobile_measurements_table
        )
        return Utils.populate_missing_columns(data=data, columns=cols)

    @staticmethod
    def aggregate_low_cost_sensors_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Resamples and averages out the numeric type fields on an hourly basis.

        Args:
            data(pandas.DataFrame): A pandas DataFrame object containing cleaned/converted (numeric) data.

        Returns:
            A pandas DataFrame object containing hourly averages of data.
        """

        data["timestamp"] = pd.to_datetime(data["timestamp"])

        group_metadata = data[
            ["device_id", "site_id", "device_number", "network"]
        ].drop_duplicates("device_id")
        group_metadata.set_index("device_id", inplace=True)
        numeric_columns = data.select_dtypes(include=["number"]).columns
        numeric_columns = numeric_columns.difference(["device_number"])
        data_for_aggregation = data[["timestamp", "device_id"] + list(numeric_columns)]
        try:
            aggregated = (
                data_for_aggregation.groupby("device_id")
                .apply(lambda group: group.resample("1H", on="timestamp").mean())
                .reset_index()
            )
            aggregated = aggregated.merge(group_metadata, on="device_id", how="left")
        except Exception as e:
            logger.exception(f"An error occured: No data passed - {e}")
            aggregated = pd.DataFrame(columns=data.columns)
        return aggregated

    @staticmethod
    def clean_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Cleans and transforms BAM data for BigQuery insertion.

        This function processes the input DataFrame by removing outliers, dropping duplicate entries based on timestamp and device number, and renaming columns according to a
        specified mapping. It also adds a network identifier and ensures that all required columns for the BigQuery BAM hourly measurements table are present.

        Args:
            data(pd.DataFrame): The input DataFrame containing BAM data with columns such as 'timestamp' and 'device_number'.

        Returns:
            pd.DataFrame: A cleaned DataFrame containing only the required columns, with outliers removed, duplicates dropped, and column names mapped according to the defined configuration.
        """
        # TODO Merge bam data cleanup functionality
        data = DataValidationUtils.remove_outliers(data)
        data.drop_duplicates(
            subset=["timestamp", "device_number"], keep="first", inplace=True
        )

        data["network"] = DeviceNetwork.AIRQO.str
        data.rename(columns=Config.AIRQO_BAM_MAPPING, inplace=True)

        big_query_api = BigQueryApi()
        required_cols = big_query_api.get_columns(
            table=big_query_api.bam_hourly_measurements_table
        )

        data = Utils.populate_missing_columns(data=data, columns=required_cols)
        data = data[required_cols]

        return data

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

        data.loc[:, "device_category"] = str(device_category)

        return data

    @staticmethod
    def merge_aggregated_weather_data(
        airqo_data: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Merges airqo pm2.5 sensor data with weather data from the weather stations selected from the sites data.

        args:
            airqo_data(pandas.DataFrame):
            weather_data(pandas.DataFrame):
        """
        if weather_data.empty:
            return airqo_data

        airqo_data["timestamp"] = pd.to_datetime(airqo_data["timestamp"])
        weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"])

        sites = DataUtils.get_sites(DeviceNetwork.AIRQO)
        sites_info: List[Dict[str, Any]] = []

        sites_info = [
            {
                "site_id": site.get("_id"),
                "station_code": station.get("code", None),
                "distance": station.get("distance", None),
            }
            for _, site in sites.iterrows()
            for station in ast.literal_eval(site.get("weather_stations", []))
        ]
        sites_df = pd.DataFrame(sites_info)

        sites_weather_data = pd.DataFrame()
        weather_data_cols = weather_data.columns.to_list()

        for _, by_site in sites_df.groupby("site_id"):
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

        airqo_data_cols = airqo_data.columns.to_list()
        weather_data_cols = sites_weather_data.columns.to_list()
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

        numeric_columns = measurements.select_dtypes(include=["number"]).columns
        numeric_columns = numeric_columns.difference(["device_number"])
        numeric_counts = measurements[numeric_columns].notna().sum(axis=1)
        # Raws with more than 1 numeric values
        measurements = measurements[numeric_counts > 1]
        return measurements

    @staticmethod
    def extract_devices_deployment_logs() -> pd.DataFrame:
        airqo_api = AirQoApi()
        devices, _ = DataUtils.get_devices(device_network=DeviceNetwork.AIRQO)
        devices_history = pd.DataFrame()
        for _, device in devices.iterrows():
            try:
                maintenance_logs = airqo_api.get_maintenance_logs(
                    network=device.get("network", "airqo"),
                    device=device.get("name", None),
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
                    datetime.now(timezone.utc)
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
                logger.exception(f"An error occurred {ex}")

        return devices_history.dropna()

    @staticmethod
    def map_site_ids_to_historical_data(
        data: pd.DataFrame, deployment_logs: pd.DataFrame
    ) -> pd.DataFrame:
        if deployment_logs.empty or data.empty:
            return data

        data = data.copy()
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        deployment_logs["start_date_time"] = pd.to_datetime(
            deployment_logs["start_date_time"]
        )
        deployment_logs["end_date_time"] = pd.to_datetime(
            deployment_logs["end_date_time"]
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
            for col in temp_device_data.columns.to_list():
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

            non_device_data = non_device_data[device_data.columns.to_list()]

            device_data["site_id"] = device_log["site_id"]
            data = non_device_data.append(device_data, ignore_index=True)

        return data

    @staticmethod
    def calibrate_data(data: pd.DataFrame, groupby: str) -> pd.DataFrame:
        """
        Merges calibrated data back into the original dataset and computes raw PM values after calibration.

        Args:
            data (pd.DataFrame): The raw sensor data.
            groupby (str): The column to group by for model selection.

        Returns:
            pd.DataFrame: The original dataset with calibrated PM2.5 and PM10 values.
        """

        data["timestamp"] = pd.to_datetime(data["timestamp"])

        to_calibrate = data["network"] == "airqo"

        calibrated_data = AirQoDataUtils._airqo_calibrate(
            data.loc[to_calibrate], groupby
        )

        data.loc[
            to_calibrate, ["pm2_5_calibrated_value", "pm10_calibrated_value"]
        ] = calibrated_data

        data["pm2_5_raw_value"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        data["pm10_raw_value"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1)

        data = data.assign(
            pm2_5_calibrated_value=data.get("pm2_5_calibrated_value", np.nan),
            pm10_calibrated_value=data.get("pm10_calibrated_value", np.nan),
        )

        data.loc[to_calibrate, "pm2_5"] = data.loc[
            to_calibrate, "pm2_5_calibrated_value"
        ].fillna(data.loc[to_calibrate, "pm2_5_raw_value"])
        data.loc[to_calibrate, "pm10"] = data.loc[
            to_calibrate, "pm10_calibrated_value"
        ].fillna(data.loc[to_calibrate, "pm10_raw_value"])

        return data.drop(
            columns=[
                "avg_pm2_5",
                "avg_pm10",
                "error_pm2_5",
                "error_pm10",
                "pm2_5_pm10",
                "pm2_5_pm10_mod",
                "hour",
            ],
            errors="ignore",
        )

    def _airqo_calibrate(data: pd.DataFrame, groupby: str) -> pd.DataFrame:
        """
        Calibrates air quality sensor data by applying machine learning models to adjust sensor readings.

        The function:
        1. Converts timestamps to datetime format.
        2. Merges site metadata to include city information.
        3. Drops rows with missing device ID or timestamp.
        4. Fills missing sensor readings with 0 (temporary placeholder).
        5. Computes additional calibration input variables.
        6. Loads trained calibration models and applies them based on city.
        7. Updates the dataset with calibrated PM2.5 and PM10 values.
        8. Ensures missing calibrated values fall back to raw sensor values.

        Args:
            data (pd.DataFrame): The raw air quality sensor data.

        Returns:
            pd.DataFrame: A DataFrame with calibrated PM2.5 and PM10 values.
        """
        bucket = Config.FORECAST_MODELS_BUCKET
        project_id = Config.GOOGLE_CLOUD_PROJECT_ID
        calibrate_by: Dict[str, Union[CityModels, CountryModels]] = {
            "city": CityModels,
            "country": CountryModels,
        }

        models: Union[CityModels, CountryModels] = calibrate_by.get(
            groupby, CountryModels
        )

        sites = DataUtils.get_sites()
        if sites.empty:
            raise RuntimeError("Failed to fetch sites data from the cache/API")

        sites = sites[["site_id", groupby]]
        data = pd.merge(data, sites, on="site_id", how="left")

        input_variables = [
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

        # additional input columns for calibration
        data["avg_pm2_5"] = data[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1).round(2)
        data["avg_pm10"] = data[["s1_pm10", "s2_pm10"]].mean(axis=1).round(2)
        data["error_pm2_5"] = np.abs(data["s1_pm2_5"] - data["s2_pm2_5"])
        data["error_pm10"] = np.abs(data["s1_pm10"] - data["s2_pm10"])
        data["pm2_5_pm10"] = data["avg_pm2_5"] - data["avg_pm10"]
        data["pm2_5_pm10_mod"] = data["avg_pm2_5"] / data["avg_pm10"]
        data["hour"] = data["timestamp"].dt.hour

        data[input_variables] = data[input_variables].replace([np.inf, -np.inf], 0)

        default_rf_model = GCSUtils.get_trained_model_from_gcs(
            project_name=project_id,
            bucket_name=bucket,
            source_blob_name=Utils.get_calibration_model_path(models.DEFAULT, "pm2_5"),
        )
        default_lasso_model = GCSUtils.get_trained_model_from_gcs(
            project_name=project_id,
            bucket_name=bucket,
            source_blob_name=Utils.get_calibration_model_path(models.DEFAULT, "pm10"),
        )
        available_models = [c.value for c in models]

        calibrated_data = pd.DataFrame(index=data.index)

        for groupedby, group in data.groupby(groupby, dropna=False):
            current_rf_model = default_rf_model
            current_lasso_model = default_lasso_model
            if (
                groupedby
                and not pd.isna(groupedby)
                and groupedby.lower() in available_models
            ):
                try:
                    current_rf_model = GCSUtils.get_trained_model_from_gcs(
                        project_name=project_id,
                        bucket_name=bucket,
                        source_blob_name=Utils.get_calibration_model_path(
                            groupedby.lower(), "pm2_5"
                        ),
                    )
                    current_lasso_model = GCSUtils.get_trained_model_from_gcs(
                        project_name=project_id,
                        bucket_name=bucket,
                        source_blob_name=Utils.get_calibration_model_path(
                            groupedby.lower(), "pm10"
                        ),
                    )
                except Exception as e:
                    logger.exception(
                        f"Error getting custom model. Will default to generic one: {e}"
                    )
                    current_rf_model = default_rf_model
                    current_lasso_model = default_lasso_model

            calibrated_data.loc[
                group.index, "pm2_5_calibrated_value"
            ] = current_rf_model.predict(group[input_variables])
            calibrated_data.loc[
                group.index, "pm10_calibrated_value"
            ] = current_lasso_model.predict(group[input_variables])

        return calibrated_data

    @staticmethod
    def extract_devices_with_uncalibrated_data(
        start_date, table: str = None, network: DeviceNetwork = DeviceNetwork.AIRQO
    ) -> pd.DataFrame:
        """
        Extracts devices with uncalibrated data for a given start date from BigQuery.

        Args:
            start_date (str or datetime): The date for which to check missing uncalibrated data.
            table (str, optional): The name of the BigQuery table. Defaults to None, in which case the appropriate table is determined dynamically.
            network (DeviceNetwork, optional): The device network to filter by. Defaults to DeviceNetwork.AIRQO.

        Returns:
            pd.DataFrame: A DataFrame containing the devices with missing uncalibrated data.

        Raises:
            google.api_core.exceptions.GoogleAPIError: If the query execution fails.
        """
        bigquery_api = BigQueryApi()
        if not table:
            source = Config.DataSource.get(DataType.AVERAGED)
            table = source.get(DeviceCategory.GENERAL).get(Frequency.HOURLY)
        query = bigquery_api.generate_missing_data_query(start_date, table, network)
        return bigquery_api.execute_missing_data_query(query)

    @staticmethod
    def extract_aggregate_calibrate_raw_data(
        devices: pd.DataFrame,
    ) -> Generator[pd.DataFrame, None, None]:
        """
        Extracts and aggregates raw sensor data for each device in the provided DataFrame.

        This function iterates through the provided devices, extracts raw data from BigQuery,
        removes duplicates, aggregates low-cost sensor data, merges it with weather data,
        and finally calibrates the data before yielding it.

        Parameters:
            devices (pd.DataFrame): A DataFrame containing device records, including 'device_id' and 'timestamp'.

        Yields:
            pd.DataFrame: A DataFrame containing processed and calibrated data for each device.
        """

        exclude_cols = None

        devices.drop_duplicates(
            subset=["device_id", "timestamp"], keep="first", inplace=True
        )
        devices.dropna(subset=["timestamp"], inplace=True)

        # TODO Might have to change approach to group by device_id depending on performance.
        for _, row in devices.iterrows():
            end_date_time = datetime.strptime(row.timestamp, "%Y-%m-%d %H:%M:%S%z")
            end_date_time = DateUtils.format_datetime_by_unit_str(
                end_date_time, "hours_end"
            )
            raw_device_data = DataUtils.extract_data_from_bigquery(
                DataType.RAW,
                start_date_time=row.timestamp,
                end_date_time=end_date_time,
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
                use_cache=True,
                data_filter={
                    "device_id": row.device_id,
                    "device_category": DeviceCategory.LOWCOST.str,
                },
            )

            # Initialize `exclude_cols` only once
            if not exclude_cols:
                exclude_cols = [
                    raw_device_data.device_number.name,
                    raw_device_data.latitude.name,
                    raw_device_data.longitude.name,
                    raw_device_data.network.name,
                ]
            if not raw_device_data.empty:
                try:
                    clean_raw = DataUtils.remove_duplicates(
                        raw_device_data,
                        timestamp_col=raw_device_data.timestamp.name,
                        id_col=raw_device_data.device_id.name,
                        group_col=raw_device_data.site_id.name,
                        exclude_cols=exclude_cols,
                    )
                    aggregated_device_data = (
                        AirQoDataUtils.aggregate_low_cost_sensors_data(data=clean_raw)
                    )
                    hourly_weather_data = DataUtils.extract_data_from_bigquery(
                        DataType.AVERAGED,
                        start_date_time=row.timestamp,
                        end_date_time=end_date_time,
                        frequency=Frequency.HOURLY,
                        device_category=DeviceCategory.WEATHER,
                        use_cache=True,
                    )
                    air_weather_hourly_data = (
                        AirQoDataUtils.merge_aggregated_weather_data(
                            airqo_data=aggregated_device_data,
                            weather_data=hourly_weather_data,
                        )
                    )
                    calibrated_data = AirQoDataUtils.calibrate_data(
                        data=air_weather_hourly_data, groupby="city"
                    )
                except Exception as e:
                    logger.exception(f"An error occured: {e}")
                    continue
                else:
                    yield calibrated_data
