from itertools import chain
import logging
import numpy as np
import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import ColumnDataType
from typing import Any
from .config import configuration as Config

logger = logging.getLogger("airflow.task")


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
    def convert_pressure_values(value):
        try:
            return float(value) * 0.1
        except Exception:
            return value
