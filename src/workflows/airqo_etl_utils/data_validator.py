from itertools import chain
import logging
import numpy as np
import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.airqo_api import AirQoApi
from .datautils import DataUtils
from airqo_etl_utils.constants import ColumnDataType, Frequency, MetaDataType
from airqo_etl_utils.date import date_to_str
from typing import Any, Dict, List
from .config import configuration as Config

logger = logging.getLogger(__name__)


class DataValidationUtils:
    @staticmethod
    def format_data_types(
        data: pd.DataFrame,
        floats: list = None,
        integers: list = None,
        timestamps: list = None,
    ) -> pd.DataFrame:
        """
        Formats specified columns in a DataFrame to desired data types: float, integer, and datetime.

        Args:
            data(pd.DataFrame): The input DataFrame containing the data to be formatted.
            floats(list, optional): List of column names to be converted to floats. Defaults to an empty list.
            integers(list, optional): List of column names to be converted to integers. Defaults to an empty list.
            timestamps(list, optional): List of column names to be converted to datetime. Defaults to an empty list.

        Returns:
            pd.DataFrame: A DataFrame with the specified columns formatted to their respective data types.

        Notes:
        ------
        - Columns specified in `floats` are converted to floats. Rows with invalid values are coerced to NaN.
        - Columns specified in `integers` are stripped of non-numeric characters, and invalid values are replaced with -1.
        - Columns specified in `timestamps` are converted to datetime. Invalid timestamps are coerced to NaT.
        - The function modifies the input DataFrame in place and returns it.
        """

        floats = floats or []
        integers = integers or []
        timestamps = timestamps or []

        if floats:
            data[floats] = data[floats].apply(pd.to_numeric, errors="coerce")

        if timestamps:
            for col in timestamps:
                data[col] = (
                    data[col]
                    .astype(str)
                    .str.replace(r"[^\w\s\.\-+:]", "", regex=True)
                    .str.replace(r"(?<!\.\d{3})Z$", ".000Z", regex=True)
                )  # Negative lookbehind to add missing milliseconds if needed
                data[col] = pd.to_datetime(data[col], errors="coerce", utc=True)

        if integers:
            for col in integers:
                data[col] = (
                    data[col]
                    .fillna("")  # Replace NaN with empty strings
                    .astype(str)  # Convert to string
                    .str.strip()  # Remove leading/trailing whitespace
                    .replace("", np.nan)  # Replace empty strings with NaN for clarity
                    .apply(
                        lambda x: pd.to_numeric(x, errors="coerce")
                    )  # Convert to numeric
                    .fillna(-1)  # Replace NaN with -1 for invalid/missing values
                    .astype(np.int64)  # Convert to integer type
                )

        return data

    @staticmethod
    def get_valid_value(column_name: str, row_value: Any) -> Any:
        """
        Checks if column values fall with in specific ranges.

        Args:
            column_name(str): Name of column to validate
            row_value(Any): Actual value to validate against valid sensor ranges.

        Return:
            None if value does not fall with in the valid range otherwise returns the value passed.
        """
        if column_name in Config.VALID_SENSOR_RANGES:
            min_val, max_val = Config.VALID_SENSOR_RANGES[column_name]
            if not (min_val <= row_value <= max_val):
                return None

        return row_value

    @staticmethod
    def remove_outliers(data: pd.DataFrame) -> pd.DataFrame:
        """
        Cleans and validates data in a DataFrame by formatting columns to their proper types and removing or correcting outliers based on predefined validation rules.

        Args:
            data (pd.DataFrame): Input DataFrame containing the raw data to clean.

        Returns:
            pd.DataFrame: A DataFrame with outliers removed or corrected and data formatted to their respective types (float, integer, timestamp).
        """
        big_query_api = BigQueryApi()
        column_types = {
            ColumnDataType.FLOAT: big_query_api.get_columns(
                table="all", column_type=[ColumnDataType.FLOAT]
            ),
            ColumnDataType.INTEGER: big_query_api.get_columns(
                table="all", column_type=[ColumnDataType.INTEGER]
            ),
            ColumnDataType.TIMESTAMP: big_query_api.get_columns(
                table="all", column_type=[ColumnDataType.TIMESTAMP]
            ),
        }

        filtered_columns = {
            dtype: list(set(columns) & set(data.columns))
            for dtype, columns in column_types.items()
        }
        data = DataValidationUtils.format_data_types(
            data=data,
            floats=filtered_columns[ColumnDataType.FLOAT],
            integers=filtered_columns[ColumnDataType.INTEGER],
            timestamps=filtered_columns[ColumnDataType.TIMESTAMP],
        )

        validated_columns = list(chain.from_iterable(filtered_columns.values()))
        for col in validated_columns:
            mapped_name = Config.AIRQO_DATA_COLUMN_NAME_MAPPING.get(col, None)
            if (
                "network" in data.columns
                and (is_airqo_network := data["network"] == "airqo").any()
            ):
                data.loc[is_airqo_network, col] = data.loc[is_airqo_network, col].apply(
                    lambda x: DataValidationUtils.get_valid_value(
                        column_name=mapped_name, row_value=x
                    )
                )
            else:
                data[col] = data[col].apply(
                    lambda x: DataValidationUtils.get_valid_value(
                        column_name=mapped_name, row_value=x
                    )
                )

        return data

    @staticmethod
    def fill_missing_columns(data: pd.DataFrame, cols: list) -> pd.DataFrame:
        """
        Ensures that all specified columns exist in the given DataFrame.
        If a column is missing, it is added to the DataFrame with `None` as its default value.

        Args:
            data (pd.DataFrame): The input DataFrame to check and update.
            cols (list): A list of column names to ensure exist in the DataFrame.

        Returns:
            pd.DataFrame: The updated DataFrame with all specified columns present.

        Logs:
            Warns if a column in the `cols` list is missing from the DataFrame.
        """
        for col in cols:
            if col not in data.columns.to_list():
                logger.warning(f"{col} missing in DataFrame")
                data.loc[:, col] = None

        return data

    @staticmethod
    def process_for_big_query(dataframe: pd.DataFrame, table: str) -> pd.DataFrame:
        """
        Prepares a pandas DataFrame for insertion into a BigQuery table by aligning columns
        with the target table schema and performing necessary data validation.

        Steps:
        1. Ensures that the DataFrame contains all the columns required by the target BigQuery table.
        2. Removes outliers from the DataFrame.
        3. Selects and returns only the columns present in the target BigQuery table schema.

        Args:
            dataframe (pd.DataFrame): The input DataFrame containing the data to be processed.
            table (str): The name of the target BigQuery table to align the DataFrame schema with.

        Returns:
            pd.DataFrame: The processed DataFrame with validated columns and outliers removed.

        Notes:
            - Columns missing in the input DataFrame are added with `None` as their default value.
            - Only the columns that exist in the BigQuery table schema are retained in the output DataFrame.
        """
        columns = BigQueryApi().get_columns(table)

        dataframe = DataValidationUtils.fill_missing_columns(
            data=dataframe, cols=columns
        )

        dataframe = DataValidationUtils.remove_outliers(dataframe)

        return dataframe[columns]

    @staticmethod
    def convert_pressure_values(value):
        try:
            return float(value) * 0.1
        except Exception:
            return value

    @staticmethod
    def process_data_for_api(data: pd.DataFrame) -> list:
        """
        Processes a pandas DataFrame to structure data into a format suitable for API consumption.

        The function:
        1. Ensures all required columns are present in the DataFrame by filling missing ones.
        2. Constructs a list of dictionaries for each row, with nested data structures for location,
        pollutant values, and other metadata.

        Args:
            data (pd.DataFrame): The input DataFrame containing raw device data.

        Returns:
            list: A list of dictionaries, each representing a structured data record ready for the API.

        Raises:
            Exception: Logs any errors encountered during row processing but does not halt execution.
        """
        restructured_data = []

        data["timestamp"] = pd.to_datetime(data["timestamp"]).apply(date_to_str)

        bigquery_api = BigQueryApi()
        cols = bigquery_api.get_columns(bigquery_api.hourly_measurements_table)
        cols.append("battery")
        data = DataValidationUtils.fill_missing_columns(data, cols=cols)

        # TODO Use DataValidation.format_data_types() to convert cleanup multipe columns.
        data["device_number"] = (
            data["device_number"]
            .fillna("")
            .astype(str)
            .str.strip()
            .replace("", np.nan)
            .apply(lambda x: pd.to_numeric(x, errors="coerce"))
            .fillna(-1)
            .astype(np.int64)
        )

        for _, row in data.iterrows():
            try:
                row_data = {
                    "device": row["device_id"],
                    "device_id": row["mongo_id"],
                    "site_id": row["site_id"],
                    "device_number": row["device_number"],
                    "network": row["network"],
                    "location": {
                        "latitude": {"value": row["latitude"]},
                        "longitude": {"value": row["longitude"]},
                    },
                    "frequency": row["frequency"],
                    "time": row["timestamp"],
                    "pm2_5": {
                        "value": row["pm2_5"],
                        "calibratedValue": row["pm2_5_calibrated_value"],
                    },
                    "pm10": {
                        "value": row["pm10"],
                        "calibratedValue": row["pm10_calibrated_value"],
                    },
                    "average_pm2_5": {
                        "value": row["pm2_5"],
                        "calibratedValue": row["pm2_5_calibrated_value"],
                    },
                    "average_pm10": {
                        "value": row["pm10"],
                        "calibratedValue": row["pm10_calibrated_value"],
                    },
                    "no2": {
                        "value": row["no2"],
                        "calibratedValue": row["no2_calibrated_value"],
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
                    "internalTemperature": {"value": row["device_temperature"]},
                    "internalHumidity": {"value": row["device_humidity"]},
                    "externalPressure": {"value": row["vapor_pressure"]},
                }

                if row_data["site_id"] is None or row_data["site_id"] is np.nan:
                    row_data.pop("site_id")

                restructured_data.append(row_data)

            except Exception as ex:
                logger.exception(f"Error ocurred: {ex}")

        return restructured_data

    def transform_devices(devices: List[Dict[str, Any]], taskinstance) -> pd.DataFrame:
        """
        Transforms and processes the devices DataFrame. If the checksum of the
        devices data has not changed since the last execution, it returns an empty DataFrame.
        Otherwise, it updates the checksum in XCom and returns the transformed DataFrame.

        Args:
            devices (pd.DataFrame): A Pandas DataFrame containing the devices data.
            task_instance: The Airflow task instance used to pull and push XCom values.

        Returns:
            pd.DataFrame: Transformed DataFrame if the devices data has changed since
                        the last execution; otherwise, an empty DataFrame.
        """
        import hashlib

        devices = pd.DataFrame(devices)
        devices.rename(
            columns={
                "device_id": "device_name",
                "_id": "device_id",
                "latitude": "device_latitude",
                "longitude": "device_longitude",
            },
            inplace=True,
        )

        # Convert devices DataFrame to JSON for consistency since JSON stores metadata and compute checksum
        if not devices.empty:
            devices_json = devices.to_json(orient="records", date_format="iso")
            api_devices_checksum = hashlib.md5(devices_json.encode()).hexdigest()

            previous_checksum = taskinstance.xcom_pull(key="devices_checksum")

            if previous_checksum == api_devices_checksum:
                return pd.DataFrame()

            taskinstance.xcom_push(key="devices_checksum", value=api_devices_checksum)
        else:
            logger.warning("No devices returned.")

        return devices

    def extract_transform_and_decrypt_metadata(
        metadata_type: MetaDataType,
    ) -> pd.DataFrame:
        """
        Extracts, transforms, and decrypts metadata for a given type.

        For metadata type 'DEVICES':
        - Retrieves devices data,
        - Decrypts read keys,
        - Adds a 'key' column to the DataFrame.

        For metadata type 'SITES':
        - Retrieves site data and converts it to a DataFrame.

        Returns:
            pd.DataFrame: The processed metadata DataFrame. If no data is found, returns an empty DataFrame.
        """
        airqo_api = AirQoApi()
        endpoints: Dict[str, Any] = {
            "devices": airqo_api.get_devices_by_network(),
            "sites": airqo_api.get_sites(),
        }
        result: pd.DataFrame = pd.DataFrame()
        match metadata_type:
            case MetaDataType.DEVICES:
                devices_raw = endpoints.get(metadata_type.str)
                if devices_raw:
                    devices_df = pd.DataFrame(devices_raw)
                    keys = airqo_api.get_thingspeak_read_keys(devices_df)
                    if keys:
                        devices_df["key"] = (
                            devices_df["device_number"].map(keys).fillna(-1)
                        )
                    result = devices_df
            case MetaDataType.SITES:
                sites_raw = endpoints.get(metadata_type.str)
                if sites_raw:
                    result = pd.DataFrame(sites_raw)
        return result
