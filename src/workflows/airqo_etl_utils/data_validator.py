from itertools import chain
import logging
import numpy as np
import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant, ColumnDataType, Frequency
from airqo_etl_utils.date import date_to_str
from typing import Any, Dict, List
from .config import configuration

logger = logging.getLogger(__name__)


class DataValidationUtils:
    VALID_SENSOR_RANGES = {
        "pm2_5": (1, 1000),
        "pm10": (1, 1000),
        "latitude": (-90, 90),
        "longitude": (-180, 180),
        "battery": (2.7, 5),
        "no2": (0, 2049),
        "altitude": (0, float("inf")),
        "hdop": (0, float("inf")),
        "satellites": (1, 50),
        "temperature": (0, 45),
        "humidity": (0, 99),
        "pressure": (30, 110),
        "tvoc": (0, 10),
        "co2": (400, 3000),
        "hcho": (0, float("inf")),
        "intaketemperature": (0, 45),
        "intakehumidity": (0, 99),
    }

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
                    .str.replace(r"[^\w\s\.\-:]", "", regex=True)
                    .str.replace(r"(?<!\.\d{3})Z$", ".000Z", regex=True)
                )  # Negative lookbehind to add missing milliseconds if needed
                data[col] = pd.to_datetime(data[col], errors="coerce")

        if integers:
            for col in integers:
                data[col] = (
                    data[col]
                    .fillna(
                        ""
                    )  # Replace NaNs with empty strings to avoid errors during string operations
                    .astype(str)  # Ensure the column is a string
                    .str.replace(
                        r"[^\d]", "", regex=True
                    )  # Remove non-numeric characters
                    .str.strip()  # Strip leading/trailing whitespace
                    .replace("", -1)  # Replace empty strings with -1
                    .astype(np.int64)  # Convert to integer
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
        if column_name in DataValidationUtils.VALID_SENSOR_RANGES:
            min_val, max_val = DataValidationUtils.VALID_SENSOR_RANGES[column_name]
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
            is_airqo_network = data["network"] == "airqo"
            mapped_name = configuration.AIRQO_DATA_COLUMN_NAME_MAPPING.get(col, None)
            data.loc[is_airqo_network, col] = data.loc[is_airqo_network, col].apply(
                lambda x: DataValidationUtils.get_valid_value(
                    column_name=mapped_name, row_value=x
                )
            )
        return data

    @staticmethod
    def fill_missing_columns(data: pd.DataFrame, cols: list) -> pd.DataFrame:
        for col in cols:
            if col not in list(data.columns):
                logger.warning(f"{col} missing in dataframe")
                data.loc[:, col] = None

        return data

    @staticmethod
    def process_for_big_query(dataframe: pd.DataFrame, table: str) -> pd.DataFrame:
        columns = BigQueryApi().get_columns(table)
        dataframe = DataValidationUtils.fill_missing_columns(
            data=dataframe, cols=columns
        )
        dataframe = DataValidationUtils.remove_outliers(dataframe)
        return dataframe[columns]

    @staticmethod
    def process_data_for_message_broker(
        data: pd.DataFrame,
        topic: str,
        caller: str,
        frequency: Frequency = Frequency.HOURLY,
    ) -> pd.DataFrame:
        """
        Processes the input DataFrame for message broker consumption based on the specified tenant, frequency, and topic.

        Args:
            data (pd.DataFrame): The input data to be processed.
            tenant (Tenant): The tenant filter for the data, defaults to Tenant.ALL.
            topic (str): The Kafka topic being processed, defaults to None.
            caller (str): The group ID or identifier for devices processing, defaults to None.
            frequency (Frequency): The data frequency (e.g., hourly), defaults to Frequency.HOURLY.

        Returns:
            pd.DataFrame: The processed DataFrame ready for message broker consumption.
        """
        from .airqo_utils import AirQoDataUtils

        data["frequency"] = str(frequency)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        data.rename(columns={"device_id": "device_name"}, inplace=True)

        devices = AirQoDataUtils.get_devices(group_id=caller)
        devices = devices[
            ["device_name", "site_id", "device_latitude", "device_longitude"]
        ]

        data = pd.merge(
            left=data,
            right=devices,
            on=["device_name", "site_id", "network"],
            how="left",
        )
        return data

    @staticmethod
    def convert_pressure_values(value):
        try:
            return float(value) * 0.1
        except Exception:
            return value

    @staticmethod
    def process_data_for_api(data: pd.DataFrame) -> list:
        restructured_data = []

        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        bigquery_api = BigQueryApi()
        cols = bigquery_api.get_columns(bigquery_api.hourly_measurements_table)
        cols.append("battery")
        data = DataValidationUtils.fill_missing_columns(data, cols=cols)

        for _, row in data.iterrows():
            try:
                row_data = {
                    "device": row["device_id"],
                    "device_id": row["mongo_id"],
                    "site_id": row["site_id"],
                    "device_number": row["device_number"],
                    "tenant": str(Tenant.AIRQO),
                    "network": row["tenant"],
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
