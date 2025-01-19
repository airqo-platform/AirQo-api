import numpy as np
import pandas as pd
import logging

from .config import configuration
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

logger = logging.getLogger(__name__)


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

        if not device_category:
            device_category = DeviceCategory.GENERAL
        try:
            source = configuration.DataSource.get(datatype)
            table = source.get(device_category).get(frequency)
        except KeyError as e:
            logger.exception(
                f"Invalid combination: {datatype}, {device_category}, {frequency}"
            )
        except Exception as e:
            logger.exception("An unexpected error occurred during column retrieval")

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

    def format_data_for_bigquery(
        data: pd.DataFrame,
        datatype: DataType,
        device_category: DeviceCategory,
        frequency: Frequency,
    ) -> pd.DataFrame:
        """
        Formats a pandas DataFrame for BigQuery by ensuring all required columns are present
        and the timestamp column is correctly parsed to datetime.

        Args:
            data (pd.DataFrame): The input DataFrame to be formatted.
            data_type (DataType): The type of data (e.g., raw, averaged or processed).
            device_category (DeviceCategory): The category of the device (e.g., BAM, low-cost).
            frequency (Frequency): The data frequency (e.g., raw, hourly, daily).

        Returns:
            pd.DataFrame: A DataFrame formatted for BigQuery with required columns populated.

        Raises:
            KeyError: If the combination of data_type, device_category, and frequency is invalid.
            Exception: For unexpected errors during column retrieval or data processing.
        """
        bigquery = BigQueryApi()
        data.loc[:, "timestamp"] = pd.to_datetime(data["timestamp"])

        try:
            datasource = configuration.DataSource
            table = datasource.get(datatype).get(device_category).get(frequency)
            cols = bigquery.get_columns(table=table)
        except KeyError:
            logger.exception(
                f"Invalid combination: {datatype}, {device_category}, {frequency}"
            )
        except Exception as e:
            logger.exception(
                f"An unexpected error occurred during column retrieval: {e}"
            )

        return Utils.populate_missing_columns(data=data, columns=cols)

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
        essential_cols = (
            [timestamp_col, id_col]
            if id_col == group_col
            else [timestamp_col, id_col, group_col]
        )
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
            group = group.sort_values(by=[timestamp_col, id_col])
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
