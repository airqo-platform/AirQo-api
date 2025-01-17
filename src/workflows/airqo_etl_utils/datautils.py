import numpy as np
import pandas as pd

from .bigquery_api import BigQueryApi
from .constants import (
    DeviceCategory,
    DeviceNetwork,
    Frequency,
    DataSource,
    DataType,
    CityModel,
)
from .utils import Utils
from .data_validator import DataValidationUtils
from typing import List, Dict, Any, Optional, Union


class DataUtils:
    Device_Field_Mapping = {
        DeviceCategory.LOW_COST: {
            "field1": "s1_pm2_5",
            "field2": "s1_pm10",
            "field3": "s2_pm2_5",
            "field4": "s2_pm10",
            "field7": "battery",
            "created_at": "timestamp",
        },
        DeviceCategory.LOW_COST_GAS: {
            "field1": "pm2_5",
            "field2": "tvoc",
            "field3": "hcho",
            "field4": "co2",
            "field5": "intaketemperature",
            "field6": "intakehumidity",
            "field7": "battery",
            "created_at": "timestamp",
        },
    }

    @staticmethod
    def extract_data_from_bigquery(
        datatype: DataType,
        start_date_time: str,
        end_date_time: str,
        frequency: Frequency,
        device_category: DeviceCategory,
        device_network: DeviceNetwork = None,
        dynamic_query: bool = False,
        remove_outliers: bool = True,
    ) -> pd.DataFrame:
        """
        Extracts data from BigQuery within a specified time range and frequency,
        with an optional filter for the device network. The data is cleaned to remove outliers.

        Args:
            datatype(str): The type of data to extract determined by the source data asset.
            start_date_time(str): The start of the time range for data extraction, in ISO 8601 format.
            end_date_time(str): The end of the time range for data extraction, in ISO 8601 format.
            frequency(Frequency): The frequency of the data to be extracted, e.g., RAW or HOURLY.
            device_network(DeviceNetwork, optional): The network to filter devices, default is None (no filter).
            dynamic_query (bool, optional): Determines the type of data returned. If True, returns averaged data grouped by `device_number`, `device_id`, and `site_id`. If False, returns raw data without aggregation. Defaults to False.
            remove_outliers (bool, optional): If True, removes outliers from the extracted data. Defaults to True.

        Returns:
            pd.DataFrame: A pandas DataFrame containing the cleaned data from BigQuery.

        Raises:
            ValueError: If the frequency is unsupported or no table is associated with it.
        """
        bigquery_api = BigQueryApi()
        table: str = None

        source = {
            DataType.RAW: {
                DeviceCategory.GENERAL: {
                    Frequency.RAW: bigquery_api.raw_measurements_table,
                },
                DeviceCategory.BAM: {
                    Frequency.RAW: bigquery_api.raw_bam_measurements_table
                },
                DeviceCategory.WEATHER: {Frequency.RAW: bigquery_api.raw_weather_table},
            },
            DataType.AVERAGED: {
                DeviceCategory.GENERAL: {
                    Frequency.HOURLY: bigquery_api.hourly_measurements_table,
                    Frequency.DAILY: bigquery_api.daily_measurements_table,
                },
                DeviceCategory.BAM: {
                    Frequency.HOURLY: bigquery_api.bam_hourly_measurements_table
                },
                DeviceCategory.WEATHER: {
                    Frequency.RAW: bigquery_api.hourly_weather_table
                },
            },
            DataType.CONSOLIDATED: {
                DeviceCategory.GENERAL: {
                    Frequency.HOURLY: bigquery_api.consolidated_data_table,
                }
            },
        }.get(str(datatype), None)

        if not device_category:
            device_category = DeviceCategory.GENERAL

        if source:
            table = source.get(device_category).get(frequency)

        if not table:
            raise ValueError("No table information provided.")

        raw_data = bigquery_api.query_data(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=device_network,
            dynamic_query=dynamic_query,
        )

        if remove_outliers:
            raw_data = DataValidationUtils.remove_outliers(raw_data)

        return raw_data

    @staticmethod
    def remove_duplicates_air(data: pd.DataFrame) -> pd.DataFrame:
        """
        Removes duplicate rows from a pandas DataFrame based on 'device_id' and 'timestamp'
        while ensuring missing values are filled and non-duplicated data is retained.

        Steps:
        1. Drops rows where all non-essential columns (except 'timestamp', 'device_id', and 'device_number') are NaN.
        2. Drops rows where 'site_id' is NaN (assumed to be non-deployed devices).
        3. Identifies duplicate rows based on 'device_id' and 'timestamp'.
        4. Fills missing values for duplicates within each 'site_id' group using forward and backward filling.
        5. Retains only the first occurrence of duplicates.

        Args:
            data (pd.DataFrame): The input DataFrame containing 'timestamp', 'device_id', and 'site_id' columns.

        Returns:
            pd.DataFrame: A cleaned DataFrame with duplicates handled and missing values filled.
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])

        non_essential_cols = [
            col
            for col in data.columns
            if col not in ["timestamp", "device_id", "device_number", "site_id"]
        ]
        data.dropna(subset=non_essential_cols, how="all", inplace=True)

        # Drop rows where 'site_id' is NaN (non-deployed devices)
        data.dropna(subset=["site_id"], inplace=True)

        data["duplicated"] = data.duplicated(
            keep=False, subset=["device_id", "timestamp"]
        )

        if not data["duplicated"].any():
            data.drop(columns=["duplicated"], inplace=True)
            return data

        duplicates = data[data["duplicated"]].copy()
        non_duplicates = data[~data["duplicated"]].copy()

        columns_to_fill = [
            col
            for col in duplicates.columns
            if col
            not in [
                "device_number",
                "device_id",
                "timestamp",
                "latitude",
                "longitude",
                "network",
                "site_id",
            ]
        ]

        # Fill missing values within each 'site_id' group
        filled_duplicates = []
        for _, group in duplicates.groupby("site_id"):
            group = group.sort_values(by=["device_id", "timestamp"])
            group[columns_to_fill] = (
                group[columns_to_fill].fillna(method="ffill").fillna(method="bfill")
            )
            group = group.drop_duplicates(
                subset=["device_id", "timestamp"], keep="first"
            )
            filled_duplicates.append(group)

        duplicates = pd.concat(filled_duplicates, ignore_index=True)
        cleaned_data = pd.concat([non_duplicates, duplicates], ignore_index=True)

        cleaned_data.drop(columns=["duplicated"], inplace=True)

        return cleaned_data

    @staticmethod
    def remove_duplicates_weather(data: pd.DataFrame) -> pd.DataFrame:
        cols = data.columns.to_list()
        cols.remove("timestamp")
        cols.remove("station_code")
        data.dropna(subset=cols, how="all", inplace=True)
        data["timestamp"] = pd.to_datetime(data["timestamp"])

        data["duplicated"] = data.duplicated(
            keep=False, subset=["station_code", "timestamp"]
        )

        if True not in data["duplicated"].values:
            return data

        duplicated_data = data.loc[data["duplicated"]]
        not_duplicated_data = data.loc[~data["duplicated"]]

        for _, by_station in duplicated_data.groupby(by="station_code"):
            for _, by_timestamp in by_station.groupby(by="timestamp"):
                by_timestamp = by_timestamp.copy()
                by_timestamp.fillna(inplace=True, method="ffill")
                by_timestamp.fillna(inplace=True, method="bfill")
                by_timestamp.drop_duplicates(
                    subset=["station_code", "timestamp"], inplace=True, keep="first"
                )
                not_duplicated_data = pd.concat(
                    [not_duplicated_data, by_timestamp], ignore_index=True
                )

        return not_duplicated_data

    @staticmethod
    def remove_duplicates(
        data: pd.DataFrame,
        timestamp_col: str,
        id_col: str,
        group_col: str,
        exclude_cols: list = None,
    ) -> pd.DataFrame:
        """
        Removes duplicate rows from a pandas DataFrame based on unique identifiers while
        ensuring missing values are filled and non-duplicated data is retained.

        Steps:
        1. Drops rows where all non-essential columns (excluding specified columns) are NaN.
        2. Identifies duplicate rows based on the provided ID and timestamp columns.
        3. Fills missing values for duplicates within each group using forward and backward filling.
        4. Retains only the first occurrence of duplicates.

        Args:
            data(pd.DataFrame): The input DataFrame.
            timestamp_col(str): The name of the column containing timestamps.
            id_col(str): The name of the column used for identifying duplicates (e.g., 'device_id' or 'station_code').
            group_col(str): The name of the column to group by for filling missing values (e.g., 'site_id' or 'station_code').
            exclude_cols(list, optional): A list of columns to exclude from forward and backward filling.

        Returns:
            pd.DataFrame: A cleaned DataFrame with duplicates handled and missing values filled.
        """
        data[timestamp_col] = pd.to_datetime(data[timestamp_col])

        exclude_cols = exclude_cols or []
        essential_cols = [timestamp_col, id_col, group_col]
        non_essential_cols = [
            col for col in data.columns if col not in essential_cols + exclude_cols
        ]

        data.dropna(subset=non_essential_cols, how="all", inplace=True)

        # If grouping column is specified, drop rows where it is NaN
        if group_col in data.columns:
            data.dropna(subset=[group_col], inplace=True)

        data["duplicated"] = data.duplicated(keep=False, subset=[id_col, timestamp_col])

        # If no duplicates exist, clean up and return the data
        if not data["duplicated"].any():
            data.drop(columns=["duplicated"], inplace=True)
            return data

        duplicates = data[data["duplicated"]].copy()
        non_duplicates = data[~data["duplicated"]].copy()

        columns_to_fill = [
            col
            for col in duplicates.columns
            if col not in essential_cols + exclude_cols
        ]

        filled_duplicates = []
        for _, group in duplicates.groupby(group_col):
            group = group.sort_values(by=[id_col, timestamp_col])
            group[columns_to_fill] = (
                group[columns_to_fill].fillna(method="ffill").fillna(method="bfill")
            )
            group = group.drop_duplicates(subset=[id_col, timestamp_col], keep="first")
            filled_duplicates.append(group)

        duplicates = pd.concat(filled_duplicates, ignore_index=True)
        cleaned_data = pd.concat([non_duplicates, duplicates], ignore_index=True)

        cleaned_data.drop(columns=["duplicated"], inplace=True)

        return cleaned_data

    @staticmethod
    def transform_weather_data(data: pd.DataFrame) -> pd.DataFrame:
        if data.empty:
            return data

        data["value"] = pd.to_numeric(data["value"], errors="coerce", downcast="float")
        data["time"] = pd.to_datetime(data["time"], errors="coerce")
        # TODO Clean this up.
        parameter_mappings = {
            "te": "temperature",
            "rh": "humidity",
            "ws": "wind_speed",
            "ap": "atmospheric_pressure",
            "ra": "radiation",
            "vp": "vapor_pressure",
            "wg": "wind_gusts",
            "pr": "precipitation",
            "wd": "wind_direction",
        }
        weather_data = []
        station_groups = data.groupby("station")
        for _, station_group in station_groups:
            station = station_group.iloc[0]["station"]
            time_groups = station_group.groupby("time")

            for _, time_group in time_groups:
                timestamp = time_group.iloc[0]["time"]
                timestamp_data = {"timestamp": timestamp, "station_code": station}

                for _, row in time_group.iterrows():
                    if row["variable"] in parameter_mappings.keys():
                        parameter = parameter_mappings[row["variable"]]
                        value = row["value"]
                        if parameter == "humidity":
                            value = value * 100

                        timestamp_data[parameter] = value

                weather_data.append(timestamp_data)

        weather_data = pd.DataFrame(weather_data)

        cols = [value for value in parameter_mappings.values()]

        weather_data = Utils.populate_missing_columns(data=weather_data, columns=cols)

        return DataValidationUtils.remove_outliers(weather_data)

    @staticmethod
    def aggregate_weather_data(data: pd.DataFrame) -> pd.DataFrame:
        if data.empty:
            return data

        data = data.dropna(subset=["timestamp"])
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        aggregated_data = pd.DataFrame()

        station_groups = data.groupby("station_code")

        for _, station_group in station_groups:
            station_group.index = station_group["timestamp"]
            station_group = station_group.sort_index(axis=0)

            averaging_data = station_group.copy()
            averaging_data.drop(columns=["precipitation"], inplace=True)
            numeric_cols = averaging_data.select_dtypes(include=[np.number]).columns
            averages = averaging_data.resample("H")[numeric_cols].mean()
            averages.reset_index(drop=True, inplace=True)

            summing_data = station_group.copy()[["precipitation"]]
            sums = pd.DataFrame(summing_data.resample("H").sum())
            sums["timestamp"] = sums.index
            sums.reset_index(drop=True, inplace=True)

            merged_data = pd.concat([averages, sums], axis=1)
            merged_data["station_code"] = station_group.iloc[0]["station_code"]

            aggregated_data = pd.concat(
                [aggregated_data, merged_data], ignore_index=True, axis=0
            )

        return aggregated_data

    @staticmethod
    def transform_for_bigquery_weather(data: pd.DataFrame) -> pd.DataFrame:
        bigquery = BigQueryApi()
        cols = bigquery.get_columns(table=bigquery.hourly_weather_table)
        return Utils.populate_missing_columns(data=data, columns=cols)
