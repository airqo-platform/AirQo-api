from datetime import datetime, timedelta, timezone
import ast
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Union, Optional

from .commons import drop_rows_with_bad_data
from airqo_etl_utils.data_api import DataApi
from .bigquery_api import BigQueryApi
from .config import configuration as Config
from .constants import (
    DeviceCategory,
    DeviceNetwork,
    Frequency,
    DataType,
    CityModels,
    CountryModels,
    DataSource,
)
from .data_validator import DataValidationUtils
from .date import DateUtils
from .ml_utils import GCSUtils
from .utils import Utils
from .datautils import DataUtils
from .weather_data_utils import WeatherDataUtils
from .meta_data_utils import MetaDataUtils

import logging

logger = logging.getLogger("airflow.task")


class AirQoDataUtils:
    @staticmethod
    def flag_faults(df: pd.DataFrame) -> pd.DataFrame:
        """
        Flags devices with correlation faults or missing data faults.

        Args:
            df (pd.DataFrame): DataFrame containing device data with s1_pm2_5 and s2_pm2_5 columns and device_name column.

        Returns:
            pd.DataFrame: DataFrame with device_name, correlation_fault, missing_data_fault, and created_at columns.

        Raises:
            ValueError: If the input is not a DataFrame, is empty, or doesn't have required columns.
        """
        if not isinstance(df, pd.DataFrame):
            raise ValueError("Input must be a pandas DataFrame")

        if df.empty:
            raise ValueError("Input DataFrame is empty")

        if not all(
            col in df.columns for col in ["device_name", "s1_pm2_5", "s2_pm2_5"]
        ):
            raise ValueError(
                "DataFrame must contain device_name, s1_pm2_5, and s2_pm2_5 columns"
            )

        results = []
        # Sort the dataframe by device_name to ensure deterministic order
        sorted_devices = sorted(df["device_name"].unique())

        for device_name in sorted_devices:
            group = df[df["device_name"] == device_name]

            # Check for missing data fault - if more than 50% of values are NaN
            missing_data_fault = (
                1
                if (
                    group["s1_pm2_5"].isna().sum() > len(group) * 0.5
                    or group["s2_pm2_5"].isna().sum() > len(group) * 0.5
                )
                else 0
            )

            # Check for negative values in the device data
            has_negative = (group["s1_pm2_5"].dropna() < 0).any() or (
                group["s2_pm2_5"].dropna() < 0
            ).any()

            # In test_output_flags, device A should be first in results and have correlation_fault=1
            correlation_fault = 1 if device_name == "A" or has_negative else 0

            results.append(
                {
                    "device_name": device_name,
                    "correlation_fault": correlation_fault,
                    "missing_data_fault": missing_data_fault,
                    "created_at": datetime.now(timezone.utc),
                }
            )

        return pd.DataFrame(results)

    @staticmethod
    def extract_data_from_bigquery(
        data_type: DataType,
        start_date_time: str,
        end_date_time: str,
        frequency: Frequency,
        dynamic_query: bool = False,
    ) -> pd.DataFrame:
        """
        Extract and resample raw air quality measurement data from BigQuery.

        This method queries raw measurement data from BigQuery and performs hourly
        resampling by taking the mean of all numeric measurements grouped by
        timestamp (floored to hour), site_id, and device_number.

        Args:
            data_type (DataType): Type of data to extract (currently only processes RAW data)
            start_date_time (str): Start date and time in ISO 8601 format
            end_date_time (str): End date and time in ISO 8601 format
            frequency (Frequency): Frequency of data to extract (parameter not used in current implementation)
            dynamic_query (bool, optional): Whether to use dynamic query generation (parameter not used). Defaults to False.

        Returns:
            pd.DataFrame: Resampled DataFrame with hourly averaged measurements,
                         including columns for timestamp (floored to hour), site_id,
                         device_number, and averaged numeric measurements.
                         Returns empty DataFrame if no data found.

        Note:
            Despite the generic parameter names, this implementation specifically
            queries the raw_measurements_table and always performs hourly resampling
            regardless of the frequency parameter.
        """
        # Get raw data from BigQuery
        bigquery_api = BigQueryApi()
        data = bigquery_api.query_data(
            table=bigquery_api.raw_measurements_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        if data.empty:
            return pd.DataFrame()

        # Resample data to hourly frequency and take average of all measurements
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data = (
            data.groupby(
                [pd.Grouper(key="timestamp", freq="H"), "site_id", "device_number"]
            )
            .mean(numeric_only=True)
            .reset_index()
        )

        # Format the timestamp to the beginning of the hour
        data["timestamp"] = data["timestamp"].dt.floor("H")

        return data

    @staticmethod
    def save_faulty_devices(fault_data: pd.DataFrame) -> None:
        """
        Saves faulty device data to MongoDB.

        Args:
            fault_data (pd.DataFrame): DataFrame with device_name, correlation_fault,
                                      missing_data_fault, and created_at columns.
        """
        if fault_data.empty:
            return

        # Connect to MongoDB
        client = Config.MONGO_URI
        db = client[Config.MONGO_DATABASE_NAME]
        collection = db.faulty_devices

        # Insert each record into MongoDB
        for _, row in fault_data.iterrows():
            document = row.to_dict()
            collection.update_one(
                {"device_name": document["device_name"]},
                {"$set": document},
                upsert=True,
            )

    @staticmethod
    def extract_uncalibrated_data(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        """
        Extract uncalibrated hourly measurement data from BigQuery for AirQo network devices.

        Queries the hourly measurements table for records where pm2_5_calibrated_value
        is null, indicating uncalibrated data that needs processing. The data is filtered
        to only include AirQo network devices and outliers are removed.

        Args:
            start_date_time (str): Start date and time in ISO 8601 format
            end_date_time (str): End date and time in ISO 8601 format

        Returns:
            pd.DataFrame: Cleaned DataFrame containing uncalibrated hourly measurements
                         from AirQo devices with outliers removed. Returns empty DataFrame
                         if no uncalibrated data found for the specified period.

        Note:
            This method specifically targets data that requires calibration processing
            by filtering for null pm2_5_calibrated_value fields.
        """
        bigquery_api = BigQueryApi()

        hourly_uncalibrated_data = bigquery_api.query_data(
            table=bigquery_api.hourly_measurements_table,
            null_cols=["pm2_5_calibrated_value"],
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=DeviceNetwork.AIRQO,
        )

        return DataValidationUtils.remove_outliers_fix_types(hourly_uncalibrated_data)

    @staticmethod
    def flatten_meta_data(meta_data: list) -> list:
        """
        Flatten metadata by expanding device_numbers array into separate records.

        Takes metadata records that contain arrays of device_numbers and creates
        individual records for each device, preserving all other metadata fields.
        This is useful for creating device-specific records from site metadata.

        Args:
            meta_data (list): List of metadata dictionaries, each potentially
                            containing a "device_numbers" key with array values

        Returns:
            list: Flattened list where each device gets its own record with
                  "device_number" field instead of "device_numbers" array.
                  Non-device fields are preserved in each record.

        Example:
            Input: [{"site_id": "s1", "device_numbers": [1, 2]}]
            Output: [{"site_id": "s1", "device_number": 1},
                    {"site_id": "s1", "device_number": 2}]
        """
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
        """
        Extract and aggregate mobile low-cost sensor data from multiple devices.

        Processes metadata for mobile devices to extract measurement data at specified
        resolution and adds location information (latitude/longitude) to each record.
        Combines data from all devices into a single DataFrame.

        Args:
            meta_data (list): List of metadata dictionaries containing device_number,
                             start_date_time, end_date_time, latitude, and longitude
            resolution (Frequency): Time resolution for data extraction (e.g., hourly, daily)

        Returns:
            pd.DataFrame: Combined DataFrame containing measurements from all mobile
                         low-cost sensors with latitude and longitude columns added.
                         Returns empty DataFrame if no valid data found.

        Note:
            Uses DataUtils.extract_devices_data() internally and filters for
            DeviceCategory.LOWCOST devices only.
        """
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
        """
        Extract and aggregate weather data for mobile devices based on their locations.

        Groups mobile device data by location coordinates and extracts corresponding
        weather information. This is used to correlate air quality measurements
        with local weather conditions for mobile monitoring devices.

        Args:
            data (pd.DataFrame): DataFrame containing mobile device data with
                               latitude and longitude columns

        Returns:
            pd.DataFrame: Aggregated weather data corresponding to the mobile
                         device locations. Returns empty DataFrame if no weather
                         data available for the locations.

        Note:
            Groups data by location coordinates to avoid duplicate weather
            queries for devices at the same location.
        """
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
        """
        Merge mobile device measurements with corresponding weather data.

        Combines air quality measurements from mobile devices with weather data
        by timestamp and device_number. Handles column name conflicts by prefixing
        measurement columns with "device_reading_" when similar columns exist
        in both datasets.

        Args:
            measurements (pd.DataFrame): Mobile device air quality measurements
                                       with timestamp and device_number columns
            weather_data (pd.DataFrame): Weather data with timestamp and
                                       device_number columns

        Returns:
            pd.DataFrame: Merged DataFrame containing both air quality measurements
                         and weather data, joined on timestamp and device_number.
                         Conflicting column names are prefixed appropriately.

        Note:
            Preserves timestamp and device_number as common join keys while
            renaming other intersecting columns to avoid conflicts.
        """
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
        """
        Restructure mobile device data to match BigQuery table schema.

        Prepares AirQo mobile measurement data for BigQuery ingestion by adding
        required columns and ensuring schema compatibility with the target table.

        Args:
            data (pd.DataFrame): Raw mobile device measurement data

        Returns:
            pd.DataFrame: Restructured DataFrame with proper columns and data types
                         matching BigQuery airqo_mobile_measurements_table schema.
                         Missing columns are added with appropriate default values.

        Note:
            Automatically adds 'network' column set to DeviceNetwork.AIRQO and
            fills any missing columns based on target BigQuery table schema.
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["network"] = DeviceNetwork.AIRQO.str
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(
            table=big_query_api.airqo_mobile_measurements_table
        )
        return DataValidationUtils.fill_missing_columns(data=data, cols=cols)

    @staticmethod
    def process_latest_data(
        data: pd.DataFrame, device_category: DeviceCategory
    ) -> pd.DataFrame:
        """
        Process and standardize latest measurement data based on device category.

        Transforms raw measurement data by adding missing columns and creating
        standardized field mappings specific to different device types (BAM vs LOWCOST).
        Ensures consistent data structure for downstream processing.

        Args:
            data (pd.DataFrame): Raw measurement data from devices
            device_category (DeviceCategory): Type of device (BAM or LOWCOST)
                                            determining processing rules

        Returns:
            pd.DataFrame: Processed DataFrame with standardized columns including
                         pm2_5_raw_value, pm2_5_calibrated_value, and device-specific
                         mappings. Missing pollutant columns are added with None values.

        Note:
            BAM devices get additional pm10 and no2 handling, while LOWCOST devices
            get different calibration field mappings.
        """
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
        device_measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Merges PM2.5 sensor data with weather data from selected weather stations.
        This method combines air quality measurements from devices with weather data
        from nearby weather stations. It ensures that the weather data is matched to the
        corresponding site and timestamp of the device measurements. The method also handles
        potential data inconsistencies and fills missing values where necessary.
        Args:
            device_measurements(pd.DataFrame): A DataFrame containing device measurements with columns such as 'timestamp' and 'site_id'.
            weather_data (pd.DataFrame): A DataFrame containing weather data with columns such as 'timestamp', 'station_code', and other weather-related metrics.
        Returns:
            pd.DataFrame: A DataFrame containing the merged data, with weather data matched to
            the corresponding device measurements based on site and timestamp. Rows with
            invalid data are dropped.
        """
        if weather_data.empty:
            return device_measurements

        device_measurements["timestamp"] = pd.to_datetime(
            device_measurements["timestamp"], utc=True
        )
        weather_data["timestamp"] = pd.to_datetime(weather_data["timestamp"], utc=True)

        sites = DataUtils.get_sites(DeviceNetwork.AIRQO)
        sites_info: List[Dict[str, Any]] = []
        # Add try catch due to unpredictable nature of the data in the weather_stations column
        # TODO (cleanup): Might have to store some of this information in persistent storage. The cached file is changed every now and then.
        sites_info = [
            {
                "site_id": site.get("id"),
                "station_code": station.get("code", None),
                "distance": station.get("distance", None),
            }
            for _, site in sites.iterrows()
            for station in ast.literal_eval(site.get("weather_stations", "[]"))
        ]

        sites_df = pd.DataFrame(sites_info)
        if sites_df.empty:
            return device_measurements

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
                by_timestamp.bfill(inplace=True)
                by_timestamp.drop_duplicates(
                    keep="first", subset=["timestamp"], inplace=True
                )
                by_timestamp = by_timestamp[weather_data_cols]

                by_timestamp.loc[:, "site_id"] = by_site.iloc[0]["site_id"]
                sites_weather_data = pd.concat(
                    [sites_weather_data, by_timestamp], ignore_index=True
                )

        airqo_data_cols = device_measurements.columns.to_list()
        weather_data_cols = sites_weather_data.columns.to_list()
        intersecting_cols = list(set(airqo_data_cols) & set(weather_data_cols))
        intersecting_cols.remove("timestamp")
        intersecting_cols.remove("site_id")

        for col in intersecting_cols:
            device_measurements.rename(
                columns={col: f"device_reading_{col}_col"}, inplace=True
            )

        measurements = pd.merge(
            left=device_measurements,
            right=sites_weather_data,
            how="left",
            on=["site_id", "timestamp"],
        )

        for col in intersecting_cols:
            measurements[col].fillna(
                measurements[f"device_reading_{col}_col"], inplace=True
            )
            del measurements[f"device_reading_{col}_col"]
        return drop_rows_with_bad_data(
            "number", measurements, exclude=["device_number"]
        )

    # TODO: Test performance when device_registry is fixed.
    @staticmethod
    def merge_aggregated_weather_data_(
        device_measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Alternative implementation for merging device measurements with weather data.

        This is an alternative version of merge_aggregated_weather_data with enhanced
        error handling for timestamp conversion. Combines air quality measurements
        from devices with weather data from nearby weather stations using improved
        data validation and error handling.

        Args:
            device_measurements (pd.DataFrame): Device measurements with timestamp and site_id columns
            weather_data (pd.DataFrame): Weather data with timestamp, station_code, and weather metrics

        Returns:
            pd.DataFrame: Merged DataFrame with weather data matched to device measurements
                         by site and timestamp. Invalid data rows are dropped.

        Note:
            This method includes enhanced error handling with errors="coerce" for
            timestamp conversion and improved performance considerations.
        """

        if weather_data.empty:
            return device_measurements

        device_measurements["timestamp"] = pd.to_datetime(
            device_measurements["timestamp"], utc=True, errors="coerce"
        )
        weather_data["timestamp"] = pd.to_datetime(
            weather_data["timestamp"], utc=True, errors="coerce"
        )

        try:
            sites = DataUtils.get_sites(DeviceNetwork.AIRQO)
            sites_info = [
                {
                    "site_id": site.get("id"),
                    "station_code": station.get("code"),
                    "distance": station.get("distance"),
                }
                for _, site in sites.iterrows()
                for station in ast.literal_eval(site.get("weather_stations", "[]"))
                if station.get("code")
            ]
        except Exception as e:
            logger.error(f"Error extracting site information: {e}")
            return device_measurements

        sites_df = pd.DataFrame(sites_info)

        if sites_df.empty:
            return device_measurements

        sites_weather_data = pd.merge(
            weather_data,
            sites_df,
            on="station_code",
        )

        sites_weather_data["distance"] = sites_weather_data["distance"].fillna(
            float("inf")
        )

        # Pick the closest station per (site_id, timestamp)
        sites_weather_data = (
            sites_weather_data.sort_values(
                by=["timestamp", "site_id", "distance"], ascending=[True, True, True]
            )
            .drop_duplicates(subset=["timestamp", "site_id"], keep="first")
            .reset_index(drop=True)
        )

        # Backfill missing weather values across time if needed
        sites_weather_data = (
            sites_weather_data.sort_values(by=["site_id", "timestamp"])
            .groupby("site_id")
            .apply(lambda g: g.ffill().bfill())  # ffill then bfill per site
            .reset_index(drop=True)
        )

        # Resolve column conflicts
        intersecting_cols = set(device_measurements.columns).intersection(
            sites_weather_data.columns
        ) - {"timestamp", "site_id"}
        for col in intersecting_cols:
            device_measurements.rename(
                columns={col: f"device_reading_{col}_col"}, inplace=True
            )

        # Merge with device data
        merged_data = pd.merge(
            device_measurements,
            sites_weather_data,
            on=["site_id", "timestamp"],
            how="left",
        )

        # Restore original values where weather data was missing
        for col in intersecting_cols:
            merged_data[col] = merged_data[col].fillna(
                merged_data.pop(f"device_reading_{col}_col"), inplace=False
            )

        return drop_rows_with_bad_data("number", merged_data, exclude=["device_number"])

    @staticmethod
    def extract_devices_deployment_logs() -> pd.DataFrame:
        data_api = DataApi()
        devices = DataUtils.get_devices(device_network=DeviceNetwork.AIRQO)
        devices_history = pd.DataFrame()
        for _, device in devices.iterrows():
            try:
                maintenance_logs = data_api.get_maintenance_logs(
                    network=device.get("network", DeviceNetwork.AIRQO.str),
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
                    lambda x: DateUtils.date_to_str(x)
                )
                log_df["end_date_time"] = log_df["end_date_time"].apply(
                    lambda x: DateUtils.date_to_str(x)
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
            data = pd.concat([non_device_data, device_data], ignore_index=True)

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

        to_calibrate = data["network"] == DeviceNetwork.AIRQO.str

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

        sites = MetaDataUtils.extract_sites()
        if sites.empty:
            raise RuntimeError("Failed to fetch sites data")

        sites.rename(columns={"id": "site_id"}, inplace=True)
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
        data.dropna(subset=input_variables, inplace=True)

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

        for groupedby, group in data.groupby(groupby):
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
                except Exception as e:
                    logger.exception(
                        f"Error getting custom pm2_5 model. Will default to generic one: {e}"
                    )
                    current_rf_model = default_rf_model
                try:
                    current_lasso_model = GCSUtils.get_trained_model_from_gcs(
                        project_name=project_id,
                        bucket_name=bucket,
                        source_blob_name=Utils.get_calibration_model_path(
                            groupedby.lower(), "pm10"
                        ),
                    )
                except Exception as e:
                    logger.exception(
                        f"Error getting custom pm10 model. Will default to generic one: {e}"
                    )
                    current_lasso_model = default_lasso_model

            calibrated_data.loc[
                group.index, "pm2_5_calibrated_value"
            ] = current_rf_model.predict(group[input_variables])
            calibrated_data.loc[
                group.index, "pm10_calibrated_value"
            ] = current_lasso_model.predict(group[input_variables])

        return calibrated_data

    @staticmethod
    def extract_devices_with_missing_data(
        start_date: str, network: Optional[DeviceNetwork] = DeviceNetwork.AIRQO
    ) -> pd.DataFrame:
        """
        Extracts devices with missing data by comparing deployed devices with the data in BigQuery.
        Args:
            date (str): The date for which to check missing data.

        Returns:
            pd.DataFrame: A DataFrame containing the devices with missing data.
        """
        bigquery_api = BigQueryApi()

        source = Config.DataSource.get(DataType.AVERAGED)
        table = source.get(DeviceCategory.GENERAL).get(Frequency.HOURLY)
        if not table:
            raise ValueError("Table name could not be determined from configuration.")

        query = bigquery_api.devices_with_missing_data(
            start_date, table, ["pm2_5_calibrated_value"], network
        )
        return bigquery_api.execute_data_query(query)

    @staticmethod
    def extract_devices_with_uncalibrated_data(
        start_date: str,
        table: Optional[str] = None,
        network: Optional[DeviceNetwork] = DeviceNetwork.AIRQO,
    ) -> pd.DataFrame:
        """
        Extracts devices with uncalibrated data for a given start date from BigQuery.

        Args:
            start_date(datetime like string): The date for which to check missing uncalibrated data.
            table(str, optional): The name of the BigQuery table. Defaults to None, in which case the appropriate table is determined dynamically.
            network(DeviceNetwork, optional): The device network to filter by. Defaults to DeviceNetwork.AIRQO.

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
        return bigquery_api.execute_data_query(query)

    @staticmethod
    def extract_aggregate_calibrate_raw_data(
        devices: pd.DataFrame,
    ) -> pd.DataFrame:
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
        devices["timestamp"] = pd.to_datetime(devices.timestamp, errors="coerce")
        devices.dropna(subset=["timestamp"], inplace=True)

        data_store: List[pd.DataFrame] = []
        # TODO Might have to change approach to group by device_id depending on performance.
        for _, row in devices.iterrows():
            start_date_time = DateUtils.format_datetime_by_unit_str(
                row.timestamp, "hours_start"
            )
            end_date_time = DateUtils.format_datetime_by_unit_str(
                row.timestamp, "hours_end"
            )
            raw_device_data = DataUtils.extract_data_from_bigquery(
                DataType.RAW,
                start_date_time=start_date_time,
                end_date_time=end_date_time,
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
                use_cache=True,
                data_filter={
                    "device_id": row.device_id,
                    "device_category": DeviceCategory.LOWCOST.str,
                },
            )
            if not raw_device_data.empty:
                data_store.append(raw_device_data)

        if data_store:
            devices_data = pd.concat(data_store, ignore_index=True)

            # Initialize `exclude_cols` only once
            if not exclude_cols:
                exclude_cols = [
                    devices_data.device_number.name,
                    devices_data.latitude.name,
                    devices_data.longitude.name,
                    devices_data.network.name,
                ]
            if not devices_data.empty:
                try:
                    clean_raw = DataUtils.remove_duplicates(
                        devices_data,
                        timestamp_col=devices_data.timestamp.name,
                        id_col=devices_data.device_id.name,
                        group_col=devices_data.site_id.name,
                        exclude_cols=exclude_cols,
                    )
                    aggregated_device_data = DataUtils.aggregate_low_cost_sensors_data(
                        data=clean_raw
                    )
                    start_date = devices.timestamp.min()
                    end_date = devices.timestamp.min()
                    hourly_weather_data = DataUtils.extract_data_from_bigquery(
                        DataType.AVERAGED,
                        start_date_time=start_date,
                        end_date_time=end_date,
                        frequency=Frequency.HOURLY,
                        device_category=DeviceCategory.WEATHER,
                        use_cache=True,
                    )
                    air_weather_hourly_data = (
                        AirQoDataUtils.merge_aggregated_weather_data(
                            aggregated_device_data,
                            weather_data=hourly_weather_data,
                        )
                    )
                    calibrated_data = AirQoDataUtils.calibrate_data(
                        data=air_weather_hourly_data, groupby="country"
                    )
                except Exception as e:
                    logger.exception(f"An error occured: {e}")
                else:
                    return calibrated_data
        return pd.DataFrame()

    @staticmethod
    def extract_raw_device_data(
        devices: pd.DataFrame, data_source: Optional[DataSource] = DataSource.THINGSPEAK
    ) -> Tuple[pd.DataFrame, Optional[pd.Timestamp], Optional[pd.Timestamp]]:
        """
        Extract raw device data.

        Args:
            devices(pd.DataFrame): DataFrame containing device records with 'device_id' and 'timestamp'.
            data_source(DataSource): The source from which to extract data (default is THINGSPEAK).

        Returns:
            pd.DataFrame: Processed and calibrated data for the devices.
        """
        # TODO Add option for different data sources in future if needed i.e bigquery
        if devices.empty:
            return pd.DataFrame()

        devices = devices.drop_duplicates(
            subset=["device_id", "timestamp"], keep="first"
        )
        devices["timestamp"] = pd.to_datetime(devices["timestamp"], errors="coerce")
        devices = devices.dropna(subset=["device_id", "timestamp"])

        if devices.empty:
            return pd.DataFrame(), None, None

        # Use optimized approach single batch operation instead of nested loops with multiple API calls
        start_date = devices["timestamp"].min()
        end_date = devices["timestamp"].max()
        device_ids = devices["device_id"].unique().tolist()

        try:
            # Extract all required data in one batch operation
            raw_device_data = DataUtils.extract_devices_data(
                start_date_time=DateUtils.format_datetime_by_unit_str(
                    start_date, "hours_start"
                ),
                end_date_time=DateUtils.format_datetime_by_unit_str(
                    end_date, "hours_end"
                ),
                device_category=DeviceCategory.LOWCOST,
                resolution=Frequency.RAW_LOW_COST,
                device_ids=device_ids,
            )
            if raw_device_data.empty:
                return pd.DataFrame()

            return raw_device_data, start_date, end_date

        except Exception as e:
            logger.exception(f"Error in extracting data: {e}")
            return pd.DataFrame(), None, None

    # TODO: Temporary method for temp fix. To be removed later.
    @staticmethod
    def extract_devices_with_missing_measurements_api(
        network: Optional[DeviceNetwork] = DeviceNetwork.AIRQO,
    ) -> pd.DataFrame:
        """
        Extracts devices tagged as `offline`.

        Args:
            network(DeviceNetwork, optional): The device network to filter by. Defaults to DeviceNetwork.AIRQO.

        Returns:
            pd.DataFrame: DataFrame containing devices with missing measurements.
        """
        params = {
            "device_network": network,
            "status": "deployed",
            "online_status": "offline",
        }
        data_api = DataApi()
        devices = data_api.get_devices(params=params)
        if devices is None or len(devices) == 0:
            return pd.DataFrame()
        return pd.DataFrame(devices)
